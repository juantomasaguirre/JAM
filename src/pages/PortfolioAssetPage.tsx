import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import NavBar from '../components/NavBar'

interface PortfolioTransaction {
  id: string
  transaction_type: 'buy' | 'sell' | 'dividend' | 'coupon'
  occurred_on: string
  quantity: number | null
  price_per_unit: number | null
  total_amount: number
  exchange_rate: number | null
  notes: string | null
}

interface PortfolioAsset {
  id: string
  name: string
  asset_type: string
  currency: 'ARS' | 'USD'
  is_closed: boolean
  portfolio_transactions: PortfolioTransaction[]
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  stock: 'Acción',
  bond: 'Bono',
  etf: 'ETF',
  on: 'ON',
  other: 'Otro',
}

const TX_CONFIG: Record<string, { label: string; color: string }> = {
  buy: { label: 'Compra', color: 'text-green-700 bg-green-100' },
  sell: { label: 'Venta', color: 'text-red-700 bg-red-100' },
  dividend: { label: 'Dividendo', color: 'text-blue-700 bg-blue-100' },
  coupon: { label: 'Cupón', color: 'text-yellow-700 bg-yellow-100' },
}

function fmtAmount(amount: number, currency: 'ARS' | 'USD'): string {
  const n = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
  return currency === 'ARS' ? `$ ${n}` : `U$S ${n}`
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtNum(n: number): string {
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 6 }).format(n)
}

function convertAmount(
  amount: number,
  from: 'ARS' | 'USD',
  to: 'ARS' | 'USD',
  txRate: number | null,
  fallback: number | null,
): number | null {
  if (from === to) return amount
  const rate = txRate ?? fallback
  if (rate === null) return null
  return from === 'USD' ? amount * rate : amount / rate
}

