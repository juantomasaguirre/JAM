import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import NavBar from '../components/NavBar'

export default function RecurringPaymentFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [name, setName] = useState('')
  const [dueDay, setDueDay] = useState('')

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
      .from('recurring_payments')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (!data) { navigate('/gastos-recurrentes'); return }
        setName(data.name)
        setDueDay(String(data.due_day))
        setLoading(false)
      })
  }, [id, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const parsedDay = parseInt(dueDay)
    if (!name.trim()) { setError('Ingresá el nombre del pago.'); return }
    if (isNaN(parsedDay) || parsedDay < 1 || parsedDay > 31) {
      setError('El día debe ser entre 1 y 31.')
      return
    }

    setSaving(true)

    if (isEdit) {
      const { error: updateError } = await supabase
        .from('recurring_payments')
        .update({ name: name.trim(), due_day: parsedDay, is_active: true })
        .eq('id', id!)
      if (updateError) { setError(updateError.message); setSaving(false); return }
    } else {
      const { error: insertError } = await supabase.from('recurring_payments').insert({
        household_id: householdId,
        created_by: currentUserId,
        name: name.trim(),
        due_day: parsedDay,
      })
      if (insertError) { setError(insertError.message); setSaving(false); return }
    }

    navigate('/gastos-recurrentes')
  }

  async function handleDelete() {
    if (!window.confirm('¿Eliminar este recordatorio?')) return
    const { error: deleteError } = await supabase
      .from('recurring_payments')
      .delete()
      .eq('id', id!)
    if (deleteError) { setError(deleteError.message); return }
    navigate('/gastos-recurrentes')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface">
        <NavBar title="Editar recordatorio" backTo="/gastos-recurrentes" />
        <div className="flex justify-center pt-16 text-gray-400 text-sm">Cargando…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <NavBar
        title={isEdit ? 'Editar recordatorio' : 'Nuevo recordatorio'}
        backTo="/gastos-recurrentes"
      />

      <form onSubmit={handleSubmit} className="p-4 space-y-5 max-w-lg mx-auto pb-10">

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Nombre
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ej. Alquiler, Expensas, Gas…"
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Día del mes
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
            placeholder="ej. 10"
            min="1"
            max="31"
            step="1"
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-gray-300">
            Para meses cortos, días 29-31 se notifican el último día del mes.
          </p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-primary text-white py-3.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-opacity active:opacity-80"
        >
          {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Guardar recordatorio'}
        </button>

        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            className="w-full py-2 text-sm text-negative/60 hover:text-negative transition-colors"
          >
            Eliminar recordatorio
          </button>
        )}
      </form>
    </div>
  )
}
