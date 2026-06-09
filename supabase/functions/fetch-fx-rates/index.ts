import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Maps DolarAPI "casa" field to our dollar_type values
const CASA_MAP: Record<string, string> = {
  oficial:        'oficial',
  blue:           'blue',
  bolsa:          'mep',
  contadoconliqui:'ccl',
  mayorista:      'mayorista',
  tarjeta:        'tarjeta',
  cripto:         'cripto',
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const res = await fetch('https://dolarapi.com/v1/dolares')
  if (!res.ok) {
    return new Response(`DolarAPI error: ${res.status}`, { status: 502 })
  }

  const data: Array<{ casa: string; compra: number | null; venta: number | null }> =
    await res.json()

  // Argentina is UTC-3 with no DST — derive local date without relying on server TZ
  const argNow = new Date(Date.now() - 3 * 60 * 60 * 1000)
  const today = argNow.toISOString().split('T')[0]

  const rows = data
    .filter((r) => CASA_MAP[r.casa])
    .map((r) => ({
      rate_date:   today,
      dollar_type: CASA_MAP[r.casa],
      buy:         r.compra,
      sell:        r.venta,
      source:      'dolarapi',
    }))

  const { error } = await supabase
    .from('fx_rates')
    .upsert(rows, { onConflict: 'rate_date,dollar_type' })

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(
    JSON.stringify({ ok: true, date: today, saved: rows.length }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
