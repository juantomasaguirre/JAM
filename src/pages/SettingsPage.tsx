import { useState } from 'react'
import { supabase } from '../lib/supabase'
import NavBar from '../components/NavBar'

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function firstOfMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function downloadCSV(rows: string[][], filename: string) {
  const content = rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  // BOM for Excel UTF-8 compatibility
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

interface MovementRow {
  occurred_on: string
  description: string | null
  categories: { name: string } | null
  kind: string
  scope: string
  amount: number
  currency: string
}

export default function SettingsPage() {
  const [dateFrom, setDateFrom] = useState(firstOfMonth())
  const [dateTo, setDateTo] = useState(localToday())
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  async function handleExport() {
    setExporting(true)
    setExportError('')

    const { data, error } = await supabase
      .from('movements')
      .select('occurred_on, description, categories(name), kind, scope, amount, currency')
      .gte('occurred_on', dateFrom)
      .lte('occurred_on', dateTo)
      .order('occurred_on', { ascending: false })

    if (error || !data) {
      setExportError('Error al exportar. Intentá de nuevo.')
      setExporting(false)
      return
    }

    const header = ['Fecha', 'Descripción', 'Categoría', 'Tipo', 'Alcance', 'Monto', 'Moneda']
    const rows = (data as unknown as MovementRow[]).map((m) => [
      m.occurred_on,
      m.description ?? '',
      m.categories?.name ?? 'Sin categoría',
      m.kind === 'expense' ? 'Gasto' : 'Ingreso',
      m.scope === 'individual' ? 'Individual' : 'Compartido',
      String(m.amount),
      m.currency,
    ])

    downloadCSV([header, ...rows], `movimientos_${dateFrom}_${dateTo}.csv`)
    setExporting(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-surface">
      <NavBar title="Ajustes" backTo="/" />

      <div className="p-4 space-y-4 max-w-lg mx-auto">

        <div className="bg-card rounded-2xl p-4 shadow-sm space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Exportar movimientos
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Desde</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Hasta</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          {exportError && <p className="text-xs text-negative">{exportError}</p>}
          <button
            onClick={handleExport}
            disabled={exporting || !dateFrom || !dateTo}
            className="w-full bg-primary text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50 active:opacity-80 transition-opacity"
          >
            {exporting ? 'Exportando…' : 'Descargar CSV'}
          </button>
        </div>

        <div className="bg-card rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Sesión
          </p>
          <button
            onClick={handleLogout}
            className="w-full py-3 rounded-xl text-sm font-semibold text-negative border border-negative/30 active:opacity-80 transition-opacity"
          >
            Cerrar sesión
          </button>
        </div>

      </div>
    </div>
  )
}
