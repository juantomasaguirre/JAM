import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

webpush.setVapidDetails(
  'mailto:juantomas.aguirre@gmail.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS })
  }

  const { category_name } = await req.json()
  if (!category_name) {
    return new Response('Bad Request', { status: 400, headers: CORS_HEADERS })
  }

  // Verify JWT and get user
  const { data: { user }, error: authError } = await adminSupabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  )
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS })
  }

  // Get household
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('household_id')
    .eq('id', user.id)
    .single()
  if (!profile) {
    return new Response('Profile not found', { status: 404, headers: CORS_HEADERS })
  }

  // Get all users in household
  const { data: profiles } = await adminSupabase
    .from('profiles')
    .select('id')
    .eq('household_id', profile.household_id)
  const userIds = (profiles ?? []).map((p: { id: string }) => p.id)

  // Get push subscriptions
  const { data: subs } = await adminSupabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth_key')
    .in('user_id', userIds)

  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })
  }

  const title = '⚠️ Presupuesto superado'
  const body = `Superaste el límite mensual en "${category_name}"`

  let sent = 0
  const expiredEndpoints: string[] = []

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        JSON.stringify({ title, body, url: '/dashboard' }),
      )
      sent++
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode
      if (status === 410) expiredEndpoints.push(sub.endpoint)
    }
  }

  if (expiredEndpoints.length > 0) {
    await adminSupabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints)
  }

  return new Response(JSON.stringify({ sent }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
})
