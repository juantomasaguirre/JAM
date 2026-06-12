import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import NavBar from '../components/NavBar'
import BottomNav from '../components/BottomNav'

interface Category {
  id: string
  name: string
}

interface BudgetRecord {
  id: string
  monthly_limit: number
}

export default function BudgetPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [budgets, setBudgets] = useState<Map<string, BudgetRecord>>(new Map())
  const [householdId, setHouseholdId] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('household_id')
        .eq('id', user.id)
        .single()
      if (profile) setHouseholdId(profile.household_id)

      const [catsResult, budgetsResult] = await Promise.all([
        supabase.from('categories').select('id, name').eq('kind', 'expense').eq('is_archived', false).order('name'),
        supabase.from('category_budgets').select('id, category_id, monthly_limit'),
      ])

      if (catsResult.data) setCategories(catsResult.data)
      if (budgetsResult.data) {
        const map = new Map<string, BudgetRecord>()
        for (const b of budgetsResult.data as { id: string; category_id: string; monthly_limit: number }[]) {
          map.set(b.category_id, { id: b.id, monthly_limit: b.monthly_limit })
        }
        setBudgets(map)
      }
      setLoading(false)
    }
    load()
  }, [])

  function startEdit(catId: string) {
    const budget = budgets.get(catId)
    setEditingId(catId)
    setEditValue(budget ? String(budget.monthly_limit) : '')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValue('')
  }

  async function handleSave(catId: string) {
    setSaving(true)
    const parsed = parseFloat(editValue.replace(',', '.'))
    const existing = budgets.get(catId)

    if (!editValue.trim() || isNaN(parsed) || parsed <= 0) {
      if (existing) {
        await supabase.from('category_budgets').delete().eq('id', existing.id)
        setBudgets((prev) => { const next = new Map(prev); next.delete(catId); return next })
      }
    } else if (existing) {
      await supabase.from('category_budgets').update({ monthly_limit: parsed }).eq('id', existing.id)
      setBudgets((prev) => new Map(prev).set(catId, { id: existing.id, monthly_limit: parsed }))
    } else {
      const { data } = await supabase
        .from('category_budgets')
        .insert({ household_id: householdId, category_id: catId, monthly_limit: parsed })
        .select('id')
        .single()
      if (data) setBudgets((prev) => new Map(prev).set(catId, { id: data.id, monthly_limit: parsed }))
    }

    setSaving(false)
    setEditingId(null)
    setEditValue('')
  }

  return (
    <div className="min-h-screen bg-surface pb-16">
      <NavBar title="Presupuestos" backTo="/" />

      {loading ? (
        <div className="flex justify-center pt-16 text-gray-400 text-sm">Cargando…</div>
      ) : (
        <div className="mt-4">
          <div className="px-4 pb-3">
            <p className="text-xs text-gray-400">
              Límite mensual por categoría, en ARS. Tocá una para editar. Dejá vacío para quitar el límite.
            </p>
          </div>
          {categories.map((cat) => {
            const budget = budgets.get(cat.id)
            const isEditing = editingId === cat.id
            return (
              <div key={cat.id} className="bg-card border-b border-sand px-4 py-3">
                {isEditing ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-900">{cat.name}</p>
                    <div className="relative">
                      <input
                        type="number"
                        inputMode="numeric"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="ej. 50000"
                        autoFocus
                        className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary pr-14"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">
                        ARS
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSave(cat.id)}
                        disabled={saving}
                        className="flex-1 bg-primary text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 active:opacity-80"
                      >
                        {saving ? '…' : 'Guardar'}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="flex-1 bg-sand text-gray-600 py-2.5 rounded-xl text-sm font-semibold active:opacity-80"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => startEdit(cat.id)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <span className="text-sm font-medium text-gray-900">{cat.name}</span>
                    <span className={`text-sm ${budget ? 'text-gray-700 font-semibold' : 'text-gray-300'}`}>
                      {budget
                        ? `$${budget.monthly_limit.toLocaleString('es-AR')} ARS`
                        : 'Sin límite'}
                    </span>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <BottomNav />
    </div>
  )
}
