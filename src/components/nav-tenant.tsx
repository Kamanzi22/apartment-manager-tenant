'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/app/actions/auth'
import { Home, CreditCard, Wrench, MessageSquare, LogOut } from 'lucide-react'

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

export function NavTenant({ unreadCount: _unreadCount, unitLabel, fullName }: Props) {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-56 lg:fixed lg:inset-y-0 bg-slate-900 text-white">
        <div className="flex items-center gap-2 px-4 py-5 border-b border-slate-700">
          <Home className="h-5 w-5 text-slate-300" />
          <div>
            <span className="font-semibold text-sm block">Tenant Portal</span>
            <span className="text-xs text-slate-400">{unitLabel}</span>
          </div>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  active ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>
        <div className="px-2 pb-4 border-t border-slate-700 pt-3 space-y-0.5">
          <form action={signOut}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Sign out
            </button>
          </form>
          <div className="px-3 py-2">
            <p className="text-xs text-slate-400 truncate">{fullName}</p>
          </div>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-slate-900 border-t border-slate-700 z-50">
        <div className="flex">
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex-1 flex flex-col items-center gap-0.5 py-2 text-xs',
                  active ? 'text-white' : 'text-slate-400'
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </Link>
            )
          })}
          <form action={signOut} className="flex-1">
            <button
              type="submit"
              className="w-full flex flex-col items-center gap-0.5 py-2 text-xs text-slate-400 hover:text-white"
            >
              <LogOut className="h-5 w-5" />
              <span>Sign out</span>
            </button>
          </form>
        </div>
      </nav>
    </>
  )
}
