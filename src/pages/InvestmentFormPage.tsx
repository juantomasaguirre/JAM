import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import NavBar from '../components/NavBar'

type InvestmentType = 'fx_savings' | 'fci' | 'etf' | 'asset_manager' | 'plazo_fijo'

const INVESTMENT_TYPES: { value: InvestmentType; label: string }[] = [
  { value: 'fx_savings', label: 'Dólares en el colchón' },
  { value: 'plazo_fijo', label: 'Plazo fijo' },
  { value: 'fci', label: 'Fondo de inversión' },
  { value: 'etf', label: 'ETF' },
  { value: 'asset_manager', label: 'Gestor de activos' },
]

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function InvestmentFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [investmentType, setInvestmentType] = useState<InvestmentType>('fx_savings')
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('USD')
  const [investedAmount, setInvestedAmount] = useState('')
  const [currentValue, setCurrentValue] = useState('')
  const [startedOn, setStartedOn] = useState(localToday())
  const [expiresOn, setExpiresOn] = useState('')
  const [notes, setNotes] = useState('')
  const [isActive, setIsActive] = useState(true)

  const [currentUserId, setCurrentUserId] = useState('')
  const [householdId, setHouseholdId] = useState('')

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setCurrentUserId(user.id)
      const { data: profile } = await supabase
        .from('profiles')
        .select('household_id')
        .eq('id', user.id)
        .single()
      if (profile) setHouseholdId(profile.household_id)
    })
  }, [])

  useEffect(() => {
    if (!id) return
    supabase
      .from('investments')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (!data) { navigate('/finances?tab=investments'); return }
        setInvestmentType(data.investment_type)
        setName(data.name)
        setCurrency(data.currency)
        setInvestedAmount(String(data.invested_amount))
        setCurrentValue(String(data.current_value))
        setStartedOn(data.started_on)
        setExpiresOn(data.expires_on ?? '')
        setNotes(data.notes ?? '')
        setIsActive(data.is_active)
        setLoading(false)
      })
  }, [id, navigate])

  // When invested amount changes at create time, mirror it to current value
  function handleInvestedAmountChange(val: string) {
    setInvestedAmount(val)
    if (!isEdit) setCurrentValue(val)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const parsedInvested = parseFloat(investedAmount.replace(',', '.'))
    const parsedCurrent = parseFloat(currentValue.replace(',', '.'))

    if (!name.trim()) { setError('Ingresá un nombre.'); return }
    if (isNaN(parsedInvested) || parsedInvested <= 0) { setError('Ingresá el monto invertido.'); return }
    if (isNaN(parsedCurrent) || parsedCurrent < 0) { setError('Ingresá el valor actual.'); return }

    setSaving(true)

    if (isEdit) {
      const { error: updateError } = await supabase
        .from('investments')
        .update({
          name: name.trim(),
          current_value: parsedCurrent,
          expires_on: expiresOn || null,
          notes: notes.trim() || null,
          is_active: isActive,
        })
        .eq('id', id!)
      if (updateError) { setError(updateError.message); setSaving(false); return }
    } else {
      const { error: insertError } = await supabase.from('investments').insert({
        household_id: householdId,
        owner_id: currentUserId,
        investment_type: investmentType,
        name: name.trim(),
        currency,
        invested_amount: parsedInvested,
        current_value: parsedCurrent,
        started_on: startedOn,
        expires_on: expiresOn || null,
        notes: notes.trim() || null,
      })
      if (insertError) { setError(insertError.message); setSaving(false); return }
    }

    navigate('/finances?tab=investments')
  }

  async function handleDelete() {
    if (!window.confirm('¿Eliminar esta inversión?')) return
    const { error: deleteError } = await supabase.from('investments').delete().eq('id', id!)
    if (deleteError) { setError(deleteError.message); return }
    navigate('/finances?tab=investments')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface">
        <NavBar title="Editar inversión" backTo="/finances?tab=investments" />
        <div className="flex justify-center pt-16 text-gray-400 text-sm">Cargando…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <NavBar
        title={isEdit ? 'Editar inversión' : 'Nueva inversión'}
        backTo="/finances?tab=investments"
      />

      <form onSubmit={handleSubmit} className="p-4 space-y-5 max-w-lg mx-auto pb-10">

        {/* Investment type */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Tipo
          </label>
          <div className="grid grid-cols-2 gap-2">
            {INVESTMENT_TYPES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => !isEdit && setInvestmentType(value)}
                disabled={isEdit}
                className={`py-2.5 px-3 rounded-xl text-sm font-semibold text-left border transition-colors ${
                  investmentType === value
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'bg-card text-gray-400 border-border hover:bg-sand'
                } ${isEdit ? 'opacity-60 cursor-default' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Nombre
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ej. Letes, S&P500, Banco Nación…"
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Currency */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Moneda
          </label>
          <div className="flex rounded-xl overflow-hidden border border-border bg-card">
            {(['ARS', 'USD'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => !isEdit && setCurrency(c)}
                disabled={isEdit}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                  currency === c ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-sand'
                } ${isEdit ? 'opacity-60 cursor-default' : ''}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Invested amount */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Monto invertido
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={investedAmount}
            onChange={(e) => handleInvestedAmountChange(e.target.value)}
            readOnly={isEdit}
            placeholder="0"
            min="0"
            step="any"
            className={`w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary ${
              isEdit ? 'opacity-60' : ''
            }`}
          />
        </div>

        {/* Current value */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Valor actual
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={currentValue}
            onChange={(e) => setCurrentValue(e.target.value)}
            placeholder="0"
            min="0"
            step="any"
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {isEdit && (
            <p className="text-xs text-gray-400">Actualizá este valor cuando cambie.</p>
          )}
        </div>

        {/* Started on */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Fecha de inicio
          </label>
          <input
            type="date"
            value={startedOn}
            onChange={(e) => !isEdit && setStartedOn(e.target.value)}
            readOnly={isEdit}
            className={`w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary ${
              isEdit ? 'opacity-60' : ''
            }`}
          />
        </div>

        {/* Expires on — optional */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Vencimiento <span className="normal-case font-normal">(opcional)</span>
          </label>
          <input
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Notes — optional */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Notas <span className="normal-case font-normal">(opcional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ej. TNA 45%, renovación automática…"
            rows={2}
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </div>

        {/* Archive toggle — edit only */}
        {isEdit && (
          <button
            type="button"
            onClick={() => setIsActive(!isActive)}
            className={`w-full py-3 rounded-xl text-sm font-semibold border transition-colors ${
              isActive
                ? 'bg-card border-border text-gray-500 hover:bg-sand'
                : 'bg-sand border-border text-gray-400'
            }`}
          >
            {isActive ? 'Archivar inversión' : 'Restaurar inversión'}
          </button>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-primary text-white py-3.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-opacity active:opacity-80"
        >
          {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Guardar inversión'}
        </button>

        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            className="w-full py-2 text-sm text-negative/60 hover:text-negative transition-colors"
          >
            Eliminar inversión
          </button>
        )}
      </form>
    </div>
  )
}
