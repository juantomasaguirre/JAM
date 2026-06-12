import { useEffect, useRef, useState } from 'react'
import { usePushNotifications } from '../hooks/usePushNotifications'

const STORAGE_KEY = 'push_prompted'

export default function PushPromptBanner() {
  const { isSupported, iosNotInstalled, checkSubscribed, subscribe } = usePushNotifications()
  const [visible, setVisible] = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const checkedRef = useRef(false)

  useEffect(() => {
    if (checkedRef.current || !isSupported || iosNotInstalled) return
    if (localStorage.getItem(STORAGE_KEY)) return
    checkedRef.current = true
    checkSubscribed().then((ok) => { if (!ok) setVisible(true) })
  }, [isSupported, iosNotInstalled, checkSubscribed])

  if (!visible) return null

  async function handleActivar() {
    setSubscribing(true)
    await subscribe()
    localStorage.setItem(STORAGE_KEY, 'done')
    setVisible(false)
    setSubscribing(false)
  }

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, 'dismissed')
    setVisible(false)
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-gray-900 px-4 py-3 flex items-center gap-3 shadow-lg">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">Activá recordatorios de pagos</p>
        <p className="text-xs text-white/50">Te avisamos cuando vence un pago mensual</p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button onClick={handleDismiss} className="text-xs text-white/50 px-2 py-1">
          Ahora no
        </button>
        <button
          onClick={handleActivar}
          disabled={subscribing}
          className="text-xs font-semibold bg-primary text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
        >
          {subscribing ? '…' : 'Activar'}
        </button>
      </div>
    </div>
  )
}
