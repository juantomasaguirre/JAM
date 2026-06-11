import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

webpush.setVapidDetails(
  'mailto:juantomas.aguirre@gmail.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

function lastDayOfMonth(year: number, month: number): number {
  // month is 1-based; new Date(y, m, 0) gives last day of month m
  return new Date(year, month, 0).getDate()
}

function effectiveDueDay(dueDay: number, year: number, month: number): number {
  return Math.min(dueDay, lastDayOfMonth(year, month))
}

Deno.serve(async () => {
  const now = new Date()

  const todayYear = now.getUTCFullYear()
  const todayMonth = now.getUTCMonth() + 1
  const todayDay = now.getUTCDate()

  const tomorrow = new Date(now)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const tomorrowYear = tomorrow.getUTCFullYear()
  const tomorrowMonth = tomorrow.getUTCMonth() + 1
  const tomorrowDay = tomorrow.getUTCDate()

  // Fetch all active payments
  const { data: payments, error: paymentsError } = await supabase
    .from('recurring_payments')
    .select('id, name, due_day, household_id')
    .eq('is_active', true)

  if (paymentsError) {
    console.error('payments query failed:', paymentsError)
    return new Response(JSON.stringify({ error: paymentsError.message }), { status: 500 })
  }

  // Filter to today/tomorrow
  const matching = (payments ?? []).filter((p) => {
    const eToday = effectiveDueDay(p.due_day, todayYear, todayMonth)
    const eTomorrow = effectiveDueDay(p.due_day, tomorrowYear, tomorrowMonth)
    return eToday === todayDay || eTomorrow === tomorrowDay
  })

  if (matching.length === 0) {
    return new Response(JSON.stringify({ sent: 0, failed: 0, reason: 'no payments due' }), { status: 200 })
  }

  // Get profiles for all relevant households
  const householdIds = [...new Set(matching.map((p) => p.household_id))]

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, household_id')
    .in('household_id', householdIds)

  const userIds = (profiles ?? []).map((p: { id: string }) => p.id)

  if (userIds.length === 0) {
    return new Response(JSON.stringify({ sent: 0, failed: 0, reason: 'no users found' }), { status: 200 })
  }

  // Get push subscriptions for those users
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth_key')
    .in('user_id', userIds)

  // Build household → subscriptions map
  const householdSubs: Record<string, { endpoint: string; p256dh: string; auth_key: string }[]> = {}
  for (const prof of profiles ?? []) {
    const userSubs = (subs ?? []).filter(
      (s: { user_id: string }) => s.user_id === prof.id,
    )
    if (userSubs.length > 0) {
      if (!householdSubs[prof.household_id]) householdSubs[prof.household_id] = []
      householdSubs[prof.household_id].push(...userSubs)
    }
  }

  let sent = 0
  let failed = 0
  const expiredEndpoints: string[] = []

  for (const payment of matching) {
    const eToday = effectiveDueDay(payment.due_day, todayYear, todayMonth)
    const dueToday = eToday === todayDay

    const title = dueToday ? `Vence hoy: ${payment.name}` : `Mañana vence: ${payment.name}`
    const body = dueToday
      ? `Hoy es día ${payment.due_day} — recordá pagar ${payment.name}.`
      : `Mañana es día ${payment.due_day} — recordá pagar ${payment.name}.`

    const recipients = householdSubs[payment.household_id] ?? []

    for (const sub of recipients) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          JSON.stringify({ title, body, url: '/gastos-recurrentes' }),
        )
        sent++
      } catch (err: unknown) {
        console.error(`Failed for ${sub.endpoint}:`, err)
        const status = (err as { statusCode?: number }).statusCode
        // HTTP 410 Gone = subscription expired; clean it up
        if (status === 410) expiredEndpoints.push(sub.endpoint)
        failed++
      }
    }
  }

  // Remove expired subscriptions
  if (expiredEndpoints.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints)
  }

  return new Response(JSON.stringify({ sent, failed }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
