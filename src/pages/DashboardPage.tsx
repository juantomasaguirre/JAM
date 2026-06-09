import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabase'
import { getMonthlyAvgMep, convert, formatAmount, lastDayOfMonth } from '../lib/fx'
import NavBar from '../components/NavBar'
import BottomNav from '../components/BottomNav'

interface Movement {
  id: string
  kind: 'expense' | 'income'
  scope: 'individual' | 'shared' | 'loan'
  amount: number
  currency: 'ARS' | 'USD'
  paid_by: string | null
  category_id: string | null
  categories: { name: string } | null
}

interface Profile {
  id: string
  display_name: string
}

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const CHART_COLORS = [
  '#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6',
]

export default function DashboardPage() {
  const navigate = useNavigate()
  const now = new Date()

  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [displayCurrency, setDisplayCurrency] = useState<'ARS' | 'USD'>('ARS')
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar')

  const [movements, setMovements] = useState<Movement[]>([])
  const [avgMepRate, setAvgMepRate] = useState<number | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)

      const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`
      const dateTo = lastDayOfMonth(year, month)

      const [movResult, ratesResult, profilesResult, userResult] = await Promise.all([
        supabase
          .from('movements')
          .select('id, kind, scope, amount, currency, paid_by, category_id, categories(name)')
          .gte('occurred_on', dateFrom)
          .lte('occurred_on', dateTo),
        supabase
          .from('fx_rates')
          .select('sell')
          .eq('dollar_type', 'mep')
          .gte('rate_date', dateFrom)
          .lte('rate_date', dateTo),
        supabase.from('profiles').select('id, display_name'),
        supabase.auth.getUser(),
      ])

      let mepAvg = getMonthlyAvgMep(ratesResult.data ?? [])

      // Carry-forward: if no rates this month, use the most recent prior rate
      if (mepAvg === null) {
        const { data: prior } = await supabase
          .from('fx_rates')
          .select('sell')
          .eq('dollar_type', 'mep')
          .lt('rate_date', dateFrom)
          .order('rate_date', { ascending: false })
          .limit(1)
          .single()
        mepAvg = prior?.sell ?? null
      }

      setMovements((movResult.data as unknown as Movement[]) ?? [])
      setAvgMepRate(mepAvg)
      setProfiles(profilesResult.data ?? [])
      setCurrentUserId(userResult.data.user?.id ?? '')
      setLoading(false)
    }
    load()
  }, [year, month])

  function toDisplay(amount: number, currency: 'ARS' | 'USD'): number {
    return convert(amount, currency, displayCurrency, avgMepRate) ?? amount
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  function goMonth(dir: -1 | 1) {
    let m = month + dir
    let y = year
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    setYear(y)
    setMonth(m)
  }

  // Totals
  const totalExpenses = movements
    .filter((m) => m.kind === 'expense')
    .reduce((sum, m) => sum + toDisplay(m.amount, m.currency), 0)

  const totalIncome = movements
    .filter((m) => m.kind === 'income')
    .reduce((sum, m) => sum + toDisplay(m.amount, m.currency), 0)

  const balance = totalIncome - totalExpenses

  // Shared balance: positive = other owes me, negative = I owe other
  const otherUser = profiles.find((p) => p.id !== currentUserId)
  let sharedBalance = 0
  const hasSharedMovements = movements.some((m) => m.scope === 'shared' || m.scope === 'loan')

  movements
    .filter((m) => m.scope === 'shared' || m.scope === 'loan')
    .forEach((m) => {
      const val = toDisplay(m.amount, m.currency)
      // loan: payer is owed 100%; shared: payer is owed 50%
      const share = m.scope === 'loan' ? val : val / 2
      if (m.paid_by === currentUserId) sharedBalance += share
      else sharedBalance -= share
    })

  // Category breakdown (expenses only)
  const catMap: Record<string, { value: number; id: string | null }> = {}
  movements
    .filter((m) => m.kind === 'expense')
    .forEach((m) => {
      const name = m.categories?.name ?? 'Sin categoría'
      if (!catMap[name]) catMap[name] = { value: 0, id: m.category_id }
      catMap[name].value += toDisplay(m.amount, m.currency)
    })

  const categoryData = Object.entries(catMap)
    .sort(([, a], [, b]) => b.value - a.value)
    .map(([name, { value, id }]) => ({ name, value, id }))

  const maxCatValue = categoryData[0]?.value || 1

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <NavBar
        title="Dashboard"
        right={
          <button
            onClick={() => setDisplayCurrency((c) => (c === 'ARS' ? 'USD' : 'ARS'))}
            className="text-xs font-semibold bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg"
          >
            {displayCurrency}
          </button>
        }
      />

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Month selector */}
        <div className="flex items-center justify-between">
          <button onClick={() => goMonth(-1)} className="p-2 text-gray-500 hover:text-gray-800 text-lg">
            ←
          </button>
          <span className="text-base font-semibold text-gray-900">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button
            onClick={() => goMonth(1)}
            disabled={isCurrentMonth}
            className="p-2 text-gray-500 hover:text-gray-800 disabled:opacity-30 text-lg"
          >
            →
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center pt-8 text-gray-400 text-sm">Cargando…</div>
        ) : (
          <>
            {/* Summary card */}
            <div className="bg-white rounded-2xl p-4 space-y-3 shadow-sm">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Gastos</span>
                <span className="text-sm font-semibold text-red-500">
                  − {formatAmount(totalExpenses, displayCurrency)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Ingresos</span>
                <span className="text-sm font-semibold text-green-600">
                  + {formatAmount(totalIncome, displayCurrency)}
                </span>
              </div>
              <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-700">Balance</span>
                <span className={`text-sm font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {balance >= 0 ? '+' : ''}{formatAmount(balance, displayCurrency)}
                </span>
              </div>
            </div>

            {/* Shared balance card */}
            {hasSharedMovements && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Saldo compartido
                </p>
                {Math.abs(sharedBalance) < 1 ? (
                  <p className="text-sm text-gray-600 font-medium">Están al día ✓</p>
                ) : sharedBalance > 0 ? (
                  <p className="text-sm text-gray-900">
                    <span className="font-semibold">{otherUser?.display_name}</span>
                    {' te debe '}
                    <span className="font-bold text-green-600">
                      {formatAmount(sharedBalance, displayCurrency)}
                    </span>
                  </p>
                ) : (
                  <p className="text-sm text-gray-900">
                    {'Le debés '}
                    <span className="font-bold text-red-500">
                      {formatAmount(Math.abs(sharedBalance), displayCurrency)}
                    </span>
                    {' a '}
                    <span className="font-semibold">{otherUser?.display_name}</span>
                  </p>
                )}
              </div>
            )}

            {/* Category breakdown */}
            {categoryData.length > 0 ? (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Gastos por categoría
                  </p>
                  <div className="flex rounded-lg overflow-hidden border border-gray-200">
                    {(['bar', 'pie'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setChartType(t)}
                        className={`px-3 py-1 text-xs font-medium transition-colors ${
                          chartType === t
                            ? 'bg-gray-800 text-white'
                            : 'text-gray-400 hover:bg-gray-50'
                        }`}
                      >
                        {t === 'bar' ? 'Barras' : 'Torta'}
                      </button>
                    ))}
                  </div>
                </div>

                {chartType === 'bar' ? (
                  <div className="space-y-3">
                    {categoryData.map(({ name, value, id }) => (
                      <button
                        key={name}
                        onClick={() =>
                          id &&
                          navigate(
                            `/dashboard/categories/${id}?name=${encodeURIComponent(name)}`,
                          )
                        }
                        className="w-full text-left group"
                      >
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-gray-700 font-medium truncate mr-2 group-hover:text-blue-600 transition-colors">
                            {name}
                          </span>
                          <span className="text-gray-500 whitespace-nowrap">
                            {formatAmount(value, displayCurrency)}
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${(value / maxCatValue) * 100}%` }}
                          />
                        </div>
                      </button>
                    ))}
                    <p className="text-xs text-gray-300 pt-1">Tocá una categoría para ver su evolución</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={categoryData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        onClick={(_, index) => {
                          const item = categoryData[index]
                          if (item?.id) {
                            navigate(
                              `/dashboard/categories/${item.id}?name=${encodeURIComponent(item.name)}`,
                            )
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {categoryData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val) => formatAmount(val as number, displayCurrency)}
                      />
                      <Legend
                        formatter={(value) =>
                          value.length > 18 ? value.slice(0, 16) + '…' : value
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            ) : (
              <p className="text-center text-sm text-gray-400 pt-4">
                Sin gastos registrados este mes.
              </p>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
