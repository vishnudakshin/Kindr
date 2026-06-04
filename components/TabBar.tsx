'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  IconLayoutDashboard,
  IconTestPipe,
  IconClipboardList,
  IconChartBar,
  IconReportSearch,
  IconBook,
  IconUser,
} from '@tabler/icons-react'
import type { FC } from 'react'

type TablerIcon = FC<{ size?: number; strokeWidth?: number; className?: string }>

const TABS: { href: string; label: string; Icon: TablerIcon }[] = [
  { href: '/dashboard',  label: 'Dashboard', Icon: IconLayoutDashboard },
  { href: '/labs',       label: 'Labs',      Icon: IconTestPipe        },
  { href: '/plan',       label: 'Plan',      Icon: IconClipboardList   },
  { href: '/report',     label: 'Report',    Icon: IconReportSearch    },
  { href: '/progress',   label: 'Progress',  Icon: IconChartBar        },
  { href: '/resources',  label: 'Resources', Icon: IconBook            },
  { href: '/profile',    label: 'Profile',   Icon: IconUser            },
]

export function TabBar() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border flex">
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors
              ${active ? 'text-ink' : 'text-ink-2'}`}
          >
            <Icon size={22} strokeWidth={active ? 2 : 1.5} />
            <span className={`text-[9.5px] tracking-wide ${active ? 'font-medium' : ''}`}>
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
