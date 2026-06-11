import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import NavBar from '../components/NavBar'

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function DebtFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [direction, setDirection] = useState<'i_owe' | 'they_owe'>('i_owe')
  const [counterpart, setCounterpart] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [pendingAmount, setPendingAmount] = useState('')
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS')
  const [occurredOn, setOccurredOn] = useState(localToday())
  const [originalAmount, setOriginalAmount] = useState<number | null>(null)

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    supabase
      .from('debts')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (!data) { navigate('/finances'); return }
        setDirection(data.direction)
        setCounterpart(data.counterpart)
        setDescription(data.description)
        setAmount(String(data.original_amount))
        setPendingAmount(String(data.pending_amount))
        setCurrency(data.currency)
        setOccurredOn(data.occurred_on)
        setOriginalAmount(data.original_amount)
        setLoading(false)
      })
  }, [id, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const parsedAmount = parseFloat(amount.replace(',', '.'))
    const parsedPending = isEdit
      ? parseFloat(pendingAmount.replace(',', '.'))
      : parsedAmount

    if (!counterpart.trim()) { setError('Ingresá con quién.'); return }
    if (!description.trim()) { setError('Ingresá una descripción.'); return }
    if (isNaN(parsedAmount) || parsedAmount <= 0) { setError('Ingresá un monto válido.'); return }
    if (isEdit && (isNaN(parsedPending) || parsedPending < 0)) {
      setError('El monto pendiente no puede ser negativo.')
      return
    }
    if (isEdit && parsedPending > (originalAmount ?? parsedAmount)) {
      setError('El monto pendiente no puede superar el original.')
      return
    }

    setSaving(true)

    if (isEdit) {
      const { error: updateError } = await supabase
        .from('debts')
        .update({
          direction,
          counterpart: counterpart.trim(),
          description: description.trim(),
          pending_amount: parsedPending,
          occurred_on: occurredOn,
        })
        .eq('id', id!)

      if (updateError) { setError(updateError.message); setSaving(false); return }
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('household_id')
        .eq('id', user.id)
        .single()

      if (!profile) { setError('No se pudo obtener el perfil.'); setSaving(false); return }

      const { error: insertError } = await supabase.from('debts').insert({
        household_id: profile.household_id,
        owner_id: user.id,
        direction,
        counterpart: counterpart.trim(),
        description: description.trim(),
        original_amount: parsedAmount,
        pending_amount: parsedAmount,
        currency,
        occurred_on: occurredOn,
      })

      if (insertError) { setError(insertError.message); setSaving(false); return }
    }

    navigate('/finances')
  }

  async function handleDelete() {
    if (!window.confirm('¿Eliminar esta deuda?')) return
    const { error: deleteError } = await supabase.from('debts').delete().eq('id', id!)
    if (deleteError) { setError(deleteError.message); return }
    navigate('/finances')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface">
        <NavBar title="Editar deuda" backTo="/finances" />
        <div className="flex justify-center pt-16 text-gray-400 text-sm">Cargando…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <NavBar
        title={isEdit ? 'Editar deuda' : 'Nueva deuda'}
        backTo="/finances"
      />

      <form onSubmit={handleSubmit} className="p-4 space-y-5 max-w-lg mx-auto pb-10">

        {/* Direction */}
        <div className="flex rounded-xl overflow-hidden border border-border bg-card">
          {([['i_owe', 'Yo debo'], ['they_owe', 'Me deben']] as const).map(([d, label]) => (
            <button
              key={d}
              type="button"
              onClick={() => setDirection(d)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                direction === d ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-sand'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Counterpart */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            {direction === 'i_owe' ? '¿A quién le debés?' : '¿Quién te debe?'}
          </label>
          <input
            type="text"
            value={counterpart}
            onChange={(e) => setCounterpart(e.target.value)}
            placeholder="ej. Mamá, Martín…"
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Descripción
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="ej. Cena, gastos del viaje…"
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Amount + Currency */}
        <div className="flex gap-3">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              {isEdit ? 'Monto original' : 'Monto total'}
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => !isEdit && setAmount(e.target.value)}
              readOnly={isEdit}
              placeholder="0"
              min="0"
              step="any"
              className={`w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary ${
                isEdit ? 'opacity-60' : ''
              }`}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Moneda
            </label>
            <div className="flex rounded-xl overflow-hidden border border-border bg-card h-[46px]">
              {(['ARS', 'USD'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => !isEdit && setCurrency(c)}
                  disabled={isEdit}
                  className={`px-4 text-sm font-semibold transition-colors ${
                    currency === c ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-sand'
                  } ${isEdit ? 'opacity-60 cursor-default' : ''}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Pending amount — edit only */}
        {isEdit && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Monto pendiente
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={pendingAmount}
              onChange={(e) => setPendingAmount(e.target.value)}
              placeholder="0"
              min="0"
              step="any"
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-gray-400">Ponelo en 0 si ya está saldado.</p>
          </div>
        )}

        {/* Date */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Fecha
          </label>
          <input
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-primary text-white py-3.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-opacity active:opacity-80"
        >
          {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Guardar deuda'}
        </button>

        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            className="w-full py-2 text-sm text-negative/60 hover:text-negative transition-colors"
          >
            Eliminar deuda
          </button>
        )}
      </form>
    </div>
  )
}
