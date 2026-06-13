import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).href

export interface GaliciaTransaction {
  date: string           // YYYY-MM-DD
  description: string    // cleaned description
  installment: string | null  // e.g. "6/9", null if single payment
  amount: number
  currency: 'ARS' | 'USD'
  isBankCharge: boolean
}

// Argentine number format: 1.234,56
function parseArgAmount(s: string): number {
  return parseFloat(s.replace(/\./g, '').replace(',', '.'))
}

// DD-MM-YY → YYYY-MM-DD
function parseGaliciaDate(s: string): string | null {
  const m = s.match(/^(\d{2})-(\d{2})-(\d{2})$/)
  if (!m) return null
  return `20${m[3]}-${m[2]}-${m[1]}`
}

const AMOUNT_RE = /^\d{1,3}(?:\.\d{3})*(?:,\d{2})$/

// Lines that should not be imported as transactions
const SKIP_PATTERNS = [
  /TARJETA \d{4} Total Consumos/i,
  /^TOTAL A PAGAR/i,
  /^SALDO ANTERIOR/i,
  /^SU PAGO EN/i,
  /^FECHA\s+REFERENCIA/i,
  /^DETALLE DEL CONSUMO/i,
  /^CONSOLIDADO/i,
  /^PESOS\s+DÓLARES/i,
]

const BANK_CHARGE_PATTERNS = [
  /^INTERESES FINANCIACION/i,
  /^DB IVA/i,
  /^COM MANT/i,
  /^PERCEPCION/i,
  /^IMPUESTO/i,
]

type TextItem = { x: number; y: number; str: string }

async function extractTextItems(file: File): Promise<TextItem[]> {
  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
  const pdf = await loadingTask.promise

  const items: TextItem[] = []

  // Only parse first 2 pages — pages 3+ are legal text with no transactions
  const maxPage = Math.min(pdf.numPages, 2)
  for (let p = 1; p <= maxPage; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    for (const item of content.items) {
      if ('str' in item && item.str.trim()) {
        const x = item.transform[4]
        const y = item.transform[5]
        items.push({ x, y: Math.round(y), str: item.str.trim() })
      }
    }
  }

  return items
}

function groupIntoLines(items: TextItem[]): string[] {
  const byY = new Map<number, TextItem[]>()
  for (const item of items) {
    // Snap Y to nearest 2pt to merge items on the same visual row
    const snappedY = Math.round(item.y / 2) * 2
    const group = byY.get(snappedY) ?? []
    group.push(item)
    byY.set(snappedY, group)
  }

  // Sort Y descending (PDF Y=0 is bottom, so larger Y = higher on page)
  const sortedYs = Array.from(byY.keys()).sort((a, b) => b - a)

  return sortedYs.map((y) => {
    const rowItems = byY.get(y)!.sort((a, b) => a.x - b.x)
    return rowItems.map((i) => i.str).join(' ')
  })
}

function parseLine(line: string): GaliciaTransaction | null {
  // Must start with a date
  const dateMatch = line.match(/^(\d{2}-\d{2}-\d{2})\s+/)
  if (!dateMatch) return null

  const date = parseGaliciaDate(dateMatch[1])
  if (!date) return null

  const rest = line.slice(dateMatch[0].length).trim()

  // Skip non-transaction lines
  const fullLine = line
  if (SKIP_PATTERNS.some((p) => p.test(fullLine) || p.test(rest))) return null

  // Check if this is a bank charge
  const isBankCharge = BANK_CHARGE_PATTERNS.some((p) => p.test(rest))

  // Tokenize the rest and extract amounts from the right side
  // Amounts match the Argentine format: digits with optional . thousands and , decimal
  const tokens = rest.split(/\s+/)

  // Collect amount tokens from the right (1 or 2 amounts at the end)
  const amountTokens: string[] = []
  let i = tokens.length - 1
  while (i >= 0 && amountTokens.length < 2 && AMOUNT_RE.test(tokens[i])) {
    amountTokens.unshift(tokens[i])
    i--
  }

  if (amountTokens.length === 0) return null

  // Determine currency and amount
  // If only the last column (DÓLARES) has a value → USD transaction
  // We detect this by checking if the description contains "USD"
  let currency: 'ARS' | 'USD' = 'ARS'
  let amount: number

  if (rest.includes('USD') || rest.toLowerCase().includes('u$s')) {
    currency = 'USD'
    // Last amount is the dollar figure
    amount = parseArgAmount(amountTokens[amountTokens.length - 1])
  } else {
    // First amount from the right is the ARS amount
    // If there are 2 amounts and the last one is in the dólares column, use the first
    amount = parseArgAmount(amountTokens[0])
  }

  if (isNaN(amount) || amount <= 0) return null

  // Remove amount tokens from working tokens
  const descTokens = tokens.slice(0, i + 1)

  // Extract installment (cuota) pattern: NN/NN
  const cuotaIdx = descTokens.findIndex((t) => /^\d{2}\/\d{2}$/.test(t))
  let installment: string | null = null
  if (cuotaIdx !== -1) {
    const [cur, total] = descTokens[cuotaIdx].split('/')
    installment = `${parseInt(cur)}/${parseInt(total)}`
    descTokens.splice(cuotaIdx, 1)
  }

  // Remove comprobante (4-6 digit pure integer that isn't a date part)
  const comprobanteIdx = descTokens.findIndex((t) => /^\d{4,6}$/.test(t))
  if (comprobanteIdx !== -1) {
    descTokens.splice(comprobanteIdx, 1)
  }

  // Remove leading * if present
  if (descTokens[0] === '*') descTokens.shift()

  // Clean up description: remove "USD X,XX" substring that may appear inline
  let description = descTokens.join(' ').replace(/USD\s+[\d.,]+/i, '').trim()

  // Strip trailing $ sign that appears in some bank charge descriptions
  description = description.replace(/\s*\$\s*$/, '').trim()

  if (!description) return null

  return { date, description, installment, amount, currency, isBankCharge }
}

export async function parseGaliciaPDF(file: File): Promise<GaliciaTransaction[]> {
  const items = await extractTextItems(file)
  const lines = groupIntoLines(items)

  const results: GaliciaTransaction[] = []
  let inDetailSection = false

  for (const line of lines) {
    if (/DETALLE DEL CONSUMO/i.test(line)) {
      inDetailSection = true
      continue
    }
    if (!inDetailSection) continue
    // Stop after the total line
    if (/TOTAL A PAGAR/i.test(line)) break

    const tx = parseLine(line)
    if (tx) results.push(tx)
  }

  return results
}
