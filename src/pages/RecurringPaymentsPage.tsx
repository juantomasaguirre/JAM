import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { usePushNotifications } from '../hooks/usePushNotifications'
import NavBar from '../components/NavBar'
import BottomNav from '../components/BottomNav'

interface RecurringPayment {
  id: string
  name: string
  due_day: number
  is_active: boolean
}

export default function RecurringPaymentsPage() {
  const navigate = useNavigate()
  const { isSupported, iosNotInstalled, checkSubscribed, subscribe } = usePushNotifications()
  const [subStatus, setSubStatus] = useState<'loading' | 'subscribed' | 'unsubscribed' | 'unavailable'>('loading')
  const [subscribing, setSubscribing] = useState(false)

  useEffect(() => {
    if (!isSupported) { setSubStatus('unavailable'); return }
    checkSubscribed().then((ok) => setSubStatus(ok ? 'subscribed' : 'unsubscribed'))
  }, [isSupported, checkSubscribed])

  async function handleSubscribe() {
    setSubscribing(true)
    const result = await subscribe()
    if (result === 'subscribed') setSubStatus('subscribed')
    setSubscribing(false)
  }

  const [payments, setPayments] = useState<RecurringPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('recurring_payments')
      .select('id, name, due_day, is_active')
      .order('due_day')
      .then(({ data }) => {
        if (data) setPayments(data)
        setLoading(false)
      })
  }, [])

  async function handleToggle(id: string, current: boolean) {
    setToggling(id)
    await supabase
      .from('recurring_payments')
      .update({ is_active: !current })
      .eq('id', id)
    setPayments((prev) =>
      prev.map((p) => (p.id === id ? { ...p, is_active: !current } : p)),
    )
    setToggling(null)
  }

  const active = payments.filter((p) => p.is_active)
  const inactive = payments.filter((p) => !p.is_active)

  return (
    <div className="min-h-screen bg-surface pb-16">
      <NavBar
        title="Gastos recurrentes"
        backTo="/dashboard"
        right={
          <button
            onClick={() => navigate('/gastos-recurrentes/new')}
            className="text-white text-2xl font-light leading-none pb-0.5"
            aria-label="Nuevo pago recurrente"
          >
            +
          </button>
        }
      />

      {/* Push notification section */}
      {subStatus !== 'loading' && subStatus !== 'unavailable' && (
        <div className="mx-4 mt-4">
          {iosNotInstalled ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              Para recibir notificaciones en iOS, instalá la app desde el menú Compartir de Safari.
            </div>
          ) : subStatus === 'subscribed' ? (
            <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2.5">
              <span className="text-green-600 font-bold text-sm">✓</span>
              <span className="text-xs text-primary font-medium">Notificaciones activadas</span>
            </div>
          ) : (
            <button
              onClick={handleSubscribe}
              disabled={subscribing}
              className="w-full bg-primary text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 active:opacity-80 transition-opacity"
            >
              {subscribing ? 'Activando…' : 'Activar recordatorios push'}
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center pt-16 text-gray-400 text-sm">Cargando…</div>
      ) : payments.length === 0 ? (
        <div className="flex flex-col items-center pt-16 gap-3">
          <p className="text-gray-400 text-sm">Sin pagos recurrentes configurados.</p>
          <button
            onClick={() => navigate('/gastos-recurrentes/new')}
            className="text-primary text-sm font-medium"
          >
            Agregar el primero
          </button>
        </div>
      ) : (
        <div>
          {active.length > 0 && (
            <PaymentSection
              title="Activos"
              items={active}
              toggling={toggling}
              onToggle={handleToggle}
              onEdit={(id) => navigate(`/gastos-recurrentes/${id}/edit`)}
            />
          )}
          {inactive.length > 0 && (
            <PaymentSection
              title="Desactivados"
              items={inactive}
              toggling={toggling}
              onToggle={handleToggle}
              onEdit={(id) => navigate(`/gastos-recurrentes/${id}/edit`)}
              muted
            />
          )}
        </div>
      )}

      <BottomNav />
    </div>
  )
}

function PaymentSection({
  title,
  items,
  toggling,
  onToggle,
  onEdit,
  muted = false,
}: {
  title: string
  items: RecurringPayment[]
  toggling: string | null
  onToggle: (id: string, current: boolean) => void
  onEdit: (id: string) => void
  muted?: boolean
}) {
  return (
    <div className={muted ? 'opacity-50' : ''}>
      <div className="px-4 py-2 bg-sand text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {title}
      </div>
      {items.map((p) => (
        <div
          key={p.id}
          className="bg-card border-b border-sand px-4 py-3 flex items-center justify-between"
        >
          <button
            onClick={() => onEdit(p.id)}
            className="flex-1 min-w-0 text-left"
          >
            <p className="text-sm font-medium text-gray-900">{p.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">día {p.due_day}</p>
          </button>
          <button
            onClick={() => onToggle(p.id, p.is_active)}
            disabled={toggling === p.id}
            className={`ml-3 shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              p.is_active
                ? 'bg-primary/10 text-primary'
                : 'bg-gray-100 text-gray-400'
            } disabled:opacity-50`}
          >
            {p.is_active ? 'Activo' : 'Inactivo'}
          </button>
        </div>
      ))}
    </div>
  )
}
