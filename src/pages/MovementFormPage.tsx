import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import NavBar from '../components/NavBar'

interface Category {
  id: string
  name: string
  kind: 'expense' | 'income'
}

interface Profile {
  id: string
  display_name: string
}

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function MovementFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  // Form state
  const [kind, setKind] = useState<'expense' | 'income'>('expense')
  const [scope, setScope] = useState<'individual' | 'shared'>('individual')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS')
  const [categoryId, setCategoryId] = useState('')
  const [occurredOn, setOccurredOn] = useState(localToday())
  const [paidBy, setPaidBy] = useState('')

  // Data
  const [categories, setCategories] = useState<Category[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])

  // UI state
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Prevents categoryId from resetting when the form first loads with an existing movement
  const initialized = useRef(false)

  useEffect(() => {
    async function load() {
      const [catsResult, profilesResult] = await Promise.all([
        supabase
          .from('categories')
          .select('id, name, kind')
          .eq('is_archived', false)
          .order('name'),
        supabase.from('profiles').select('id, display_name'),
      ])

      if (catsResult.data) setCategories(catsResult.data)
      if (profilesResult.data) setProfiles(profilesResult.data)

      if (id) {
        const { data } = await supabase
          .from('movements')
          .select('*')
          .eq('id', id)
          .single()

        if (!data) {
          navigate('/movements')
          return
        }

        setKind(data.kind)
        setScope(data.scope)
        setDescription(data.description)
        setAmount(String(data.amount))
        setCurrency(data.currency)
        setCategoryId(data.category_id ?? '')
        setOccurredOn(data.occurred_on)
        setPaidBy(data.paid_by ?? '')
      }

      initialized.current = true
      setLoading(false)
    }
    load()
  }, [id, navigate])

  // Reset category when kind changes, but not on initial load
  useEffect(() => {
    if (!initialized.current) return
    setCategoryId('')
  }, [kind])

  const filteredCategories = categories.filter((c) => c.kind === kind)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const parsedAmount = parseFloat(amount.replace(',', '.'))
    if (!description.trim()) { setError('Ingresá una descripción.'); return }
    if (isNaN(parsedAmount) || parsedAmount <= 0) { setError('Ingresá un monto válido mayor a 0.'); return }
    if (scope === 'shared' && !paidBy) { setError('Indicá quién pagó.'); return }

    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (isEdit) {
      const { error: updateError } = await supabase
        .from('movements')
        .update({
          kind,
          category_id: categoryId || null,
          description: description.trim(),
          amount: parsedAmount,
          currency,
          occurred_on: occurredOn,
          paid_by: scope === 'shared' ? paidBy : null,
        })
        .eq('id', id!)

      if (updateError) { setError(updateError.message); setSaving(false); return }
    } else {
      const { data: profile } = await supabase
        .from('profiles')
        .select('household_id')
        .eq('id', user.id)
        .single()

      if (!profile) { setError('No se pudo obtener el perfil.'); setSaving(false); return }

      const { error: insertError } = await supabase.from('movements').insert({
        household_id: profile.household_id,
        created_by: user.id,
        owner_id: user.id,
        scope,
        kind,
        category_id: categoryId || null,
        description: description.trim(),
        amount: parsedAmount,
        currency,
        occurred_on: occurredOn,
        paid_by: scope === 'shared' ? paidBy : null,
      })

      if (insertError) { setError(insertError.message); setSaving(false); return }
    }

    navigate('/movements')
  }

  async function handleDelete() {
    if (!window.confirm('¿Eliminar este movimiento?')) return
    const { error: deleteError } = await supabase.from('movements').delete().eq('id', id!)
    if (deleteError) { setError(deleteError.message); return }
    navigate('/movements')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavBar title={isEdit ? 'Editar movimiento' : 'Nuevo movimiento'} backTo="/movements" />
        <div className="flex justify-center pt-16 text-gray-400 text-sm">Cargando…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar title={isEdit ? 'Editar movimiento' : 'Nuevo movimiento'} backTo="/movements" />

      <form onSubmit={handleSubmit} className="p-4 space-y-5 max-w-lg mx-auto pb-10">

        {/* Kind */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white">
          {(['expense', 'income'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                kind === k
                  ? k === 'expense' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                  : 'text-gray-400 hover:bg-gray-50'
              }`}
            >
              {k === 'expense' ? 'Gasto' : 'Ingreso'}
            </button>
          ))}
        </div>

        {/* Scope — read-only in edit mode to avoid constraint complexity */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white">
          {(['individual', 'shared'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => !isEdit && setScope(s)}
              disabled={isEdit}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                scope === s ? 'bg-gray-800 text-white' : 'text-gray-400'
              } ${isEdit ? 'opacity-60 cursor-default' : 'hover:bg-gray-50'}`}
            >
              {s === 'individual' ? 'Individual' : 'Compartido'}
            </button>
          ))}
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
            placeholder="ej. Almuerzo, supermercado…"
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Amount + Currency */}
        <div className="flex gap-3">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Monto
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              min="0"
              step="any"
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Moneda
            </label>
            <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white h-[46px]">
              {(['ARS', 'USD'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={`px-4 text-sm font-semibold transition-colors ${
                    currency === c ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Categoría
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Sin categoría</option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Fecha
          </label>
          <input
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Paid by — shared movements only */}
        {scope === 'shared' && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Quién pagó
            </label>
            <select
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccioná...</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.display_name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Error */}
        {error && <p className="text-sm text-red-500">{error}</p>}

        {/* Submit */}
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 text-white py-3.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-opacity active:opacity-80"
        >
          {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Guardar movimiento'}
        </button>

        {/* Delete — edit mode only */}
        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            className="w-full py-2 text-sm text-red-400 hover:text-red-600 transition-colors"
          >
            Eliminar movimiento
          </button>
        )}
      </form>
    </div>
  )
}
