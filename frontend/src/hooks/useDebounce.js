import { useState, useEffect } from 'react';

/**
 * Custom hook to debounce fast value updates (e.g. search keystrokes).
 * @param {any} value
 * @param {number} delay (default: 300ms)
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
