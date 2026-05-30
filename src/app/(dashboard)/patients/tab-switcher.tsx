'use client'

import { useRouter } from 'next/navigation'
import { Users, Calendar } from 'lucide-react'

export function TabSwitcher({ activeTab }: { activeTab: string }) {
  const router = useRouter()

  const tabs = [
    { key: 'patients', label: 'Patients', icon: Users },
    { key: 'consultations', label: 'Consultations', icon: Calendar },
  ]

  return (
    <div className="flex gap-1 p-1 rounded-xl bg-muted w-fit">
      {tabs.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => router.push(key === 'patients' ? '/patients' : '/patients?tab=consultations')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150 ${
            activeTab === key
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  )
}
