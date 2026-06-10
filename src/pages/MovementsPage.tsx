import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCategoryColor } from '../lib/categoryColors'
import NavBar from '../components/NavBar'
import BottomNav from '../components/BottomNav'

interface Category {
  id: string
  name: string
}

interface Movement {
  id: string
  kind: 'expense' | 'income'
  scope: 'individual' | 'shared' | 'loan'
  description: string
  amount: number
  currency: 'ARS' | 'USD'
  occurred_on: string
  category_id: string | null
  categories: { name: string } | null
}

const SCOPE_LABEL: Record<Movement['scope'], string> = {
  individual: 'Mío',
  shared: 'Nuestro',
  loan: 'Préstamo',
}

const SCOPE_TEXT_COLOR: Record<Movement['scope'], string> = {
  individual: '#6B7280',
  shared: '#16a34a',
  loan: '#d97706',
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
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [filterCategory, setFilterCategory] = useState(searchParams.get('category') ?? '')
  const [filterCurrency, setFilterCurrency] = useState<'all' | 'ARS' | 'USD'>('all')
  const [filterFrom, setFilterFrom] = useState(searchParams.get('from') ?? '')
  const [filterTo, setFilterTo] = useState(searchParams.get('to') ?? '')
  const [showFilters, setShowFilters] = useState(
    Boolean(searchParams.get('category') || searchParams.get('from') || searchParams.get('to'))
  )

  const activeFiltersCount = [
    filterCategory !== '',
    filterCurrency !== 'all',
    filterFrom !== '',
    filterTo !== '',
  ].filter(Boolean).length

  useEffect(() => {
    async function load() {
      const [movResult, catsResult] = await Promise.all([
        supabase
          .from('movements')
          .select('id, kind, scope, description, amount, currency, occurred_on, category_id, categories(name)')
          .order('occurred_on', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('categories')
          .select('id, name')
          .eq('is_archived', false)
          .order('name'),
      ])
      if (movResult.data) setMovements(movResult.data as unknown as Movement[])
      if (catsResult.data) setCategories(catsResult.data)
      setLoading(false)
    }
    load()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  function clearFilters() {
    setFilterCategory('')
    setFilterCurrency('all')
    setFilterFrom('')
    setFilterTo('')
  }

  const filtered = movements.filter((m) => {
    if (filterCategory && m.category_id !== filterCategory) return false
    if (filterCurrency !== 'all' && m.currency !== filterCurrency) return false
    if (filterFrom && m.occurred_on < filterFrom) return false
    if (filterTo && m.occurred_on > filterTo) return false
    return true
  })

  const grouped = groupByDate(filtered)

  return (
    <div className="min-h-screen bg-surface pb-16">
      <NavBar
        title="Movimientos"
        right={
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters((v) => !v)}
              aria-label="Filtrar"
              className="relative text-white/70 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M3.792 2.938A49.069 49.069 0 0112 2.25c2.797 0 5.54.236 8.209.688a1.857 1.857 0 011.541 1.836v1.044a3 3 0 01-.879 2.121l-6.182 6.182a1.5 1.5 0 00-.439 1.061v2.927a3 3 0 01-1.658 2.684l-1.5.75a3 3 0 01-4.342-2.684V15.19a1.5 1.5 0 00-.44-1.061L3.879 7.898A3 3 0 013 5.778V4.714c0-.9.630-1.683 1.792-1.776z" clipRule="evenodd" />
              </svg>
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate('/import')}
              aria-label="Importar CSV"
              className="text-white/70 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M11.47 2.47a.75.75 0 011.06 0l4.5 4.5a.75.75 0 01-1.06 1.06l-3.22-3.22V16.5a.75.75 0 01-1.5 0V4.81L8.03 8.03a.75.75 0 01-1.06-1.06l4.5-4.5zM3 15.75a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={() => navigate('/movements/new')}
              className="text-white text-2xl font-light leading-none pb-0.5"
              aria-label="Nuevo movimiento"
            >
              +
            </button>
          </div>
        }
      />

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-card border-b border-border px-4 py-3 space-y-3">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full border border-border rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary bg-card"
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <div className="flex gap-2">
            {(['all', 'ARS', 'USD'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setFilterCurrency(c)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                  filterCurrency === c
                    ? 'bg-primary text-white border-primary'
                    : 'bg-card text-gray-500 border-border'
                }`}
              >
                {c === 'all' ? 'Todas' : c}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <p className="text-xs text-gray-400">Desde</p>
              <input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary bg-card"
              />
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-xs text-gray-400">Hasta</p>
              <input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary bg-card"
              />
            </div>
          </div>

          {activeFiltersCount > 0 && (
            <button
              onClick={clearFilters}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center pt-16 text-gray-400 text-sm">Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center pt-16 gap-3">
          {movements.length === 0 ? (
            <>
              <p className="text-gray-400 text-sm">Sin movimientos todavía.</p>
              <button
                onClick={() => navigate('/movements/new')}
                className="text-primary text-sm font-medium"
              >
                Agregar el primero
              </button>
            </>
          ) : (
            <p className="text-gray-400 text-sm">Ningún movimiento coincide con los filtros.</p>
          )}
        </div>
      ) : (
        <div className="pb-10">
          {grouped.map(([date, items]) => (
            <div key={date}>
              <div className="px-4 py-2 bg-sand text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {formatDate(date)}
              </div>
              {items.map((m) => (
                <button
                  key={m.id}
                  onClick={() => navigate(`/movements/${m.id}/edit`)}
                  className="w-full bg-card border-b border-sand px-4 py-3 flex items-center justify-between text-left active:bg-sand"
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.description}</p>
                    <p className="mt-1">
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: getCategoryColor(m.categories?.name) + '26' }}
                      >
                        <span style={{ color: getCategoryColor(m.categories?.name) }}>
                          {m.categories?.name ?? 'Sin categoría'}
                        </span>
                        <span style={{ color: getCategoryColor(m.categories?.name) }}>·</span>
                        <span style={{ color: SCOPE_TEXT_COLOR[m.scope] }}>
                          {SCOPE_LABEL[m.scope]}
                        </span>
                      </span>
                    </p>
                  </div>
                  <span
                    className={`text-sm font-semibold whitespace-nowrap ${
                      m.kind === 'expense' ? 'text-negative' : 'text-green-600'
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
