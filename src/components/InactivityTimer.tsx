'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes

export function InactivityTimer({ timeoutMs = DEFAULT_TIMEOUT_MS }: { timeoutMs?: number }) {
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const lock = async () => {
      window.dispatchEvent(new Event('osteoflow:before-lock'))
      await new Promise((r) => setTimeout(r, 400))
      await fetch('/api/session/lock', { method: 'POST' })
      router.push('/pin?mode=unlock')
    }

    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(lock, timeoutMs)
    }

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach((e) => document.addEventListener(e, reset, { passive: true }))
    reset()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      events.forEach((e) => document.removeEventListener(e, reset))
    }
  }, [timeoutMs, router])

  return null
}
