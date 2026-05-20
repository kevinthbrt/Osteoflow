'use client'

import { TourProvider } from '@/contexts/tour-context'

export function TourWrapper({ children }: { children: React.ReactNode }) {
  return <TourProvider>{children}</TourProvider>
}
