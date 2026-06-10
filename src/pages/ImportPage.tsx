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

interface ParsedRow {
  lineNumber: number
  occurred_on: string
  description: string
  amount: number
  currency: 'ARS' | 'USD'
  kind: 'expense' | 'income'
  scope: 'individual' | 'shared' | 'loan'
  errors: string[]
  selectedCategoryId: string | null
}

type Step = 'upload' | 'preview' | 'done'

const SCOPE_LABEL: Record<string, string> = {
  individual: 'Mío',
  shared: 'Nuestro',
  loan: 'Tuyo',
}

function parseMonto(raw: string): number {
  const s = raw.trim().replace(/\s/g, '')
  if (s.includes(',') && s.includes('.')) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.'))
  }
  if (s.includes(',')) return parseFloat(s.replace(',', '.'))
  const dots = (s.match(/\./g) ?? []).length
  if (dots > 1) return parseFloat(s.replace(/\./g, ''))
  if (dots === 1) {
    const parts = s.split('.')
    // 3 digits after the only dot → Argentine thousand separator (15.000 = 15000)
    if (parts[1].length === 3) return parseFloat(s.replace('.', ''))
    return parseFloat(s)
  }
  return parseFloat(s)
}

function parseRow(cells: string[], lineNumber: number, categories: DbCategory[]): ParsedRow {
  const errors: string[] = []

  // fecha: DD/MM/YYYY (also accept D/M/YYYY)
  const rawFecha = cells[0]?.trim() ?? ''
  let occurred_on = ''
  const m = rawFecha.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) {
    errors.push('Fecha inválida (usar DD/MM/AAAA)')
  } else {
    const d = m[1].padStart(2, '0')
    const mo = m[2].padStart(2, '0')
    const y = m[3]
    const date = new Date(`${y}-${mo}-${d}T12:00:00`)
    if (isNaN(date.getTime())) errors.push('Fecha inválida')
    else occurred_on = `${y}-${mo}-${d}`
  }

  // descripcion
  const description = cells[1]?.trim() ?? ''
  if (!description) errors.push('Descripción vacía')

  // monto
  const rawMonto = cells[2]?.trim() ?? ''
  const amount = parseMonto(rawMonto)
  if (isNaN(amount) || amount <= 0) errors.push('Monto inválido (debe ser un número positivo)')

  // moneda
  const rawMoneda = cells[3]?.trim().toUpperCase() ?? ''
  let currency: 'ARS' | 'USD' = 'ARS'
  if (rawMoneda === 'ARS' || rawMoneda === 'USD') currency = rawMoneda
  else errors.push('Moneda inválida (usar ARS o USD)')

  // tipo
  const rawTipo = cells[4]?.trim().toLowerCase() ?? ''
  let kind: 'expense' | 'income' = 'expense'
  if (['gasto', 'expense'].includes(rawTipo)) kind = 'expense'
  else if (['ingreso', 'income'].includes(rawTipo)) kind = 'income'
  else errors.push('Tipo inválido (usar "gasto" o "ingreso")')

  // scope
  const rawScope = cells[5]?.trim().toLowerCase() ?? ''
  let scope: 'individual' | 'shared' | 'loan' = 'individual'
  if (['mío', 'mio', 'individual'].includes(rawScope)) scope = 'individual'
  else if (['nuestro', 'shared'].includes(rawScope)) scope = 'shared'
  else if (['tuyo', 'loan'].includes(rawScope)) scope = 'loan'
  else errors.push('Scope inválido (usar "mío", "nuestro" o "tuyo")')

  // Suggest category based on description + kind
  const suggestedName = errors.length === 0 ? suggestCategoryName(description, kind) : null
  const suggestedCat = categories.find((c) => c.name === suggestedName && c.kind === kind)

  return {
    lineNumber,
    occurred_on,
    description,
    amount: isNaN(amount) ? 0 : amount,
    currency,
    kind,
    scope,
    errors,
    selectedCategoryId: suggestedCat?.id ?? null,
  }
}

