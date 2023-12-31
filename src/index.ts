import React, { useCallback, useEffect, useState } from 'react';

export interface UseCurrentDateOptions {
  /**
   * If set to `true`, will always return the current time.  Otherwise, will return the date at midnight.
   *
   * This defaults to `false` unless {@link refreshAt | `refreshAt`} is an array of at least two values or
   * {@link interval | `interval`} is set.
   */
  returnCurrentTime?: boolean;

  /**
   * If set to `true` uses the UTC date rather than the local date for calculations.
   *
   * **NOTE**: Setting this to true `true` does not mean the returned `Date` will return UTC values for `getHours()`,
   * etc.  You will still need to use `getUTCHours()`, etc. or a wrapping library like
   * {@link https://momentjs.com/ | moment.js}.
   *
   * @default false
   */
  utc?: boolean;

  /**
   * The time or times of day to refresh the component relative to midnight (whether that be local, UTC, or the result
   * of {@link manipulateMidnight | `manipulateMidnight`}).
   *
   * Numbers values represent the number of milliseconds past midnight.  Values above 24 hours are %'d by 24 hours.
   *
   * Strings must be of the format `h:mm:ss.ms`, where `h` is a value between 0 and 23.  Minutes, seconds, and
   * milliseconds are optional.
   *
   * **NOTE**: if you pass an array and that array is not dynamic, you should define it outside of the component.  If it
   * is dynamic, wrap it in {@link React.useState | `useState`} or {@link React.useRef | `useRef`}.  Otherwise, all of
   * the business logic will run on every refresh.
   *
   * @example
   *
   * const refreshAt = ['0:00', '12:00'];
   *
   * const MyComponent = () => {
   *   const currentDate = useCurrentDate({ refreshAt });
   *   // ...
   * }
   *
   * @default 0
   */
  refreshAt?: RefreshAt | [RefreshAt, ...RefreshAt[]];

  /**
   * If set, refreshes the state every `interval` milliseconds.  If {@link refreshAt | `refreshAt`} is also set, runs the
   * interval relative to the previous `refreshAt` value.
   */
  interval?: number;
}

/**
 * Returns the current `Date`.  Refreshes the component at midnight unless overridden by `options`.  Returns midnight of
 * the current local day unless overridden by `options`.
 *
 * @example
 * const MyComponent = () => {
 *   const currentDateLocal = useCurrentDate();
 *   const formattedLocal = new Intl.DateTimeFormat(
 *     'en-US',
 *     { dateStyle: 'full' }
 *   ).format(currentDateLocal);
 *
 *   const currentDateNYC = useCurrentDate({ utc: true, refreshAt: '20:00' });
 *   const formattedNYC = new Intl.DateTimeFormat(
 *     'en-US',
 *     { dateStyle: 'full', timeZone: 'America/New_York' }
 *   ).format(currentDateNYC);
 *
 *   return <div>
 *     Today is {formattedLocal}.<br />
 *     In New York City, it is {formattedNYC}.
 *   </div>;
 * };
 */
export default function useCurrentDate(options?: UseCurrentDateOptions): Date;
export default function useCurrentDate({
  utc,
  refreshAt,
  returnCurrentTime,
  interval: int,
}: UseCurrentDateOptions = {}): Date {
  returnCurrentTime ??= int != null || Array.isArray(refreshAt) && refreshAt.length > 1;
  int ??= TWENTY_FOUR_HOURS;

  const refresh = useRefresh();
  // force a refresh when the page becomes visible
  usePageVisibility();

  useEffect(() => {
    const currentMidnightTime = getCurrentMidnight(utc).getTime();
    const tomorrowMidnightTime = currentMidnightTime + TWENTY_FOUR_HOURS;
    const now = Date.now();

    let nextRefresh: number;
    let prevRefresh: number;

    if (refreshAt == null) {
      nextRefresh = tomorrowMidnightTime;
      prevRefresh = currentMidnightTime;
    } else {
      const refreshes = getRefreshValues(refreshAt);
      if (!refreshes.length) {
        throw new Error('refreshAt must have at least one value');
      }

      nextRefresh = currentMidnightTime +
        (refreshes.find(v => currentMidnightTime + v >= now) ?? TWENTY_FOUR_HOURS + refreshes[0]);

      refreshes.reverse();
      prevRefresh = currentMidnightTime +
        (refreshes.find(v => currentMidnightTime + v < now) ?? TWENTY_FOUR_HOURS + refreshes[0]);
    }

    const timeout = setTimeout(refresh, nextRefresh - now);
    const clear = setIntervalRelativeTo(refresh, prevRefresh, int!);

    return () => {
      clearTimeout(timeout);
      clear();
    };
  }, [int, refreshAt, refresh]);

  return returnCurrentTime ? new Date() : getCurrentMidnight(utc);
}

const getCurrentMidnight = (utc = false) => {
  const date = new Date();

  if (utc) {
    date.setUTCHours(0, 0, 0, 0);
  } else {
    date.setHours(0, 0, 0, 0);
  }

  return date;
}

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
const TIME_REGEX = /^([01]?\d|2[0-3])(?::([0-5]\d)(?::([0-5]\d)(?:\.(\d{1,3}))?)?)?$/;

const getRefreshValues = (refreshAt: UseCurrentDateOptions['refreshAt']): number[] =>
  [refreshAt]
    .flat()
    .map(v => {
      switch (typeof v) {
        case 'number':
          return v % TWENTY_FOUR_HOURS;

        case 'string':
          const timeSegments = TIME_REGEX.exec(v.trim())?.slice(1).filter(v => v != null).map(Number);
          if (!timeSegments) {
            throw new Error(`Invalid refreshAt value format.  Expected \`h[:mm[:ss[.ms]]]\`.  Received: '${v}'`);
          }

          // despite what TSC says, `undefined < 100` is valid javascript and returns false
          if (timeSegments[3] < 100) {
            timeSegments[3] = Number(timeSegments[3].toString().padEnd(3, '0'));
          }

          return Date.UTC(1970, 0, 1, ...timeSegments);

        default:
          throw new Error(`refreshAt must be a string, a number, or an array of strings and numbers`);
      }
    })
    .sort((a, b) => a - b);

const useRefresh = () => {
  const [, r] = useState({});
  return useCallback(() => r({}), []);
}

const setIntervalRelativeTo = (fn: () => void, fromTime: number, ms: number) => {
  let interval: ReturnType<typeof setInterval> | undefined;
  const timeout = setTimeout(() => {
    fn();
    interval = setInterval(fn, ms);
  }, ms - ((Date.now() - fromTime) % ms));

  return () => {
    clearTimeout(timeout);
    clearInterval(interval);
  };
}

type RefreshAt = RefreshAtString | number;
type OptionalStr<T extends string | number> = '' | T;

// alas, TSC complains about "complexity" if I make this match the regex
type RefreshAtString = `${number}${OptionalStr<`:${number}${OptionalStr<`:${number}${OptionalStr<`.${number}`>}`>}`>}`;

// good-enough™ polyfill
const useSyncExternalStore = React.useSyncExternalStore ?? ((subscribe, getSnapshot) => {
  const [value, setValue] = useState(getSnapshot());
  useEffect(() => subscribe(() => setValue(getSnapshot())), [subscribe, getSnapshot]);
  return value;
});

const usePageVisibility = () => useSyncExternalStore(subscribe, getSnapshot);

const subscribe = (fn: () => void) => {
  document.addEventListener('visibilitychange', fn);
  return () => document.removeEventListener('visibilitychange', fn);
};

const getSnapshot = () => document.visibilityState === 'visible';