import React from 'react';
import { act, render, screen } from '@testing-library/react';
import moment from 'moment';
import useCurrentDate, { UseCurrentDateOptions } from './index';

let renderCount = 0;
const TestComp = ({ options }: { options?: UseCurrentDateOptions }) => {
  const date = useCurrentDate(options);
  renderCount++;
  return <div data-testid="date-output">{date.toISOString()}</div>;
};

const durMs = (...args: Parameters<typeof moment['duration']>) => moment.duration(...args).asMilliseconds();
const getTimeToNextMidnight = (utc?: boolean) => {
  const now = moment().utcOffset(-7);

  const tomorrow = now.clone().add(1, 'day');
  if (utc) {
    tomorrow.utc();
  }

  return tomorrow.startOf('day').diff(now);
};

const advanceTimers = (ms: number) => act(() => jest.advanceTimersByTime(ms));

jest.useFakeTimers();

beforeEach(() => {
  renderCount = 0;
  jest.setSystemTime(Date.UTC(2022, 6, 8, 5, 15, 30, 561));
});

describe('basic options', () => {
  const basicOptionTestCases: [string, string, UseCurrentDateOptions | undefined][] = [
    ['no options', 'midnight of the current day', undefined],
    ['empty options', 'midnight of the current day', {}],
    ['returnCurrentTime', 'current time', { returnCurrentTime: true }],
    ['utc', 'midnight of current UTC day', { utc: true }],
  ]

  it.each(basicOptionTestCases)('with %s returns %s and refreshes at midnight', (_, __, options) => {
    render(<TestComp options={options} />);
    expect(renderCount).toBe(1);
    const output = screen.getByTestId<HTMLDivElement>('date-output');
    expect(output.innerHTML).toMatchSnapshot();

    advanceTimers(durMs(5, 'minutes'));
    expect(renderCount).toBe(1);

    advanceTimers(getTimeToNextMidnight(options?.utc));
    expect(renderCount).toBe(2);
    expect(output.innerHTML).toMatchSnapshot();
  });
});

describe('with refreshAt', () => {
  it('returns the current time, and refreshes at each refresh time', () => {
    render(<TestComp options={{ refreshAt: ['5:00', '23:05:21.3'] }} />);
    expect(renderCount).toBe(1);

    let next = new Date().setHours(23, 5, 21, 300) - Date.now();

    advanceTimers(next - 1);
    expect(renderCount).toBe(1);

    advanceTimers(1);
    expect(renderCount).toBe(2);
    expect(screen.getByTestId('date-output')).toHaveTextContent('2022-07-08T06:05:21.300Z');

    next = new Date(new Date().setDate(8)).setHours(5, 0, 0, 0) - Date.now();
    advanceTimers(next - 1);
    expect(renderCount).toBe(2);

    advanceTimers(1);
    expect(renderCount).toBe(3);
    expect(screen.getByTestId('date-output')).toHaveTextContent('2022-07-08T12:00:00.000Z');
  });

  it('allows refreshes to be listed out of order', () => {
    render(<TestComp options={{ refreshAt: [10, 5] }} />);
    advanceTimers(getTimeToNextMidnight() + 4);
    expect(renderCount).toBe(1);

    advanceTimers(1);
    expect(renderCount).toBe(2);

    advanceTimers(4);
    expect(renderCount).toBe(2);

    advanceTimers(1);
    expect(renderCount).toBe(3);
  });

  it('with utc, refreshes at the specified utc values', () => {
    render(<TestComp options={{ refreshAt: ['5:00', '23:05:21.3'], utc: true }} />);
    expect(renderCount).toBe(1);

    let next = Date.UTC(2022, 6, 8, 23, 5, 21, 300) - Date.now();

    advanceTimers(next - 1);
    expect(renderCount).toBe(1);

    advanceTimers(1);
    expect(renderCount).toBe(2);
    expect(screen.getByTestId('date-output')).toHaveTextContent('2022-07-08T23:05:21.300Z');

    next = Date.UTC(2022, 6, 9, 5, 0) - Date.now();
    advanceTimers(next - 1);
    expect(renderCount).toBe(2);

    advanceTimers(1);
    expect(renderCount).toBe(3);
    expect(screen.getByTestId('date-output')).toHaveTextContent('2022-07-09T05:00:00.000Z');
  });

  it('with an interval, refreshes at intervals relative to the previous refresh value', () => {
    render(<TestComp options={{ refreshAt: ['5:00', '10:05'], interval: durMs(2, 'minutes') }} />);
    advanceTimers(Date.UTC(2022, 6, 8, 5, 17) - Date.now() - 1);
    expect(renderCount).toBe(1);
    advanceTimers(1);
    expect(renderCount).toBe(2);

    const nextRefresh = Date.UTC(2022, 6, 8, 12);
    let expectedRenders = renderCount;
    const twoMin = durMs(2, 'minutes');

    while (Date.now() + twoMin < nextRefresh) {
      advanceTimers(twoMin - 1);
      expect(renderCount).toBe(expectedRenders);

      advanceTimers(1);
      expectedRenders++;
      expect(renderCount).toBe(expectedRenders);
    }

    advanceTimers(durMs(1, 'minute') - 1);
    expect(renderCount).toBe(expectedRenders);

    advanceTimers(1);
    expect(renderCount).toBe(expectedRenders + 1);

    advanceTimers(twoMin);
    expect(renderCount).toBe(expectedRenders + 2);
  });
});

describe('with an interval', () => {
  it('returns the current time, and refreshes every interval', () => {
    render(<TestComp options={{ interval: durMs(5, 'minutes') }} />);
    expect(renderCount).toBe(1);
    expect(screen.getByTestId('date-output')).toHaveTextContent('2022-07-08T05:15:30.561Z');

    const msToNextInt = moment().startOf('minute').add(5, 'minutes').diff(Date.now());
    advanceTimers(msToNextInt - 1);
    expect(renderCount).toBe(1);
    expect(screen.getByTestId('date-output')).toHaveTextContent('2022-07-08T05:15:30.561Z');

    advanceTimers(1);
    expect(renderCount).toBe(2);
    expect(screen.getByTestId('date-output')).toHaveTextContent('2022-07-08T05:20:00.000Z');
  });
});