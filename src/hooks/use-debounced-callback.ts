import { useCallback, useRef, useEffect } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  // Keep a ref to the latest callback so the returned function never changes
  const callbackRef = useRef(callback)
  useEffect(() => { callbackRef.current = callback })

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args)
      }, delay)
    },
    // delay is the only real dep — callbackRef is always current via the effect above
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [delay]
  )
}
