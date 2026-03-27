'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

type Resumo = {
  emprestados: number; renovados: number; atrasados: number
  devolvidos_mes: number; total_mes: number; alunos_ativos: number
}
type PorTurma        = { turma: string; total: number }
type LivroTop        = { titulo: string; autor: string; total: number }
type AtrasadoPorTurma = { turma: string; total: number }
type Periodo         = 'mes' | 'mes_passado' | 'ano'

function fmt(d: string) {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('pt-BR')
}

function periodoLabel(p: Periodo) {
  if (p === 'mes') {
    const mes = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    return mes.charAt(0).toUpperCase() + mes.slice(1)
  }
  if (p === 'mes_passado') {
    const d = new Date(); d.setMonth(d.getMonth() - 1)
    const mes = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    return mes.charAt(0).toUpperCase() + mes.slice(1)
  }
  return `Ano ${new Date().getFullYear()}`
}

export default function DashboardPage() {
  const [resumo, setResumo]       = useState<Resumo | null>(null)
  const [porTurma, setPorTurma]   = useState<PorTurma[]>([])
  const [livrosTop, setLivrosTop] = useState<LivroTop[]>([])
  const [atrasados, setAtrasados] = useState<AtrasadoPorTurma[]>([])
  const [periodo, setPeriodo]     = useState<Periodo>('mes')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro]           = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const agora = new Date()
      const ini   = (y: number, m: number, d: number) => new Date(y, m, d).toISOString().split('T')[0]
      const hoje  = ini(agora.getFullYear(), agora.getMonth(), agora.getDate())

      const dataInicio = periodo === 'mes'
        ? ini(agora.getFullYear(), agora.getMonth(), 1)
        : periodo === 'mes_passado'
          ? ini(agora.getFullYear(), agora.getMonth() - 1, 1)
          : ini(agora.getFullYear(), 0, 1)

      const dataFim = periodo === 'mes_passado'
        ? ini(agora.getFullYear(), agora.getMonth(), 0)
        : hoje

      const [r1, r2, r3, r4, r5, r6] = await Promise.all([
        supabase.from('emprestimos').select('*', { count: 'exact', head: true }).eq('status', 'EMPRESTADO'),
        supabase.from('emprestimos').select('*', { count: 'exact', head: true }).eq('status', 'RENOVADO'),
        supabase.from('vw_emprestimos_atrasados').select('*', { count: 'exact', head: true }),
        supabase.from('emprestimos').select('*', { count: 'exact', head: true }).eq('status', 'DEVOLVIDO').gte('data_saida', dataInicio).lte('data_saida', dataFim),
        supabase.from('emprestimos').select('*', { count: 'exact', head: true }).gte('data_saida', dataInicio).lte('data_saida', dataFim),
        supabase.from('alunos').select('*', { count: 'exact', head: true }).eq('ativo', true),
      ])

      setResumo({
        emprestados: r1.count ?? 0, renovados: r2.count ?? 0,
        atrasados: r3.count ?? 0, devolvidos_mes: r4.count ?? 0,
        total_mes: r5.count ?? 0, alunos_ativos: r6.count ?? 0,
      })

      // Por turma
      const { data: empTurma } = await supabase
        .from('vw_painel_aluno').select('turma').gte('data_saida', dataInicio).lte('data_saida', dataFim)

      if (empTurma) {
        const cont: Record<string, number> = {}
        empTurma.forEach(({ turma }) => { if (turma) cont[turma] = (cont[turma] ?? 0) + 1 })
        setPorTurma(Object.entries(cont).map(([turma, total]) => ({ turma, total })).sort((a, b) => b.total - a.total).slice(0, 8))
      }

      // Livros top
      const { data: empLivros } = await supabase
        .from('vw_painel_aluno').select('titulo, autor').gte('data_saida', dataInicio).lte('data_saida', dataFim)

      if (empLivros) {
        const cont: Record<string, { autor: string; total: number }> = {}
        empLivros.forEach(({ titulo, autor }) => {
          if (!titulo) return
          if (!cont[titulo]) cont[titulo] = { autor: autor ?? '', total: 0 }
          cont[titulo].total++
        })
        setLivrosTop(Object.entries(cont).map(([titulo, v]) => ({ titulo, ...v })).sort((a, b) => b.total - a.total).slice(0, 5))
      }

      // Atrasados por turma (sempre tempo real)
      const { data: atrasTurma } = await supabase.from('vw_emprestimos_atrasados').select('turma')
      if (atrasTurma) {
        const cont: Record<string, number> = {}
        atrasTurma.forEach(({ turma }) => { if (turma) cont[turma] = (cont[turma] ?? 0) + 1 })
        setAtrasados(Object.entries(cont).map(([turma, total]) => ({ turma, total })).sort((a, b) => b.total - a.total))
      }
    } catch (e: any) {
      setErro('Erro ao carregar dados. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }, [periodo])

  useEffect(() => { carregar() }, [carregar])

  const maxTurma = Math.max(...porTurma.map(t => t.total), 1)

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium">Dashboard</h1>
          <p className="text-xs text-gray-500 mt-1">{periodoLabel(periodo)}</p>
        </div>
        <div className="flex gap-2 items-center">
          {!carregando && (
            <button onClick={carregar} className="text-xs text-gray-400 hover:text-gray-600 px-2">↻ Atualizar</button>
          )}
          <select className="border rounded-lg px-3 py-2 text-sm" value={periodo} onChange={e => setPeriodo(e.target.value as Periodo)}>
            <option value="mes">Este mês</option>
            <option value="mes_passado">Mês passado</option>
            <option value="ano">Este ano</option>
          </select>
        </div>
      </div>

      {erro && (
        <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 mb-5 flex items-center justify-between">
          <span>{erro}</span>
          <button onClick={carregar} className="text-xs underline ml-4">Tentar novamente</button>
        </div>
      )}

      {carregando ? (
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl p-4 h-20 animate-pulse" />
          ))}
        </div>
      ) : resumo && (
        <>
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Empréstimos no período', valor: resumo.total_mes,                    cor: '' },
              { label: 'Pendentes de devolução', valor: resumo.emprestados + resumo.renovados, cor: '' },
              { label: 'Atrasados agora',         valor: resumo.atrasados,                   cor: resumo.atrasados > 0 ? 'r' : '' },
              { label: 'Alunos ativos',           valor: resumo.alunos_ativos,               cor: '' },
            ].map(({ label, valor, cor }) => (
              <div key={label} className={`rounded-xl p-4 ${cor === 'r' ? 'bg-red-50' : 'bg-gray-50'}`}>
                <p className={`text-2xl font-mono font-medium ${cor === 'r' ? 'text-red-700' : ''}`}>{valor}</p>
                <p className={`text-xs mt-1 ${cor === 'r' ? 'text-red-600' : 'text-gray-500'}`}>{label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-5 gap-4 mb-4">
            <div className="col-span-3 border rounded-xl p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">Empréstimos por turma</p>
              {porTurma.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">Sem dados no período</p>
              ) : porTurma.map(({ turma, total }) => (
                <div key={turma} className="flex items-center gap-3 mb-2.5">
                  <span className="text-xs text-gray-500 w-8 flex-shrink-0">{turma}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-600 rounded-full transition-all duration-700" style={{ width: `${Math.round((total / maxTurma) * 100)}%` }} />
                  </div>
                  <span className="text-xs font-mono text-gray-600 w-6 text-right flex-shrink-0">{total}</span>
                </div>
              ))}
            </div>

            <div className="col-span-2 border rounded-xl p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">Status atual</p>
              <div className="flex flex-col gap-2">
                {[
                  { label: 'Emprestados', valor: resumo.emprestados,    bg: 'bg-blue-50',   txt: 'text-blue-800' },
                  { label: 'Renovados',   valor: resumo.renovados,      bg: 'bg-purple-50', txt: 'text-purple-800' },
                  { label: 'Atrasados',   valor: resumo.atrasados,      bg: 'bg-red-50',    txt: 'text-red-800' },
                  { label: 'Devolvidos',  valor: resumo.devolvidos_mes, bg: 'bg-green-50',  txt: 'text-green-800' },
                ].map(({ label, valor, bg, txt }) => (
                  <div key={label} className={`flex items-center justify-between px-3 py-2 rounded-lg ${bg}`}>
                    <span className={`text-xs font-medium ${txt}`}>{label}</span>
                    <span className={`font-mono text-sm font-medium ${txt}`}>{valor}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="border rounded-xl p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Livros mais emprestados</p>
              {livrosTop.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">Sem dados no período</p>
              ) : livrosTop.map(({ titulo, autor, total }, i) => (
                <div key={titulo} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-none">
                  <span className="text-xs text-gray-400 font-mono w-4 flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{titulo}</p>
                    <p className="text-xs text-gray-400 truncate">{autor}</p>
                  </div>
                  <span className="text-xs font-medium bg-purple-50 text-purple-800 px-2 py-0.5 rounded-full flex-shrink-0">{total}x</span>
                </div>
              ))}
            </div>

            <div className="border rounded-xl p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Atrasados por turma</p>
              {atrasados.length === 0 ? (
                <div className="flex items-center gap-2 py-4">
                  <span className="text-green-600">✓</span>
                  <p className="text-sm text-gray-600">Nenhum empréstimo atrasado!</p>
                </div>
              ) : atrasados.map(({ turma, total }) => (
                <div key={turma} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-none">
                  <span className="text-sm font-medium">{turma}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${total >= 3 ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'}`}>
                    {total} {total === 1 ? 'aluno' : 'alunos'}
                  </span>
                </div>
              ))}
              {atrasados.length > 0 && (
                <a href="/emprestimos?status=ATRASADO" className="mt-3 block text-xs text-gray-400 hover:text-gray-600">
                  Ver lista completa →
                </a>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