export default function PortfolioAssetPage() {
  const { assetId } = useParams<{ assetId: string }>()
  const navigate = useNavigate()

  const [asset, setAsset] = useState<PortfolioAsset | null>(null)
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([])
  const [fallbackRate, setFallbackRate] = useState<number | null>(null)
  const [displayCurrency, setDisplayCurrency] = useState<'ARS' | 'USD'>('ARS')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: assetData }, { data: rateData }] = await Promise.all([
        supabase
          .from('portfolio_assets')
          .select('*, portfolio_transactions(*)')
          .eq('id', assetId!)
          .single(),
        supabase
          .from('fx_rates')
          .select('sell')
          .eq('dollar_type', 'mep')
          .order('rate_date', { ascending: false })
          .limit(1)
          .single(),
      ])

      if (assetData) {
        setAsset(assetData)
        setDisplayCurrency(assetData.currency)
        const sorted = [...(assetData.portfolio_transactions ?? [])].sort(
          (a, b) => new Date(b.occurred_on).getTime() - new Date(a.occurred_on).getTime(),
        )
        setTransactions(sorted)
      }
      setFallbackRate(rateData?.sell ?? null)
      setLoading(false)
    }
    load()
  }, [assetId])

  if (loading || !asset) {
    return (
      <div className="min-h-screen bg-surface">
        <NavBar title="Activo" backTo="/finances?tab=portfolio" />
        <div className="flex justify-center pt-16 text-gray-400 text-sm">Cargando…</div>
      </div>
    )
  }

  // P&L calculation
  let totalInvested = 0
  let totalReceived = 0
  let hasConversionWarning = false

  for (const tx of transactions) {
    const converted = convertAmount(tx.total_amount, asset.currency, displayCurrency, tx.exchange_rate, fallbackRate)
    if (converted === null) {
      hasConversionWarning = true
      continue
    }
    if (tx.transaction_type === 'buy') totalInvested += converted
    else totalReceived += converted
  }

  const net = totalReceived - totalInvested
  const returnPct = totalInvested > 0 ? (net / totalInvested) * 100 : null
  const hasTransactions = transactions.length > 0

  const defaultIncomeType =
    asset.asset_type === 'bond' || asset.asset_type === 'on' ? 'coupon' : 'dividend'

  return (
    <div className="min-h-screen bg-surface pb-8">
      <NavBar
        title={asset.name}
        backTo="/finances?tab=portfolio"
        right={
          <button
            onClick={() => navigate(`/finances/portfolio/${assetId}/transactions/new`)}
            className="text-white text-2xl font-light leading-none pb-0.5"
            aria-label="Nueva operación"
          >
            +
          </button>
        }
      />

      <div className="p-4 space-y-4 max-w-lg mx-auto">

        {/* Asset meta */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 bg-sand px-2.5 py-1 rounded-full">
            {ASSET_TYPE_LABELS[asset.asset_type] ?? asset.asset_type}
          </span>
          <span className="text-xs text-gray-400">{asset.currency}</span>
          {asset.is_closed && (
            <span className="text-xs font-semibold text-gray-400 bg-sand px-2.5 py-1 rounded-full">
              Cerrada
            </span>
          )}
        </div>

        {/* P&L summary card */}
        {hasTransactions && (
          <div className="bg-card rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Resultado</p>
              <button
                onClick={() => setDisplayCurrency((c) => (c === 'ARS' ? 'USD' : 'ARS'))}
                className="text-xs font-semibold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg"
              >
                {displayCurrency}
              </button>
            </div>

            {hasConversionWarning && (
              <p className="text-xs text-yellow-600">
                Algunas operaciones no tienen tipo de cambio y no se incluyen en la conversión.
              </p>
            )}

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Invertido</span>
                <span className="font-semibold text-gray-900">
                  {fmtAmount(totalInvested, displayCurrency)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Cobrado</span>
                <span className="font-semibold text-gray-900">
                  {fmtAmount(totalReceived, displayCurrency)}
                </span>
              </div>
              <div className="border-t border-gray-100 pt-2 flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-700">Resultado neto</span>
                <div className="text-right">
                  <span className={`text-sm font-bold ${net >= 0 ? 'text-green-600' : 'text-negative'}`}>
                    {net >= 0 ? '+' : ''}{fmtAmount(net, displayCurrency)}
                  </span>
                  {returnPct !== null && (
                    <p className={`text-xs ${net >= 0 ? 'text-green-600' : 'text-negative'}`}>
                      {net >= 0 ? '+' : ''}{returnPct.toFixed(1)}%
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Transactions list */}
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center pt-8 gap-3">
            <p className="text-gray-400 text-sm">Sin operaciones registradas.</p>
            <button
              onClick={() => navigate(`/finances/portfolio/${assetId}/transactions/new`)}
              className="text-primary text-sm font-medium"
            >
              Registrar la primera
            </button>
          </div>
        ) : (
          <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
            <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-sand">
              Operaciones
            </p>
            {transactions.map((tx, i) => {
              const cfg = TX_CONFIG[tx.transaction_type]
              const isBuySell = tx.transaction_type === 'buy' || tx.transaction_type === 'sell'
              return (
                <button
                  key={tx.id}
                  onClick={() => navigate(`/finances/portfolio/${assetId}/transactions/${tx.id}/edit`)}
                  className={`w-full px-4 py-3 flex items-start justify-between text-left active:bg-sand ${
                    i < transactions.length - 1 ? 'border-b border-sand' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <span className="text-xs text-gray-400">{fmtDate(tx.occurred_on)}</span>
                    </div>
                    {isBuySell && tx.quantity != null && tx.price_per_unit != null && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {fmtNum(tx.quantity)} × {fmtAmount(tx.price_per_unit, asset.currency)}
                      </p>
                    )}
                    {tx.notes && (
                      <p className="text-xs text-gray-300 mt-0.5 truncate">{tx.notes}</p>
                    )}
                  </div>
                  <p className={`text-sm font-semibold shrink-0 ${
                    tx.transaction_type === 'buy' ? 'text-negative' : 'text-green-600'
                  }`}>
                    {tx.transaction_type === 'buy' ? '−' : '+'}{fmtAmount(tx.total_amount, asset.currency)}
                  </p>
                </button>
              )
            })}
          </div>
        )}

        {/* Quick income button */}
        {!asset.is_closed && (
          <button
            onClick={() =>
              navigate(`/finances/portfolio/${assetId}/transactions/new?type=${defaultIncomeType}`)
            }
            className="w-full bg-card border border-border rounded-xl py-3 text-sm font-semibold text-gray-600 hover:bg-sand transition-colors"
          >
            Registrar cobro ({defaultIncomeType === 'coupon' ? 'cupón' : 'dividendo'})
          </button>
        )}

        {/* Edit asset link */}
        <button
          onClick={() => navigate(`/finances/portfolio/${assetId}/edit`)}
          className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Editar activo
        </button>
      </div>
    </div>
  )
}
