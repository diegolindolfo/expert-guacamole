'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const links = [
  { href: '/dashboard',        label: 'Dashboard' },
  { href: '/emprestimos',      label: 'Empréstimos' },
  { href: '/acervo',           label: 'Acervo' },
  { href: '/alunos',           label: 'Alunos' },
  { href: '/emprestimos/novo', label: '+ Novo' },
]

export default function Nav() {
  const path = usePathname()
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null)
    })
  }, [])

  async function sair() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (path === '/login') return null

  return (
    <nav className="border-b px-6 py-3 flex items-center gap-1 bg-white">
      <span className="text-sm font-medium text-gray-800 mr-4">Clarice</span>
      {links.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
            path === href
              ? 'bg-gray-100 text-gray-900 font-medium'
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          {label}
        </Link>
      ))}
      <div className="ml-auto flex items-center gap-3">
        {email && (
          <span className="text-xs text-gray-400 hidden sm:block">{email}</span>
        )}
        <button
          onClick={sair}
          className="text-xs border rounded-lg px-3 py-1.5 text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors"
        >
          Sair
        </button>
      </div>
    </nav>
  )
}
