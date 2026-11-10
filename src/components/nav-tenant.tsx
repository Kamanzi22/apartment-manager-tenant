'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/app/actions/auth'
import { CreditCard, Wrench, MessageSquare, LogOut } from 'lucide-react'

const navItems = [
  { href: '/', label: 'Rent', icon: CreditCard, exact: true },
  { href: '/maintenance', label: 'Maintenance', icon: Wrench },
  { href: '/messages', label: 'Messages', icon: MessageSquare },
]

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

interface Props {
  unreadCount: number
  unitLabel: string
  fullName: string
}

const tabCls =
  'w-full min-h-[56px] flex flex-col items-center justify-center gap-0.5 rounded-[18px] text-[11px] font-medium transition-colors'
const activeCls = 'bg-white/85 text-[var(--ink)] font-semibold shadow-[0_4px_12px_rgba(20,30,40,0.12)]'
const idleCls = 'text-[var(--muted-2)] hover:bg-white/40'

// Floating glass tab bar, used at every screen size.
export function NavTenant({ unreadCount: _unreadCount, unitLabel, fullName }: Props) {
  const pathname = usePathname()

  return (
    <nav
      aria-label={`Tenant portal: ${fullName}, ${unitLabel}`}
      className="glass fixed bottom-3.5 inset-x-3.5 md:left-1/2 md:right-auto md:w-[440px] md:-translate-x-1/2 z-50 rounded-[24px]! p-1.5"
    >
      <div className="flex gap-1">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn('flex-1', tabCls, active ? activeCls : idleCls)}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          )
        })}
        <form action={signOut} className="flex-1">
          <button type="submit" className={cn(tabCls, idleCls)}>
            <LogOut className="h-5 w-5" />
            <span>Sign out</span>
          </button>
        </form>
      </div>
    </nav>
  )
}
