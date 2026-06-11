import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import NavBar from '../components/NavBar'

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Profile {
  id: string
  display_name: string
}

export default function InstallmentFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [scope, setScope] = useState<'individual' | 'shared'>('individual')
  const [paidBy, setPaidBy] = useState<string>('')
  const [description, setDescription] = useState('')
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS')
  const [totalAmount, setTotalAmount] = useState('')
  const [installmentCount, setInstallmentCount] = useState('')
  const [firstDueDate, setFirstDueDate] = useState(localToday())

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [householdId, setHouseholdId] = useState('')

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const parsedTotal = parseFloat(totalAmount.replace(',', '.'))
  const parsedCount = parseInt(installmentCount)
  const perInstallment =
    !isNaN(parsedTotal) && !isNaN(parsedCount) && parsedCount > 0
      ? parsedTotal / parsedCount
      : null

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setCurrentUserId(user.id)
      const { data: profile } = await supabase
        .from('profiles')
        .select('household_id')
        .eq('id', user.id)
        .single()
      if (!profile) return
      setHouseholdId(profile.household_id)
      const { data: members } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('household_id', profile.household_id)
      if (members) {
        setProfiles(members)
        setPaidBy(user.id)
      }
    })
  }, [])

  useEffect(() => {
    if (!id) return
    supabase
      .from('installment_plans')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (!data) { navigate('/finances?tab=installments'); return }
        setScope(data.scope)
        setPaidBy(data.paid_by ?? '')
        setDescription(data.description)
        setCurrency(data.currency)
        setTotalAmount(String(data.total_amount))
        setInstallmentCount(String(data.installment_count))
        setFirstDueDate(data.first_due_date)
        setLoading(false)
      })
  }, [id, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!description.trim()) { setError('Ingresá una descripción.'); return }
    if (isNaN(parsedTotal) || parsedTotal <= 0) { setError('Ingresá un monto válido.'); return }
    if (isNaN(parsedCount) || parsedCount <= 0) { setError('Ingresá la cantidad de cuotas.'); return }
    if (scope === 'shared' && !paidBy) { setError('Seleccioná quién paga.'); return }

    setSaving(true)

    if (isEdit) {
      const { error: updateError } = await supabase
        .from('installment_plans')
        .update({
          description: description.trim(),
          paid_by: scope === 'shared' ? paidBy : null,
          first_due_date: firstDueDate,
        })
        .eq('id', id!)
      if (updateError) { setError(updateError.message); setSaving(false); return }
    } else {
      const { error: insertError } = await supabase.from('installment_plans').insert({
        household_id: householdId,
        owner_id: currentUserId,
        scope,
        paid_by: scope === 'shared' ? paidBy : null,
        description: description.trim(),
        total_amount: parsedTotal,
        currency,
        installment_count: parsedCount,
        installment_amount: perInstallment!,
        first_due_date: firstDueDate,
      })
      if (insertError) { setError(insertError.message); setSaving(false); return }
    }

    navigate('/finances?tab=installments')
  }

  async function handleDelete() {
    if (!window.confirm('¿Eliminar este plan de cuotas?')) return
    const { error: deleteError } = await supabase
      .from('installment_plans')
      .delete()
      .eq('id', id!)
    if (deleteError) { setError(deleteError.message); return }
    navigate('/finances?tab=installments')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface">
        <NavBar title="Editar cuotas" backTo="/finances?tab=installments" />
        <div className="flex justify-center pt-16 text-gray-400 text-sm">Cargando…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <NavBar
        title={isEdit ? 'Editar cuotas' : 'Nuevas cuotas'}
        backTo="/finances?tab=installments"
      />

      <form onSubmit={handleSubmit} className="p-4 space-y-5 max-w-lg mx-auto pb-10">

        {/* Scope */}
        <div className="flex rounded-xl overflow-hidden border border-border bg-card">
          {([['individual', 'Individual'], ['shared', 'Compartida']] as const).map(([s, label]) => (
            <button
              key={s}
              type="button"
              onClick={() => !isEdit && setScope(s)}
              disabled={isEdit}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                scope === s ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-sand'
              } ${isEdit ? 'opacity-60 cursor-default' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Paid by — shared only */}
        {scope === 'shared' && profiles.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              ¿Quién paga?
            </label>
            <div className="flex rounded-xl overflow-hidden border border-border bg-card">
              {profiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPaidBy(p.id)}
                  className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                    paidBy === p.id ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-sand'
                  }`}
                >
                  {p.id === currentUserId ? 'Yo' : p.display_name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Descripción
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="ej. Heladera, viaje a Bariloche…"
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Amount + Currency */}
        <div className="flex gap-3">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Monto total
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={totalAmount}
              onChange={(e) => !isEdit && setTotalAmount(e.target.value)}
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

        {/* Installment count */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Cantidad de cuotas
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={installmentCount}
            onChange={(e) => !isEdit && setInstallmentCount(e.target.value)}
            readOnly={isEdit}
            placeholder="ej. 12"
            min="1"
            step="1"
            className={`w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary ${
              isEdit ? 'opacity-60' : ''
            }`}
          />
          {perInstallment !== null && (
            <p className="text-xs text-gray-400">
              {currency === 'ARS' ? '$ ' : 'U$S '}
              {new Intl.NumberFormat('es-AR', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              }).format(perInstallment)}{' '}
              por cuota
            </p>
          )}
        </div>

        {/* First due date */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Fecha primera cuota
          </label>
          <input
            type="date"
            value={firstDueDate}
            onChange={(e) => setFirstDueDate(e.target.value)}
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-primary text-white py-3.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-opacity active:opacity-80"
        >
          {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Guardar cuotas'}
        </button>

        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            className="w-full py-2 text-sm text-negative/60 hover:text-negative transition-colors"
          >
            Eliminar plan de cuotas
          </button>
        )}
      </form>
    </div>
  )
}
