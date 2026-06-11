import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import NavBar from '../components/NavBar'

type AssetType = 'stock' | 'bond' | 'etf' | 'on' | 'other'

const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: 'stock', label: 'Acción' },
  { value: 'bond', label: 'Bono' },
  { value: 'etf', label: 'ETF' },
  { value: 'on', label: 'ON' },
  { value: 'other', label: 'Otro' },
]

export default function PortfolioAssetFormPage() {
  const { assetId } = useParams<{ assetId: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(assetId)

  const [name, setName] = useState('')
  const [assetType, setAssetType] = useState<AssetType>('stock')
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS')
  const [isClosed, setIsClosed] = useState(false)

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
    if (!assetId) return
    supabase
      .from('portfolio_assets')
      .select('*')
      .eq('id', assetId)
      .single()
      .then(({ data }) => {
        if (!data) { navigate('/finances?tab=portfolio'); return }
        setName(data.name)
        setAssetType(data.asset_type)
        setCurrency(data.currency)
        setIsClosed(data.is_closed)
        setLoading(false)
      })
  }, [assetId, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('Ingresá el nombre del activo.'); return }
    setSaving(true)

    if (isEdit) {
      const { error: updateError } = await supabase
        .from('portfolio_assets')
        .update({ name: name.trim(), is_closed: isClosed })
        .eq('id', assetId!)
      if (updateError) { setError(updateError.message); setSaving(false); return }
    } else {
      const { error: insertError } = await supabase.from('portfolio_assets').insert({
        household_id: householdId,
        owner_id: currentUserId,
        name: name.trim(),
        asset_type: assetType,
        currency,
      })
      if (insertError) { setError(insertError.message); setSaving(false); return }
    }

    navigate('/finances?tab=portfolio')
  }

  async function handleDelete() {
    if (!window.confirm('¿Eliminar este activo y todas sus operaciones? Esta acción no se puede deshacer.')) return
    const { error: deleteError } = await supabase
      .from('portfolio_assets')
      .delete()
      .eq('id', assetId!)
    if (deleteError) { setError(deleteError.message); return }
    navigate('/finances?tab=portfolio')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface">
        <NavBar title="Editar activo" backTo="/finances?tab=portfolio" />
        <div className="flex justify-center pt-16 text-gray-400 text-sm">Cargando…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <NavBar
        title={isEdit ? 'Editar activo' : 'Nuevo activo'}
        backTo={isEdit ? `/finances/portfolio/${assetId}` : '/finances?tab=portfolio'}
      />

      <form onSubmit={handleSubmit} className="p-4 space-y-5 max-w-lg mx-auto pb-10">

        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Nombre del activo
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ej. AL30, CEDEAR AAPL, ON YPF 2027…"
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Asset type */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Tipo
          </label>
          <div className="grid grid-cols-3 gap-2">
            {ASSET_TYPES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => !isEdit && setAssetType(value)}
                disabled={isEdit}
                className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                  assetType === value
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'bg-card text-gray-400 border-border hover:bg-sand'
                } ${isEdit ? 'opacity-60 cursor-default' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Currency */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Moneda del activo
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

        {/* Closed toggle — edit only */}
        {isEdit && (
          <button
            type="button"
            onClick={() => setIsClosed(!isClosed)}
            className={`w-full py-3 rounded-xl text-sm font-semibold border transition-colors ${
              isClosed
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-card border-border text-gray-500 hover:bg-sand'
            }`}
          >
            {isClosed ? 'Posición cerrada ✓' : 'Marcar como cerrada'}
          </button>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-primary text-white py-3.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-opacity active:opacity-80"
        >
          {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear activo'}
        </button>

        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            className="w-full py-2 text-sm text-negative/60 hover:text-negative transition-colors"
          >
            Eliminar activo y todas sus operaciones
          </button>
        )}
      </form>
    </div>
  )
}
