import React, { memo } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import moment from 'moment';
import { ErrorBoundary } from 'react-error-boundary';
import timeZoneMock from 'timezone-mock';
import useCurrentDate, { UseCurrentDateOptions } from './index';

let renderCount = 0;
const TestComp = ({ options }: { options?: UseCurrentDateOptions }) => {
  const TestCompInner = memo(({ options }: { options?: UseCurrentDateOptions }) => {
    const date = useCurrentDate(options);
    renderCount++;
    return <div data-testid="date-output">{date.toISOString()}</div>;
  });

  return <ErrorBoundary FallbackComponent={({ error }) => <div data-testid="error">{error.message}</div>}>
    <TestCompInner options={options} />
  </ErrorBoundary>;
}

const durMs = (...args: Parameters<typeof moment['duration']>) => moment.duration(...args).asMilliseconds();
const getTimeToNextMidnight = (utc?: boolean) => {
  const now = moment();

  const tomorrow = now.clone().add(1, 'day');
  if (utc) {
    tomorrow.utc();
  }

  return tomorrow.startOf('day').diff(now);
};

const advanceTimers = (ms: number) => act(() => jest.advanceTimersByTime(ms));

jest.useFakeTimers();
timeZoneMock.register('US/Pacific');

describe('useCurrentDate()', () => {
  beforeEach(() => {
    renderCount = 0;
    jest.setSystemTime(Date.UTC(2022, 6, 8, 5, 15, 30, 561));
  });

  it.each`
  optsDesc                 | returns                          | refreshesAt       | options
  ${'no options parameter'}| ${'midnight of the current day'} | ${'midnight'}     | ${undefined}
  ${'empty options'}       | ${'midnight of the current day'} | ${'midnight'}     | ${{}}
  ${'returnCurrentTime'}   | ${'current time'}                | ${'midnight'}     | ${{ returnCurrentTime: true }}
  ${'utc'}                 | ${'midnight of current UTC day'} | ${'midnight UTC'} | ${{ utc: true }}
`('with $optsDesc, returns $returns and refreshes at $refreshesAt', ({ options }: { options?: UseCurrentDateOptions }) => {
    render(<TestComp options={options} />);
    expect(renderCount).toBe(1);
    const output = screen.getByTestId<HTMLDivElement>('date-output');
    expect(output.innerHTML).toMatchSnapshot('initial output');

    advanceTimers(getTimeToNextMidnight(options?.utc) - 1);
    expect(renderCount).toBe(1);

    advanceTimers(1);
    expect(renderCount).toBe(2);
    expect(output.innerHTML).toMatchSnapshot(options?.utc ? 'at midnight UTC' : 'at midnight');
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

    it('mods numbers by 24 hours', () => {
      advanceTimers(getTimeToNextMidnight());
      render(<TestComp options={{ refreshAt: [durMs(1, 'day') + durMs(5, 'minutes')] }} />);
      advanceTimers(durMs(5, 'minutes') - 1);
      expect(renderCount).toBe(1);

      advanceTimers(1);
      expect(renderCount).toBe(2);

      advanceTimers(durMs(1, 'day') - 1);
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

    it.each`
    desc        | refreshAt
    ${'string'} | ${'5:00'}
    ${'number'} | ${durMs(5, 'hours')}
  `('handles a single $desc', ({ refreshAt }: { refreshAt: '5:00' | number }) => {
      render(<TestComp options={{ refreshAt }} />);

      advanceTimers(getTimeToNextMidnight());
      expect(renderCount).toBe(1);

      advanceTimers(durMs(5, 'hours') - 1);
      expect(renderCount).toBe(1);

      advanceTimers(1);
      expect(renderCount).toBe(2);
    });

    it("parses '0' as midnight", () => {
      render(<TestComp options={{ refreshAt: '0' }} />);
      advanceTimers(getTimeToNextMidnight() - 1);
      expect(renderCount).toBe(1);

      advanceTimers(1);
      expect(renderCount).toBe(2);
    });

    it.each`
    format           | refreshAt
    ${'h'}           | ${'8'}
    ${'h:mm'}        | ${'8:30'}
    ${'h:mm:ss'}     | ${'8:30:55'}
    ${'h:mm:ss.m'}   | ${'8:30:55.2'}
    ${'h:mm:ss.ms'}  | ${'8:30:55.25'}
    ${'h:mm:ss.mss'} | ${'8:30:55.256'}
  `("can parse '$format'-formatted strings", ({ refreshAt }: { refreshAt: string & UseCurrentDateOptions['refreshAt'] }) => {
      render(<TestComp options={{ refreshAt }} />);
      advanceTimers(getTimeToNextMidnight());
      expect(renderCount).toBe(1);

      advanceTimers(durMs(refreshAt.padEnd(4, ':00')) - 1);
      expect(renderCount).toBe(1);

      advanceTimers(1);
      expect(renderCount).toBe(2);
    });

    it('handles null as if it was undefined (for n00bs not using TypeScript)', () => {
      // @ts-expect-error
      render(<TestComp options={{ refreshAt: null }} />);
      advanceTimers(getTimeToNextMidnight() - 1);
      expect(renderCount).toBe(1);

      advanceTimers(1);
      expect(renderCount).toBe(2);
    });

    it('parses strings with leading/trailing whitespace', () => {
      render(<TestComp options={{ refreshAt: ' 5:00 ' }} />);
      advanceTimers(getTimeToNextMidnight());
      expect(renderCount).toBe(1);

      advanceTimers(durMs(5, 'hours') - 1);
      expect(renderCount).toBe(1);

      advanceTimers(1);
      expect(renderCount).toBe(2);
    });

    describe('throws an error when', () => {
      const realConsoleError = console.error;
      beforeAll(() => {
        console.error = jest.fn();
      });

      afterAll(() => {
        console.error = realConsoleError;
      });

      it('given an empty array', () => {
        // @ts-expect-error
        render(<TestComp options={{ refreshAt: [] }} />);
        expect(screen.getByTestId('error')).toHaveTextContent('refreshAt must have at least one value');
      });

      const invalidFormatTestCases: (string & UseCurrentDateOptions['refreshAt'])[] = [
        // @ts-expect-error
        '',
        // @ts-expect-error
        'abc',
        '-1',
        '24',
        '30',
        '100',
        // @ts-expect-error
        '8:',
        '8.5',
        '8:3',
        '8:60',
        // @ts-expect-error
        '8:30:',
        '8:30:3',
        '8:30:60',
        '8:30:55.',
        '8:30:55.2567',
        // @ts-expect-error
        '8:30:55:256',
        // @ts-expect-error
        ':50',
        // @ts-expect-error
        '8:30 AM',
        // @ts-expect-error
        '8:30:55.256:00',
      ];

      it.each(invalidFormatTestCases)("given an invalid time format '%s'", refreshAt => {
        render(<TestComp options={{ refreshAt }} />);
        expect(screen.getByTestId('error')).toHaveTextContent(`Invalid refreshAt value format. Expected \`h[:mm[:ss[.ms]]]\`. Received: '${refreshAt}'`);
        cleanup();

        render(<TestComp options={{ refreshAt: [refreshAt as any] }} />);
        expect(screen.getByTestId('error')).toHaveTextContent(`Invalid refreshAt value format. Expected \`h[:mm[:ss[.ms]]]\`. Received: '${refreshAt}'`);
        cleanup();

        render(<TestComp options={{ refreshAt: [1, refreshAt as any, 3] }} />);
        expect(screen.getByTestId('error')).toHaveTextContent(`Invalid refreshAt value format. Expected \`h[:mm[:ss[.ms]]]\`. Received: '${refreshAt}'`);
      });

      it('given something other than a string, number, or array of strings and numbers', () => {
        // @ts-expect-error
        render(<TestComp options={{ refreshAt: Symbol('bad refreshAt') }} />);
        expect(screen.getByTestId('error')).toHaveTextContent('refreshAt must be a string, a number, or an array of strings and numbers');
      });
    })
  });

  describe('with an interval', () => {
    it('returns the current time and refreshes every interval', () => {
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
});