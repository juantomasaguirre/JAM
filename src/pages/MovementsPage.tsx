import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import NavBar from '../components/NavBar'
import BottomNav from '../components/BottomNav'

interface Movement {
  id: string
  kind: 'expense' | 'income'
  scope: 'individual' | 'shared' | 'loan'
  description: string
  amount: number
  currency: 'ARS' | 'USD'
  occurred_on: string
  categories: { name: string } | null
}

const SCOPE_LABEL: Record<Movement['scope'], string> = {
  individual: 'Mío',
  shared: 'Nuestro',
  loan: 'Préstamo',
}

const SCOPE_COLOR: Record<Movement['scope'], string> = {
  individual: 'text-gray-400',
  shared: 'text-blue-500',
  loan: 'text-amber-500',
}

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDate(dateStr: string): string {
  const today = localToday()
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const yesterday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  if (dateStr === today) return 'Hoy'
  if (dateStr === yesterday) return 'Ayer'

  // parse at noon to avoid timezone shifts
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatAmount(amount: number, currency: 'ARS' | 'USD'): string {
  const num = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
  return currency === 'ARS' ? `$ ${num}` : `U$S ${num}`
}

function groupByDate(movements: Movement[]): [string, Movement[]][] {
  const map = new Map<string, Movement[]>()
  for (const m of movements) {
    const group = map.get(m.occurred_on) ?? []
    map.set(m.occurred_on, [...group, m])
  }
  return Array.from(map.entries())
}

export default function MovementsPage() {
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('movements')
        .select('id, kind, scope, description, amount, currency, occurred_on, categories(name)')
        .order('occurred_on', { ascending: false })
        .order('created_at', { ascending: false })

      if (data) setMovements(data as unknown as Movement[])
      setLoading(false)
    }
    load()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  const grouped = groupByDate(movements)

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <NavBar
        title="Movimientos"
        right={
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/import')}
              aria-label="Importar CSV"
              className="text-gray-400 hover:text-gray-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M11.47 2.47a.75.75 0 011.06 0l4.5 4.5a.75.75 0 01-1.06 1.06l-3.22-3.22V16.5a.75.75 0 01-1.5 0V4.81L8.03 8.03a.75.75 0 01-1.06-1.06l4.5-4.5zM3 15.75a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={() => navigate('/movements/new')}
              className="text-blue-600 text-2xl font-light leading-none pb-0.5"
              aria-label="Nuevo movimiento"
            >
              +
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center pt-16 text-gray-400 text-sm">Cargando…</div>
      ) : movements.length === 0 ? (
        <div className="flex flex-col items-center pt-16 gap-3">
          <p className="text-gray-400 text-sm">Sin movimientos todavía.</p>
          <button
            onClick={() => navigate('/movements/new')}
            className="text-blue-600 text-sm font-medium"
          >
            Agregar el primero
          </button>
        </div>
      ) : (
        <div className="pb-10">
          {grouped.map(([date, items]) => (
            <div key={date}>
              <div className="px-4 py-2 bg-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {formatDate(date)}
              </div>
              {items.map((m) => (
                <button
                  key={m.id}
                  onClick={() => navigate(`/movements/${m.id}/edit`)}
                  className="w-full bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between text-left active:bg-gray-50"
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.description}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {m.categories?.name ?? 'Sin categoría'}
                      {' · '}
                      <span className={SCOPE_COLOR[m.scope]}>
                        {SCOPE_LABEL[m.scope]}
                      </span>
                    </p>
                  </div>
                  <span
                    className={`text-sm font-semibold whitespace-nowrap ${
                      m.kind === 'expense' ? 'text-red-500' : 'text-green-600'
                    }`}
                  >
                    {m.kind === 'expense' ? '−' : '+'} {formatAmount(m.amount, m.currency)}
                  </span>
                </button>
              ))}
            </div>
          ))}

          <div className="px-4 pt-8">
            <button
              onClick={handleLogout}
              className="text-xs text-gray-300 hover:text-gray-500 transition-colors"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
