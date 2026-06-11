import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import NavBar from '../components/NavBar'

type TxType = 'buy' | 'sell' | 'dividend' | 'coupon'

const TX_TYPES: { value: TxType; label: string }[] = [
  { value: 'buy', label: 'Compra' },
  { value: 'sell', label: 'Venta' },
  { value: 'dividend', label: 'Dividendo' },
  { value: 'coupon', label: 'Cupón' },
]

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmt(n: number): string {
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

export default function PortfolioTransactionFormPage() {
  const { assetId, txId } = useParams<{ assetId: string; txId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isEdit = Boolean(txId)

  const prefillType = searchParams.get('type') as TxType | null

  const [txType, setTxType] = useState<TxType>(prefillType ?? 'buy')
  const [occurredOn, setOccurredOn] = useState(localToday())
  const [quantity, setQuantity] = useState('')
  const [pricePerUnit, setPricePerUnit] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [totalManuallyEdited, setTotalManuallyEdited] = useState(false)
  const [exchangeRate, setExchangeRate] = useState('')
  const [notes, setNotes] = useState('')

  const [currentUserId, setCurrentUserId] = useState('')
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isBuySell = txType === 'buy' || txType === 'sell'

  const parsedQty = parseFloat(quantity.replace(',', '.'))
  const parsedPrice = parseFloat(pricePerUnit.replace(',', '.'))
  const subtotal = !isNaN(parsedQty) && !isNaN(parsedPrice) ? parsedQty * parsedPrice : null

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id)
    })
  }, [])

  useEffect(() => {
    if (!txId) return
    supabase
      .from('portfolio_transactions')
      .select('*')
      .eq('id', txId)
      .single()
      .then(({ data }) => {
        if (!data) { navigate(`/finances/portfolio/${assetId}`); return }
        setTxType(data.transaction_type)
        setOccurredOn(data.occurred_on)
        setQuantity(data.quantity != null ? String(data.quantity) : '')
        setPricePerUnit(data.price_per_unit != null ? String(data.price_per_unit) : '')
        setTotalAmount(String(data.total_amount))
        setTotalManuallyEdited(true)
        setExchangeRate(data.exchange_rate != null ? String(data.exchange_rate) : '')
        setNotes(data.notes ?? '')
        setLoading(false)
      })
  }, [txId, assetId, navigate])

  function handleQuantityChange(val: string) {
    setQuantity(val)
    if (!totalManuallyEdited) {
      const q = parseFloat(val.replace(',', '.'))
      const p = parseFloat(pricePerUnit.replace(',', '.'))
      if (!isNaN(q) && !isNaN(p)) setTotalAmount(String(Math.round(q * p * 100) / 100))
    }
  }

  function handlePriceChange(val: string) {
    setPricePerUnit(val)
    if (!totalManuallyEdited) {
      const q = parseFloat(quantity.replace(',', '.'))
      const p = parseFloat(val.replace(',', '.'))
      if (!isNaN(q) && !isNaN(p)) setTotalAmount(String(Math.round(q * p * 100) / 100))
    }
  }

  function handleTxTypeChange(t: TxType) {
    setTxType(t)
    setTotalManuallyEdited(false)
    if (t === 'dividend' || t === 'coupon') {
      setQuantity('')
      setPricePerUnit('')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const parsedTotal = parseFloat(totalAmount.replace(',', '.'))
    const parsedRate = exchangeRate ? parseFloat(exchangeRate.replace(',', '.')) : null

    if (isNaN(parsedTotal) || parsedTotal <= 0) { setError('Ingresá el monto total.'); return }
    if (isBuySell && !quantity) { setError('Ingresá la cantidad.'); return }
    if (isBuySell && !pricePerUnit) { setError('Ingresá la cotización.'); return }

    setSaving(true)

    const payload = {
      transaction_type: txType,
      occurred_on: occurredOn,
      quantity: isBuySell ? parseFloat(quantity.replace(',', '.')) : null,
      price_per_unit: isBuySell ? parseFloat(pricePerUnit.replace(',', '.')) : null,
      total_amount: parsedTotal,
      exchange_rate: parsedRate,
      notes: notes.trim() || null,
    }

    if (isEdit) {
      const { error: updateError } = await supabase
        .from('portfolio_transactions')
        .update(payload)
        .eq('id', txId!)
      if (updateError) { setError(updateError.message); setSaving(false); return }
    } else {
      const { error: insertError } = await supabase.from('portfolio_transactions').insert({
        asset_id: assetId!,
        owner_id: currentUserId,
        ...payload,
      })
      if (insertError) { setError(insertError.message); setSaving(false); return }
    }

    navigate(`/finances/portfolio/${assetId}`)
  }

  async function handleDelete() {
    if (!window.confirm('¿Eliminar esta operación?')) return
    const { error: deleteError } = await supabase
      .from('portfolio_transactions')
      .delete()
      .eq('id', txId!)
    if (deleteError) { setError(deleteError.message); return }
    navigate(`/finances/portfolio/${assetId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface">
        <NavBar title="Editar operación" backTo={`/finances/portfolio/${assetId}`} />
        <div className="flex justify-center pt-16 text-gray-400 text-sm">Cargando…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <NavBar
        title={isEdit ? 'Editar operación' : 'Nueva operación'}
        backTo={`/finances/portfolio/${assetId}`}
      />

      <form onSubmit={handleSubmit} className="p-4 space-y-5 max-w-lg mx-auto pb-10">

        {/* Transaction type */}
        <div className="flex rounded-xl overflow-hidden border border-border bg-card">
          {TX_TYPES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => !isEdit && handleTxTypeChange(value)}
              disabled={isEdit}
              className={`flex-1 py-3 text-xs font-semibold transition-colors ${
                txType === value ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-sand'
              } ${isEdit ? 'opacity-60 cursor-default' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Date */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Fecha</label>
          <input
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Quantity + Price — buy/sell only */}
        {isBuySell && (
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Cantidad</label>
              <input
                type="number"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                placeholder="ej. 100"
                min="0"
                step="any"
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Cotización</label>
              <input
                type="number"
                inputMode="decimal"
                value={pricePerUnit}
                onChange={(e) => handlePriceChange(e.target.value)}
                placeholder="ej. 1234,56"
                min="0"
                step="any"
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        )}

        {/* Total amount */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            {txType === 'buy' ? 'Total pagado' : txType === 'sell' ? 'Total recibido' : 'Monto cobrado'}
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={totalAmount}
            onChange={(e) => { setTotalAmount(e.target.value); setTotalManuallyEdited(true) }}
            placeholder="0"
            min="0"
            step="any"
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {isBuySell && subtotal !== null && (
            <p className="text-xs text-gray-400">
              Subtotal (sin comisiones): {fmt(subtotal)}
            </p>
          )}
          {isBuySell && (
            <p className="text-xs text-gray-300">Incluí las comisiones en el monto total.</p>
          )}
        </div>

        {/* Exchange rate */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Tipo de cambio ARS/USD <span className="normal-case font-normal">(opcional)</span>
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={exchangeRate}
            onChange={(e) => setExchangeRate(e.target.value)}
            placeholder="ej. 1450"
            min="0"
            step="any"
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-gray-300">Necesario para convertir entre ARS y USD en el análisis.</p>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Notas <span className="normal-case font-normal">(opcional)</span>
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ej. pago de renta semestral"
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-primary text-white py-3.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-opacity active:opacity-80"
        >
          {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Guardar operación'}
        </button>

        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            className="w-full py-2 text-sm text-negative/60 hover:text-negative transition-colors"
          >
            Eliminar operación
          </button>
        )}
      </form>
    </div>
  )
}