function downloadTemplate() {
  const csv = [
    'fecha,descripcion,monto,moneda,tipo,scope',
    '01/06/2026,Supermercado Jumbo,15000,ARS,gasto,mío',
    '01/06/2026,Netflix,12,USD,gasto,nuestro',
    '15/05/2026,Sueldo,1800,USD,ingreso,mío',
  ].join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'template-jam.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function ImportPage() {
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('upload')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [dbCategories, setDbCategories] = useState<DbCategory[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [householdId, setHouseholdId] = useState('')
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
          .from('profiles')
          .select('household_id')
          .eq('id', userId)
          .single()
        if (profile) setHouseholdId(profile.household_id)
      }
    }
    load()
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileError('')

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = (ev.target?.result as string ?? '').replace(/^﻿/, '')
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

      if (lines.length < 2) {
        setFileError('El archivo está vacío o solo tiene el encabezado.')
        return
      }

      const dataLines = lines.slice(1) // skip header
      const parsed = dataLines.map((line, i) => {
        const cells = line.split(',')
        return parseRow(cells, i + 2, dbCategories) // +2: 1-based + skip header
      })

      setRows(parsed)
      setStep('preview')
    }
    reader.readAsText(file, 'UTF-8')
  }

  function updateRowCategory(index: number, categoryId: string | null) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, selectedCategoryId: categoryId } : r)),
    )
  }

  async function handleImport() {
    if (!currentUserId || !householdId) return
    setImporting(true)
    setImportError('')

    const validRows = rows.filter((r) => r.errors.length === 0)
    const movements = validRows.map((r) => ({
      household_id: householdId,
      created_by: currentUserId,
      owner_id: currentUserId,
      scope: r.scope,
      kind: r.kind,
      category_id: r.selectedCategoryId,
      description: r.description,
      amount: r.amount,
      currency: r.currency,
      occurred_on: r.occurred_on,
      paid_by: r.scope === 'individual' ? null : currentUserId,
    }))

    const { error } = await supabase.from('movements').insert(movements)
    if (error) {
      setImportError(error.message)
      setImporting(false)
      return
    }

    setImportedCount(validRows.length)
    setStep('done')
    setImporting(false)
  }

  const validCount = rows.filter((r) => r.errors.length === 0).length
  const errorCount = rows.length - validCount

  // ─── Upload step ─────────────────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <div className="min-h-screen bg-surface">
        <NavBar title="Importar CSV" showBack />
        <div className="p-4 max-w-lg mx-auto space-y-4">
          <div className="bg-card rounded-2xl p-4 shadow-sm space-y-3">
            <p className="text-sm font-semibold text-gray-900">Formato esperado</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Archivo CSV con estas columnas en orden:
            </p>
            <div className="bg-sand rounded-lg p-3 font-mono text-xs text-gray-600 overflow-x-auto whitespace-nowrap">
              fecha, descripcion, monto, moneda, tipo, scope
            </div>
            <ul className="text-xs text-gray-500 space-y-1">
              <li><span className="font-medium text-gray-700">fecha</span> — DD/MM/AAAA</li>
              <li><span className="font-medium text-gray-700">moneda</span> — ARS o USD</li>
              <li><span className="font-medium text-gray-700">tipo</span> — gasto o ingreso</li>
              <li><span className="font-medium text-gray-700">scope</span> — mío, nuestro o tuyo</li>
            </ul>
            <p className="text-xs text-gray-400">
              La categoría se sugiere automáticamente según la descripción. La podés cambiar en la previa.
            </p>
            <button
              onClick={downloadTemplate}
              className="text-xs text-primary font-medium"
            >
              Descargar plantilla de ejemplo →
            </button>
          </div>

          <label className="block cursor-pointer">
            <div className="bg-primary rounded-2xl px-5 py-4 flex items-center justify-center gap-3 active:opacity-80">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
                <path fillRule="evenodd" d="M11.47 2.47a.75.75 0 011.06 0l4.5 4.5a.75.75 0 01-1.06 1.06l-3.22-3.22V16.5a.75.75 0 01-1.5 0V4.81L8.03 8.03a.75.75 0 01-1.06-1.06l4.5-4.5zM3 15.75a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-semibold text-white">Elegir archivo CSV</span>
            </div>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="sr-only"
            />
          </label>

          {fileError && (
            <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{fileError}</p>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-xs font-semibold text-amber-800">
              ¿Importando historial de Tricount o Splitwise?
            </p>
            <button
              onClick={() => navigate('/import/historical')}
              className="text-xs text-amber-700 underline mt-1"
            >
              Usar el importador de historial →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Done step ───────────────────────────────────────────────────────────────
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

  // ─── Preview step ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-surface pb-6">
      <NavBar title="Confirmar importación" showBack />
      <div className="p-4 max-w-lg mx-auto space-y-4">
        {/* Summary banner */}
        <div className="bg-card rounded-2xl p-4 shadow-sm flex justify-between items-center">
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {rows.length} fila{rows.length !== 1 ? 's' : ''} encontrada{rows.length !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {validCount} válida{validCount !== 1 ? 's' : ''}
              {errorCount > 0 && (
                <span className="text-red-500">
                  {' '}· {errorCount} con error{errorCount !== 1 ? 'es' : ''}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => { setStep('upload'); setRows([]) }}
            className="text-xs text-primary font-medium"
          >
            Cambiar archivo
          </button>
        </div>

        {/* Row cards */}
        {rows.map((row, index) => {
          const hasError = row.errors.length > 0
          const catOptions = dbCategories.filter((c) => c.kind === row.kind)
          return (
            <div
              key={index}
              className={`bg-card rounded-2xl p-4 shadow-sm ${hasError ? 'border border-red-200' : ''}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1 mr-3">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {row.description || <span className="text-gray-400 italic">sin descripción</span>}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {row.occurred_on
                      ? new Date(row.occurred_on + 'T12:00:00').toLocaleDateString('es-AR', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })
                      : '—'}
                    {' · '}
                    <span className={row.kind === 'expense' ? 'text-red-400' : 'text-green-500'}>
                      {row.kind === 'expense' ? 'gasto' : 'ingreso'}
                    </span>
                    {' · '}
                    {SCOPE_LABEL[row.scope] ?? row.scope}
                  </p>
                </div>
                <span className={`text-sm font-bold whitespace-nowrap ${row.kind === 'expense' ? 'text-red-500' : 'text-green-600'}`}>
                  {row.currency === 'ARS' ? '$ ' : 'U$S '}
                  {row.amount > 0
                    ? new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(row.amount)
                    : '—'}
                </span>
              </div>

              {/* Category selector */}
              {!hasError && (
                <div className="mt-2">
                  <select
                    value={row.selectedCategoryId ?? ''}
                    onChange={(e) => updateRowCategory(index, e.target.value || null)}
                    className="w-full text-xs text-gray-700 bg-card border border-border rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Sin categoría</option>
                    {catOptions.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Errors */}
              {hasError && (
                <div className="mt-2 space-y-1">
                  {row.errors.map((err, i) => (
                    <p key={i} className="text-xs text-red-500 flex items-start gap-1">
                      <span className="mt-px">⚠</span> {err}
                    </p>
                  ))}
                  <p className="text-xs text-gray-400">Fila {row.lineNumber} no se importará.</p>
                </div>
              )}
            </div>
          )
        })}

        {/* Import error */}
        {importError && (
          <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{importError}</p>
        )}

        {/* Action button */}
        {validCount > 0 ? (
          <button
            onClick={handleImport}
            disabled={importing}
            className="w-full bg-primary text-white text-sm font-semibold px-5 py-4 rounded-2xl active:opacity-80 disabled:opacity-50"
          >
            {importing ? 'Importando…' : `Importar ${validCount} movimiento${validCount !== 1 ? 's' : ''}`}
          </button>
        ) : (
          <p className="text-center text-sm text-gray-400">
            No hay movimientos válidos para importar.
          </p>
        )}
      </div>
    </div>
  )
}
