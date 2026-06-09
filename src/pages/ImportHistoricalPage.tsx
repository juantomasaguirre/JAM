import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { suggestCategoryName } from '../lib/categoryKeywords'
import NavBar from '../components/NavBar'

interface DbCategory {
  id: string
  name: string
  kind: 'expense' | 'income'
}

interface HistRow {
  household_id: string
  created_by: string
  owner_id: string
  scope: 'shared' | 'loan'
  kind: 'expense' | 'income'
  category_id: string | null
  description: string
  amount: number
  currency: 'ARS' | 'USD'
  occurred_on: string
  paid_by: string
}

interface ParseResult {
  rows: HistRow[]
  shared50: number
  loan100: number
  liquidaciones: number
  balance: number
  catCounts: Record<string, number>
}

type Step = 'delete' | 'upload' | 'preview' | 'done'

// Maps categories from the source app to JAM category names.
// 'General' is handled via keyword rescue, not this map.
const HIST_CAT_MAP: Record<string, string> = {
  Alimentos: 'Comida y mercado',
  Licor: 'Salidas y ocio',
  Restaurantes: 'Salidas y ocio',
  'Películas': 'Salidas y ocio',
  'Entretenimiento - Otro': 'Salidas y ocio',
  Basura: 'Salidas y ocio',
  Taxi: 'Transporte',
  'Autobús/tren': 'Transporte',
  Gasolina: 'Transporte',
  Coche: 'Transporte',
  'Transporte - Otro': 'Transporte',
  'Avión': 'Transporte',
  'Gastos médicos': 'Salud',
  Alquiler: 'Alquiler y expensas',
  Mantenimiento: 'Servicios',
  Electricidad: 'Servicios',
  Ropa: 'Ropa',
  Muebles: 'Otros',
  Regalos: 'Otros',
}

function parseLine(line: string): string[] {
  const cells: string[] = []
  let cell = ''
  let inQuote = false
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote; continue }
    if (ch === ',' && !inQuote) { cells.push(cell); cell = ''; continue }
    cell += ch
  }
  cells.push(cell)
  return cells
}

function parseNum(raw: string): number {
  const s = raw.trim()
  if (s.includes(',') && s.includes('.')) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.'))
  }
  if (s.includes(',')) return parseFloat(s.replace(',', '.'))
  return parseFloat(s)
}

function parseHistorical(
  text: string,
  categories: DbCategory[],
  householdId: string,
  juanId: string,
  coniId: string,
): ParseResult {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const rows: HistRow[] = []
  const catCounts: Record<string, number> = {}
  let shared50 = 0, loan100 = 0, liquidaciones = 0, balance = 0

  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i])
    if (cells.length < 6) continue

    const date = cells[0].trim()
    const desc = cells[1].trim()
    const origCat = cells[2].trim()

    if (!date || !desc) continue
    if (date.startsWith('Saldo') || desc.startsWith('Saldo')) continue

    const coste = parseNum(cells[3])
    const currency = cells[4].trim()
    const coniCol = parseNum(cells[5])

    if (isNaN(coste) || isNaN(coniCol) || coste <= 0) continue
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue

    const absC = Math.abs(coniCol)
    const isShared = Math.abs(absC - coste / 2) <= 1
    const isPago = origCat === 'Pago'
    // positive coniCol = Coni paid (Juan's debt to Coni increases)
    // negative coniCol = Juan paid (Juan's debt to Coni decreases)
    const coniPaid = coniCol > 0

    let scope: 'shared' | 'loan'
    let kind: 'expense' | 'income'
    let paid_by: string
    let created_by: string
    let catName: string

    if (isPago) {
      scope = 'loan'
      catName = 'Liquidaciones'
      if (coniPaid) {
        // Coni settles her debt to Juan — Juan receives payment (income)
        kind = 'income'
        paid_by = coniId
        created_by = coniId
      } else {
        // Juan settles his debt to Coni — Juan makes payment (expense)
        kind = 'expense'
        paid_by = juanId
        created_by = juanId
      }
      liquidaciones++
    } else {
      kind = 'expense'
      scope = isShared ? 'shared' : 'loan'
      paid_by = coniPaid ? coniId : juanId
      // loan constraint: paid_by = created_by; shared has no such constraint
      created_by = scope === 'loan' ? paid_by : juanId

      if (origCat === 'General') {
        catName = suggestCategoryName(desc, 'expense') ?? 'Otros'
      } else {
        catName = HIST_CAT_MAP[origCat] ?? 'Otros'
      }

      if (isShared) shared50++
      else loan100++
    }

    const category_id =
      categories.find((c) => c.name === catName && c.kind === kind)?.id ?? null

    catCounts[catName] = (catCounts[catName] ?? 0) + 1

    // Mirror DashboardPage balance formula (positive = Coni owes Juan, negative = Juan owes Coni)
    const share = scope === 'loan' ? coste : coste / 2
    balance += paid_by === juanId ? share : -share

    rows.push({
      household_id: householdId,
      created_by,
      owner_id: created_by,
      scope,
      kind,
      category_id,
      description: desc,
      amount: coste,
      currency: currency === 'USD' ? 'USD' : 'ARS',
      occurred_on: date,
      paid_by,
    })
  }

  return { rows, shared50, loan100, liquidaciones, balance, catCounts }
}

