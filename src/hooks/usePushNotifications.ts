import { useCallback } from 'react'
import { supabase } from '../lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export type SubscribeResult = 'subscribed' | 'denied' | 'error' | 'unsupported' | 'no_vapid_key'

export function usePushNotifications() {
  const isSupported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window

  const isIOS = /iphone|ipad|ipod/i.test(
    typeof navigator !== 'undefined' ? navigator.userAgent : '',
  )
  // On iOS, push only works when installed to home screen
  const iosNotInstalled = isIOS && !('standalone' in navigator && (navigator as { standalone?: boolean }).standalone)

  async function checkSubscribed(): Promise<boolean> {
    if (!isSupported) return false
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    return !!sub
  }

  const subscribe = useCallback(async (): Promise<SubscribeResult> => {
    if (!isSupported) return 'unsupported'
    if (!VAPID_PUBLIC_KEY) return 'no_vapid_key'

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return 'denied'

    try {
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }))

      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return 'error'

      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: user.id,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth_key: json.keys.auth,
        },
        { onConflict: 'endpoint' },
      )

      if (error) { console.error(error); return 'error' }
      return 'subscribed'
    } catch (err) {
      console.error(err)
      return 'error'
    }
  }, [isSupported])

  return { isSupported, iosNotInstalled, checkSubscribed, subscribe }
}
