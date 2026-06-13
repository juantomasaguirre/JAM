import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { parseGaliciaPDF, GaliciaTransaction } from '../lib/parsers/galiciaParser'
import { suggestCategoryName } from '../lib/categoryKeywords'
import NavBar from '../components/NavBar'

interface DbCategory {
  id: string
  name: string
  kind: 'expense' | 'income'
}

interface PreviewRow extends GaliciaTransaction {
  scope: 'individual' | 'shared'
  selectedCategoryId: string | null
}

type Step = 'upload' | 'preview' | 'done'

const SCOPE_LABELS = { individual: 'Mío', shared: 'Nuestro' } as const

export default function BankImportPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('upload')
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [dbCategories, setDbCategories] = useState<DbCategory[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [householdId, setHouseholdId] = useState('')
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const [fileError, setFileError] = useState('')
  const [importError, setImportError] = useState('')

  useEffect(() => {
    async function load() {
      const [catsResult, userResult] = await Promise.all([
        supabase.from('categories').select('id, name, kind').eq('is_archived', false).order('name'),
        supabase.auth.getUser(),
      ])
      if (catsResult.data) setDbCategories(catsResult.data as DbCategory[])
      const userId = userResult.data.user?.id ?? ''
      setCurrentUserId(userId)
      if (userId) {
        const { data: profile } = await supabase
          .from('profiles').select('household_id').eq('id', userId).single()
        if (profile) setHouseholdId(profile.household_id)
      }
    }
    load()
  }, [])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileError('')
    setParsing(true)

    try {
      const transactions = await parseGaliciaPDF(file)
      if (transactions.length === 0) {
        setFileError('No se encontraron transacciones en el PDF. Verificá que sea un resumen Galicia VISA.')
        setParsing(false)
        return
      }

      const expenseCategories = dbCategories.filter((c) => c.kind === 'expense')
      const previewRows: PreviewRow[] = transactions.map((tx) => {
        const suggestedName = suggestCategoryName(tx.description, 'expense')
        const suggestedCat = expenseCategories.find((c) => c.name === suggestedName)
        return {
          ...tx,
          scope: 'individual',
          selectedCategoryId: suggestedCat?.id ?? null,
        }
      })

      setRows(previewRows)
      setStep('preview')
    } catch (err) {
      setFileError('Error al leer el PDF. Asegurate de que sea un resumen Galicia VISA válido.')
      console.error(err)
    }

    setParsing(false)
  }

  function toggleScope(index: number) {
    setRows((prev) =>
      prev.map((r, i) =>
        i === index ? { ...r, scope: r.scope === 'individual' ? 'shared' : 'individual' } : r,
      ),
    )
  }

  function setAllShared() {
    setRows((prev) => prev.map((r) => ({ ...r, scope: 'shared' })))
  }

  function setCategory(index: number, categoryId: string | null) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, selectedCategoryId: categoryId } : r)),
    )
  }

  async function handleImport() {
    if (!currentUserId || !householdId) return
    setImporting(true)
    setImportError('')

    const movements = rows.map((r) => ({
      household_id: householdId,
      created_by: currentUserId,
      owner_id: currentUserId,
      scope: r.scope,
      kind: 'expense' as const,
      category_id: r.selectedCategoryId,
      description: r.installment
        ? `${r.description} (${r.installment})`
        : r.description,
      amount: r.amount,
      currency: r.currency,
      occurred_on: r.date,
      paid_by: r.scope === 'shared' ? currentUserId : null,
    }))

    const { error } = await supabase.from('movements').insert(movements)
    if (error) {
      setImportError(error.message)
      setImporting(false)
      return
    }

    setImportedCount(movements.length)
    setStep('done')
    setImporting(false)
  }

  // ─── Upload ───────────────────────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <div className="min-h-screen bg-surface">
        <NavBar title="Importar resumen bancario" showBack />
        <div className="p-4 max-w-lg mx-auto space-y-4">

          <div className="bg-card rounded-2xl p-4 shadow-sm space-y-2">
            <p className="text-sm font-semibold text-gray-900">Banco</p>
            <div className="flex rounded-xl overflow-hidden border border-border bg-surface">
              <button className="flex-1 py-3 text-sm font-semibold bg-gray-800 text-white">
                Galicia VISA
              </button>
              <button
                className="flex-1 py-3 text-sm font-semibold text-gray-300 cursor-not-allowed"
                disabled
              >
                Santander (próximamente)
              </button>
            </div>
          </div>

          <div className="bg-card rounded-2xl p-4 shadow-sm space-y-2">
            <p className="text-sm font-semibold text-gray-900">¿Cómo obtener el PDF?</p>
            <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
              <li>Ingresá a Galicia Online o la app</li>
              <li>Tarjetas → tu VISA → Ver resumen</li>
              <li>Descargá el resumen en PDF</li>
            </ol>
          </div>

          <label className={`block ${parsing ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}>
            <div className="bg-primary rounded-2xl px-5 py-4 flex items-center justify-center gap-3 active:opacity-80">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
                <path fillRule="evenodd" d="M11.47 2.47a.75.75 0 011.06 0l4.5 4.5a.75.75 0 01-1.06 1.06l-3.22-3.22V16.5a.75.75 0 01-1.5 0V4.81L8.03 8.03a.75.75 0 01-1.06-1.06l4.5-4.5zM3 15.75a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-semibold text-white">
                {parsing ? 'Leyendo PDF…' : 'Subir resumen PDF'}
              </span>
            </div>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFile}
              className="sr-only"
              disabled={parsing}
            />
          </label>

          {fileError && (
            <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{fileError}</p>
          )}
        </div>
      </div>
    )
  }

  // ─── Done ────────────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 gap-5">
        <div className="text-5xl">✅</div>
        <p className="text-lg font-bold text-gray-900 text-center">
          Se importaron {importedCount} movimiento{importedCount !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => navigate('/movements')}
          className="bg-primary text-white text-sm font-semibold px-6 py-3 rounded-xl active:opacity-80"
        >
          Ver movimientos
        </button>
      </div>
    )
  }

  // ─── Preview ─────────────────────────────────────────────────────────────────
  const sharedCount = rows.filter((r) => r.scope === 'shared').length
  const expenseCategories = dbCategories.filter((c) => c.kind === 'expense')

  return (
    <div className="min-h-screen bg-surface pb-6">
      <NavBar title="Confirmar importación" showBack />
      <div className="p-4 max-w-lg mx-auto space-y-4">

        {/* Summary + bulk action */}
        <div className="bg-card rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {rows.length} movimiento{rows.length !== 1 ? 's' : ''} encontrado{rows.length !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {sharedCount} nuestro{sharedCount !== 1 ? 's' : ''}
                {' · '}
                {rows.length - sharedCount} mío{rows.length - sharedCount !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => { setStep('upload'); setRows([]) }}
              className="text-xs text-primary font-medium"
            >
              Cambiar PDF
            </button>
          </div>
          {sharedCount < rows.length && (
            <button
              onClick={setAllShared}
              className="w-full text-xs font-semibold text-gray-600 border border-border rounded-xl py-2.5 active:bg-sand"
            >
              Marcar todos como Nuestro
            </button>
          )}
        </div>

        {/* Row cards */}
        {rows.map((row, index) => (
          <div key={index} className="bg-card rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {row.description}
                  {row.installment && (
                    <span className="ml-1 text-xs text-gray-400 font-normal">({row.installment})</span>
                  )}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(row.date + 'T12:00:00').toLocaleDateString('es-AR', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                  {row.isBankCharge && (
                    <span className="ml-1.5 text-amber-500">· cargo bancario</span>
                  )}
                </p>
              </div>
              <span className="text-sm font-bold text-red-500 whitespace-nowrap">
                {row.currency === 'ARS' ? '$ ' : 'U$S '}
                {new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(row.amount)}
              </span>
            </div>

            {/* Scope toggle + category */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => toggleScope(index)}
                className={`text-xs font-semibold px-3 py-2 rounded-lg border transition-colors ${
                  row.scope === 'shared'
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'text-gray-500 border-border'
                }`}
              >
                {SCOPE_LABELS[row.scope]}
              </button>
              <select
                value={row.selectedCategoryId ?? ''}
                onChange={(e) => setCategory(index, e.target.value || null)}
                className="flex-1 text-xs text-gray-700 bg-card border border-border rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Sin categoría</option>
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        ))}

        {importError && (
          <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{importError}</p>
        )}

        <button
          onClick={handleImport}
          disabled={importing || rows.length === 0}
          className="w-full bg-primary text-white text-sm font-semibold px-5 py-4 rounded-2xl active:opacity-80 disabled:opacity-50"
        >
          {importing ? 'Importando…' : `Importar ${rows.length} movimiento${rows.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}