const BATCH_SIZE = 100

function fmt(n: number): string {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Math.abs(n))
}

export default function ImportHistoricalPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('delete')

  const [juanId, setJuanId] = useState('')
  const [coniId, setConiId] = useState('')
  const [householdId, setHouseholdId] = useState('')
  const [categories, setCategories] = useState<DbCategory[]>([])

  const [existingCount, setExistingCount] = useState<number | null>(null)
  const [deleteConfirmed, setDeleteConfirmed] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [summary, setSummary] = useState<ParseResult | null>(null)
  const [fileError, setFileError] = useState('')

  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [importedCount, setImportedCount] = useState(0)
  const [importError, setImportError] = useState('')

  useEffect(() => {
    async function load() {
      const [userResult, catsResult] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('categories').select('id, name, kind').eq('is_archived', false),
      ])

      const userId = userResult.data.user?.id ?? ''
      if (!userId) return
      setJuanId(userId)
      if (catsResult.data) setCategories(catsResult.data as DbCategory[])

      const { data: profile } = await supabase
        .from('profiles')
        .select('household_id')
        .eq('id', userId)
        .single()
      if (!profile) return
      setHouseholdId(profile.household_id)

      const { data: allProfiles } = await supabase.from('profiles').select('id')
      const other = allProfiles?.find((p) => p.id !== userId)
      if (other) setConiId(other.id)

      const { count } = await supabase
        .from('movements')
        .select('*', { count: 'exact', head: true })
      setExistingCount(count ?? 0)
    }
    load()
  }, [])

  async function handleDelete() {
    setDeleting(true)
    await supabase.from('movements').delete().eq('household_id', householdId)
    setDeleting(false)
    setStep('upload')
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileError('')

    if (!coniId) {
      setFileError('No se encontró el segundo usuario del hogar. Asegurate de que ambos hayan iniciado sesión al menos una vez.')
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string ?? ''
      const result = parseHistorical(text, categories, householdId, juanId, coniId)
      if (result.rows.length === 0) {
        setFileError('No se encontraron filas válidas. Verificá que sea el archivo correcto.')
        return
      }
      setSummary(result)
      setStep('preview')
    }
    reader.readAsText(file, 'UTF-8')
  }

  async function handleImport() {
    if (!summary) return
    setImporting(true)
    setImportError('')
    setProgress(0)

    try {
      const { rows } = summary
      let done = 0
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE)
        const { error } = await supabase.rpc('bulk_import_historical', { p_rows: batch })
        if (error) throw new Error(error.message)
        done += batch.length
        setProgress(Math.round((done / rows.length) * 100))
      }
      setImportedCount(done)
      setStep('done')
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Error desconocido')
    }
    setImporting(false)
  }

  // ─── Done ────────────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 gap-5">
        <div className="text-5xl">✅</div>
        <p className="text-lg font-bold text-gray-900 text-center">
          {importedCount} movimientos importados
        </p>
        <button
          onClick={() => navigate('/movements')}
          className="bg-blue-600 text-white text-sm font-semibold px-6 py-3 rounded-xl active:opacity-80"
        >
          Ver movimientos
        </button>
      </div>
    )
  }

  // ─── Preview ─────────────────────────────────────────────────────────────────
  if (step === 'preview' && summary) {
    const juanOwes = summary.balance < 0
    const sortedCats = Object.entries(summary.catCounts).sort((a, b) => b[1] - a[1])

    return (
      <div className="min-h-screen bg-gray-50 pb-8">
        <NavBar title="Confirmar importación" showBack />
        <div className="p-4 max-w-lg mx-auto space-y-4">
          {/* Totals */}
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <p className="text-sm font-semibold text-gray-900">
              {summary.rows.length} movimientos encontrados
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xl font-bold text-gray-900">{summary.shared50}</p>
                <p className="text-xs text-gray-500 mt-0.5">Compartidos</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xl font-bold text-gray-900">{summary.loan100}</p>
                <p className="text-xs text-gray-500 mt-0.5">Préstamos</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xl font-bold text-gray-900">{summary.liquidaciones}</p>
                <p className="text-xs text-gray-500 mt-0.5">Liquidaciones</p>
              </div>
            </div>
          </div>

          {/* Computed balance */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Saldo calculado (solo ARS)
            </p>
            {Math.abs(summary.balance) < 1 ? (
              <p className="text-sm text-gray-600 font-medium">Están al día</p>
            ) : juanOwes ? (
              <p className="text-sm text-gray-900">
                Juan le debe a Coni{' '}
                <span className="font-bold text-red-500">$ {fmt(summary.balance)}</span>
              </p>
            ) : (
              <p className="text-sm text-gray-900">
                Coni le debe a Juan{' '}
                <span className="font-bold text-green-600">$ {fmt(summary.balance)}</span>
              </p>
            )}
          </div>

          {/* Category breakdown */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Por categoría
            </p>
            <div className="space-y-1.5">
              {sortedCats.map(([name, count]) => (
                <div key={name} className="flex justify-between items-center text-sm">
                  <span className="text-gray-700">{name}</span>
                  <span className="text-gray-400 tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {importError && (
            <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{importError}</p>
          )}

          {importing ? (
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 font-medium">Importando…</span>
                <span className="text-gray-400">{progress}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <button
              onClick={handleImport}
              className="w-full bg-blue-600 text-white text-sm font-semibold px-5 py-4 rounded-2xl active:opacity-80"
            >
              Importar {summary.rows.length} movimientos
            </button>
          )}
        </div>
      </div>
    )
  }

  // ─── Upload ───────────────────────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavBar title="Importar historial" showBack />
        <div className="p-4 max-w-lg mx-auto space-y-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
            <p className="text-sm font-semibold text-gray-900">Cargar el CSV exportado</p>
            <p className="text-xs text-gray-500 font-mono break-all">
              Fecha, Descripción, Categoría, Coste, Moneda, constanzacriado, Juan Tomas Aguirre
            </p>
            <p className="text-xs text-gray-400">
              Formato de fecha esperado: YYYY-MM-DD. Moneda: ARS o USD.
            </p>
          </div>

          <label className="block cursor-pointer">
            <div className="bg-blue-600 rounded-2xl px-5 py-4 flex items-center justify-center gap-3 active:opacity-80">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
                <path fillRule="evenodd" d="M11.47 2.47a.75.75 0 011.06 0l4.5 4.5a.75.75 0 01-1.06 1.06l-3.22-3.22V16.5a.75.75 0 01-1.5 0V4.81L8.03 8.03a.75.75 0 01-1.06-1.06l4.5-4.5zM3 15.75a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-semibold text-white">Elegir archivo CSV</span>
            </div>
            <input type="file" accept=".csv,text/csv" onChange={handleFileChange} className="sr-only" />
          </label>

          {fileError && (
            <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{fileError}</p>
          )}
        </div>
      </div>
    )
  }

  // ─── Delete ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar title="Importar historial" showBack />
      <div className="p-4 max-w-lg mx-auto space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          <p className="text-sm font-semibold text-gray-900">Paso 1: Borrar movimientos existentes</p>

          {existingCount === null ? (
            <p className="text-sm text-gray-400">Cargando…</p>
          ) : existingCount === 0 ? (
            <>
              <p className="text-sm text-gray-600">No hay movimientos existentes.</p>
              <button
                onClick={() => setStep('upload')}
                className="w-full bg-blue-600 text-white text-sm font-semibold px-5 py-3 rounded-xl active:opacity-80"
              >
                Continuar →
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Hay <span className="font-semibold">{existingCount}</span> movimiento
                {existingCount !== 1 ? 's' : ''} en la app. Para importar el historial
                desde cero, borrá todos primero.
              </p>
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={deleteConfirmed}
                  onChange={(e) => setDeleteConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300"
                />
                <span className="text-xs text-gray-600">
                  Entiendo que esta acción no se puede deshacer
                </span>
              </label>
              <button
                onClick={handleDelete}
                disabled={!deleteConfirmed || deleting}
                className="w-full bg-red-600 text-white text-sm font-semibold px-5 py-3 rounded-xl disabled:opacity-40 active:opacity-80"
              >
                {deleting ? 'Borrando…' : `Borrar ${existingCount} movimiento${existingCount !== 1 ? 's' : ''}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
