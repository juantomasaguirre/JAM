import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabase'
import { getMonthlyAvgMep, convert, formatAmount, lastDayOfMonth } from '../lib/fx'
import { getCategoryColor } from '../lib/categoryColors'
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

interface AccumulatedMovement {
  id: string
  scope: 'shared' | 'loan'
  amount: number
  currency: 'ARS' | 'USD'
  paid_by: string | null
}

interface Profile {
  id: string
  display_name: string
}

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']


function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function generateMonthOptions(): { year: number; month: number; label: string }[] {
  const options: { year: number; month: number; label: string }[] = []
  const now = new Date()
  let y = now.getFullYear()
  let m = now.getMonth() + 1
  while (y > 2025 || (y === 2025 && m >= 1)) {
    options.push({ year: y, month: m, label: `${MONTH_NAMES[m - 1]} ${y}` })
    m--
    if (m < 1) { m = 12; y-- }
  }
  return options
}

const MONTH_OPTIONS = generateMonthOptions()

export default function DashboardPage() {
  const navigate = useNavigate()
  const now = new Date()

  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [displayCurrency, setDisplayCurrency] = useState<'ARS' | 'USD'>('ARS')
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar')
  const [excludedCategories, setExcludedCategories] = useState<Set<string>>(new Set())

  function toggleCategory(name: string) {
    setExcludedCategories(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  // Monthly data
  const [movements, setMovements] = useState<Movement[]>([])
  const [avgMepRate, setAvgMepRate] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  // Accumulated balance data (loaded once, refreshed after settlement)
  const [allSharedMovements, setAllSharedMovements] = useState<AccumulatedMovement[]>([])
  const [latestMepRate, setLatestMepRate] = useState<number | null>(null)
  const [liquidacionesIds, setLiquidacionesIds] = useState<{ expense: string | null; income: string | null }>({ expense: null, income: null })
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [householdId, setHouseholdId] = useState('')
  const [allLoading, setAllLoading] = useState(true)
  const [settling, setSettling] = useState(false)
  const [settleError, setSettleError] = useState('')

  useEffect(() => {
    async function loadAccumulated() {
      const [sharedResult, rateResult, catsResult, profilesResult, userResult] = await Promise.all([
        supabase
          .from('movements')
          .select('id, scope, amount, currency, paid_by')
          .in('scope', ['shared', 'loan']),
        supabase
          .from('fx_rates')
          .select('sell')
          .eq('dollar_type', 'mep')
          .order('rate_date', { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from('categories')
          .select('id, kind')
          .eq('name', 'Liquidaciones'),
        supabase.from('profiles').select('id, display_name, household_id'),
        supabase.auth.getUser(),
      ])

      if (sharedResult.data) setAllSharedMovements(sharedResult.data as unknown as AccumulatedMovement[])
      setLatestMepRate(rateResult.data?.sell ?? null)

      const expCat = catsResult.data?.find((c: { kind: string }) => c.kind === 'expense')
      const incCat = catsResult.data?.find((c: { kind: string }) => c.kind === 'income')
      setLiquidacionesIds({ expense: expCat?.id ?? null, income: incCat?.id ?? null })

      const uid = userResult.data.user?.id ?? ''
      if (profilesResult.data) {
        setProfiles(profilesResult.data.map(({ id, display_name }: { id: string; display_name: string }) => ({ id, display_name })))
        const me = (profilesResult.data as { id: string; household_id: string }[]).find((p) => p.id === uid)
        if (me) setHouseholdId(me.household_id)
      }
      setCurrentUserId(uid)
      setAllLoading(false)
    }
    loadAccumulated()
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)

      const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`
      const dateTo = lastDayOfMonth(year, month)

      const [movResult, ratesResult] = await Promise.all([
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
      ])

      let mepAvg = getMonthlyAvgMep(ratesResult.data ?? [])

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
      setLoading(false)
    }
    load()
  }, [year, month, refreshKey])

  function toDisplay(amount: number, currency: 'ARS' | 'USD'): number {
    return convert(amount, currency, displayCurrency, avgMepRate) ?? amount
  }

  const otherUser = profiles.find((p) => p.id !== currentUserId)

  let accumulatedBalance = 0
  for (const m of allSharedMovements) {
    const val = convert(m.amount, m.currency, displayCurrency, latestMepRate) ?? m.amount
    const share = m.scope === 'loan' ? val : val / 2
    if (m.paid_by === currentUserId) accumulatedBalance += share
    else accumulatedBalance -= share
  }

  async function handleSettle() {
    if (settling || Math.abs(accumulatedBalance) < 1 || !householdId || !otherUser) return
    setSettling(true)
    setSettleError('')

    const isOwing = accumulatedBalance < 0
    const absBalance = Math.abs(accumulatedBalance)
    const settlePaidBy = isOwing ? currentUserId : otherUser.id
    const settleKind: 'expense' | 'income' = isOwing ? 'expense' : 'income'
    const settleCategoryId = isOwing ? liquidacionesIds.expense : liquidacionesIds.income

    const { error } = await supabase.from('movements').insert({
      household_id: householdId,
      created_by: currentUserId,
      owner_id: currentUserId,
      scope: 'loan',
      kind: settleKind,
      category_id: settleCategoryId,
      description: 'Saldo de deuda',
      amount: Math.round(absBalance * 100) / 100,
      currency: displayCurrency,
      occurred_on: localToday(),
      paid_by: settlePaidBy,
    })

    if (error) {
      setSettleError(error.message)
      setSettling(false)
      return
    }

    const { data } = await supabase
      .from('movements')
      .select('id, scope, amount, currency, paid_by')
      .in('scope', ['shared', 'loan'])
    if (data) setAllSharedMovements(data as unknown as AccumulatedMovement[])

    setRefreshKey((k) => k + 1)
    setSettling(false)
  }

  // Category breakdown (expenses only, all categories for bar chart)
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

  // Monthly totals (excluded categories don't count)
  const totalExpenses = movements
    .filter((m) => m.kind === 'expense' && !excludedCategories.has(m.categories?.name ?? 'Sin categoría'))
    .reduce((sum, m) => sum + toDisplay(m.amount, m.currency), 0)

  const totalIncome = movements
    .filter((m) => m.kind === 'income')
    .reduce((sum, m) => sum + toDisplay(m.amount, m.currency), 0)

  const balance = totalIncome - totalExpenses

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

        {/* Accumulated shared balance */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Saldo compartido
          </p>
          {allLoading ? (
            <p className="text-sm text-gray-400">Cargando…</p>
          ) : Math.abs(accumulatedBalance) < 1 ? (
            <p className="text-sm text-gray-600 font-medium">Están al día ✓</p>
          ) : accumulatedBalance > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-900">
                <span className="font-semibold">{otherUser?.display_name}</span>
                {' te debe '}
                <span className="font-bold text-green-600">
                  {formatAmount(accumulatedBalance, displayCurrency)}
                </span>
              </p>
              <button
                onClick={handleSettle}
                disabled={settling}
                className="w-full bg-green-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 active:opacity-80 transition-opacity"
              >
                {settling ? 'Registrando…' : 'Saldar deuda'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-900">
                {'Le debés '}
                <span className="font-bold text-red-500">
                  {formatAmount(Math.abs(accumulatedBalance), displayCurrency)}
                </span>
                {' a '}
                <span className="font-semibold">{otherUser?.display_name}</span>
              </p>
              <button
                onClick={handleSettle}
                disabled={settling}
                className="w-full bg-red-500 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 active:opacity-80 transition-opacity"
              >
                {settling ? 'Registrando…' : 'Saldar deuda'}
              </button>
            </div>
          )}
          {settleError && <p className="text-xs text-red-500 mt-1">{settleError}</p>}
        </div>

        {/* Month selector */}
        <div className="flex justify-center">
          <select
            value={`${year}-${month}`}
            onChange={(e) => {
              const [y, m] = e.target.value.split('-').map(Number)
              setYear(y)
              setMonth(m)
            }}
            className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
          >
            {MONTH_OPTIONS.map(({ year: y, month: m, label }) => (
              <option key={`${y}-${m}`} value={`${y}-${m}`}>{label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center pt-8 text-gray-400 text-sm">Cargando…</div>
        ) : (
          <>
            {/* Monthly summary */}
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
                    {categoryData.map(({ name, value, id }) => {
                      const excluded = excludedCategories.has(name)
                      const color = getCategoryColor(name)
                      return (
                        <div key={name} className="flex items-start gap-2">
                          <button
                            onClick={() => toggleCategory(name)}
                            className="mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors"
                            style={excluded
                              ? { borderColor: '#D1D5DB', backgroundColor: 'white' }
                              : { borderColor: color, backgroundColor: color }
                            }
                            aria-label={excluded ? `Incluir ${name}` : `Excluir ${name}`}
                          >
                            {!excluded && (
                              <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                                <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => id && navigate(`/dashboard/categories/${id}?name=${encodeURIComponent(name)}`)}
                            className="flex-1 min-w-0 text-left"
                          >
                            <div className="flex justify-between text-xs mb-1.5">
                              <span className={`font-medium truncate mr-2 transition-colors ${excluded ? 'text-gray-300' : 'text-gray-700'}`}>
                                {name}
                              </span>
                              <span className={`whitespace-nowrap ${excluded ? 'text-gray-300' : 'text-gray-500'}`}>
                                {formatAmount(value, displayCurrency)}
                              </span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${(value / maxCatValue) * 100}%`, backgroundColor: excluded ? '#D1D5DB' : color }}
                              />
                            </div>
                          </button>
                        </div>
                      )
                    })}
                    <p className="text-xs text-gray-300 pt-1">Tocá una categoría para ver su evolución</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={categoryData.filter(({ name }) => !excludedCategories.has(name))}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={({ percent }: { percent?: number }) =>
                          (percent ?? 0) >= 0.05 ? `${((percent ?? 0) * 100).toFixed(0)}%` : ''
                        }
                        labelLine={false}
                        onClick={(_, index) => {
                          const included = categoryData.filter(({ name }) => !excludedCategories.has(name))
                          const item = included[index]
                          if (item?.id) {
                            navigate(`/dashboard/categories/${item.id}?name=${encodeURIComponent(item.name)}`)
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {categoryData.filter(({ name }) => !excludedCategories.has(name)).map((entry, i) => (
                          <Cell key={i} fill={getCategoryColor(entry.name)} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val) => formatAmount(val as number, displayCurrency)} />
                      <Legend
                        content={() => (
                          <div className="flex flex-wrap justify-center gap-2 mt-3">
                            {categoryData.map(({ name }) => {
                              const excluded = excludedCategories.has(name)
                              const color = getCategoryColor(name)
                              return (
                                <button
                                  key={name}
                                  onClick={() => toggleCategory(name)}
                                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
                                  style={{
                                    backgroundColor: excluded ? '#F3F4F6' : color + '26',
                                    color: excluded ? '#D1D5DB' : color,
                                  }}
                                >
                                  <span
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: excluded ? '#D1D5DB' : color }}
                                  />
                                  {name.length > 18 ? name.slice(0, 16) + '…' : name}
                                </button>
                              )
                            })}
                          </div>
                        )}
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
