import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabase'
import { getMonthlyAvgMep, convert, formatAmount, lastDayOfMonth } from '../lib/fx'
import { getCategoryColor } from '../lib/categoryColors'
import NavBar from '../components/NavBar'

interface MonthSlot {
  year: number
  month: number
  label: string
  dateFrom: string
  dateTo: string
}

interface ChartPoint {
  label: string
  total: number
  year: number
  month: number
}

function buildMonthSlots(): MonthSlot[] {
  const now = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const dateFrom = `${y}-${String(m).padStart(2, '0')}-01`
    return {
      year: y,
      month: m,
      label: d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', ''),
      dateFrom,
      dateTo: lastDayOfMonth(y, m),
    }
  })
}

export default function CategoryEvolutionPage() {
  const { id } = useParams<{ id: string }>()

  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const categoryName = searchParams.get('name') ?? 'Categoría'

  const [displayCurrency, setDisplayCurrency] = useState<'ARS' | 'USD'>('ARS')
  const [chartData, setChartData] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!id) return
      setLoading(true)

      const slots = buildMonthSlots()
      const startDate = slots[0].dateFrom
      const endDate = slots[11].dateTo

      const [movResult, ratesResult] = await Promise.all([
        supabase
          .from('movements')
          .select('amount, currency, occurred_on, kind')
          .eq('category_id', id)
          .eq('kind', 'expense')
          .gte('occurred_on', startDate)
          .lte('occurred_on', endDate),
        supabase
          .from('fx_rates')
          .select('sell, rate_date')
          .eq('dollar_type', 'mep')
          .gte('rate_date', startDate)
          .lte('rate_date', endDate),
      ])

      const allMovements: { amount: number; currency: string; occurred_on: string }[] =
        (movResult.data as unknown as { amount: number; currency: string; occurred_on: string }[]) ?? []

      const allRates: { sell: number | null; rate_date: string }[] = ratesResult.data ?? []

      // Group rates by YYYY-MM
      const ratesByMonth: Record<string, { sell: number | null }[]> = {}
      for (const r of allRates) {
        const key = r.rate_date.slice(0, 7)
        if (!ratesByMonth[key]) ratesByMonth[key] = []
        ratesByMonth[key].push({ sell: r.sell })
      }

      // Compute per-month avg MEP with carry-forward
      let lastKnownRate: number | null = null
      const monthlyRate: Record<string, number | null> = {}
      for (const slot of slots) {
        const key = `${slot.year}-${String(slot.month).padStart(2, '0')}`
        const avg = getMonthlyAvgMep(ratesByMonth[key] ?? [])
        if (avg !== null) lastKnownRate = avg
        monthlyRate[key] = avg ?? lastKnownRate
      }

      // If no rates at all in the window, try to fetch the most recent prior rate
      if (lastKnownRate === null) {
        const { data: prior } = await supabase
          .from('fx_rates')
          .select('sell')
          .eq('dollar_type', 'mep')
          .lt('rate_date', startDate)
          .order('rate_date', { ascending: false })
          .limit(1)
          .single()
        if (prior?.sell) {
          lastKnownRate = prior.sell
          for (const key of Object.keys(monthlyRate)) {
            if (monthlyRate[key] === null) monthlyRate[key] = lastKnownRate
          }
        }
      }

      // Group movements by month and compute totals using current displayCurrency
      const totals: Record<string, number> = {}
      for (const slot of slots) {
        const key = `${slot.year}-${String(slot.month).padStart(2, '0')}`
        totals[key] = 0
      }

      for (const m of allMovements) {
        const key = m.occurred_on.slice(0, 7)
        if (!(key in totals)) continue
        const rate = monthlyRate[key] ?? null
        const converted = convert(m.amount, m.currency as 'ARS' | 'USD', displayCurrency, rate)
        totals[key] += converted ?? m.amount
      }

      setChartData(
        slots.map((slot) => ({
          label: slot.label,
          total: Math.round(totals[`${slot.year}-${String(slot.month).padStart(2, '0')}`] * 100) / 100,
          year: slot.year,
          month: slot.month,
        })),
      )

      setLoading(false)
    }
    load()
  }, [id, displayCurrency])

  const maxVal = Math.max(...chartData.map((d) => d.total), 1)

  return (
    <div className="min-h-screen bg-surface">
      <NavBar
        title={categoryName}
        showBack
        right={
          <button
            onClick={() => setDisplayCurrency((c) => (c === 'ARS' ? 'USD' : 'ARS'))}
            className="text-xs font-semibold bg-white/15 text-white px-2.5 py-1 rounded-lg"
          >
            {displayCurrency}
          </button>
        }
      />

      <div className="p-4 max-w-lg mx-auto space-y-4">
        <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">
          Últimos 12 meses · MEP promedio mensual
        </p>

        {loading ? (
          <div className="flex justify-center pt-8 text-gray-400 text-sm">Cargando…</div>
        ) : (
          <>
            <div className="bg-card rounded-2xl p-4 shadow-sm">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) =>
                      displayCurrency === 'ARS'
                        ? v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                        : String(v)
                    }
                    width={36}
                  />
                  <Tooltip
                    formatter={(val) => [formatAmount(val as number, displayCurrency), categoryName]}
                    labelStyle={{ fontSize: 12, color: '#6b7280' }}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                  />
                  <Bar dataKey="total" fill={getCategoryColor(categoryName)} radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly list */}
            <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
              {[...chartData].reverse().map(({ label, total, year, month }) => {
                const mm = String(month).padStart(2, '0')
                const from = `${year}-${mm}-01`
                const to = lastDayOfMonth(year, month)
                return (
                  <button
                    key={label}
                    onClick={() => navigate(`/movements?category=${id}&from=${from}&to=${to}`)}
                    className="w-full flex items-center justify-between px-4 py-3 border-b border-sand last:border-0 text-left active:bg-sand"
                  >
                    <span className="text-sm text-gray-600 capitalize">{label}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-1.5 bg-sand rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(total / maxVal) * 100}%`, backgroundColor: getCategoryColor(categoryName) }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-800 w-28 text-right">
                        {total > 0 ? formatAmount(total, displayCurrency) : '—'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => navigate(-1)}
              className="text-sm text-primary font-medium px-1"
            >
              ← Volver al dashboard
            </button>
          </>
        )}
      </div>
    </div>
  )
}
