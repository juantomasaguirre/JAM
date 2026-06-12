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
  // Maps recurring_payment_id -> check record id for the current month
  const [checkedIds, setCheckedIds] = useState<Map<string, string>>(new Map())
  const [toggling, setToggling] = useState<string | null>(null)
  const [householdId, setHouseholdId] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('household_id')
        .eq('id', user.id)
        .single()
      if (profile) setHouseholdId(profile.household_id)

      const [paymentsResult, checksResult] = await Promise.all([
        supabase.from('recurring_payments').select('id, name, due_day').order('due_day'),
        supabase
          .from('recurring_payment_checks')
          .select('id, recurring_payment_id')
          .eq('year', currentYear)
          .eq('month', currentMonth),
      ])

      if (paymentsResult.data) setPayments(paymentsResult.data)
      if (checksResult.data) {
        const map = new Map<string, string>()
        for (const c of checksResult.data as { id: string; recurring_payment_id: string }[]) {
          map.set(c.recurring_payment_id, c.id)
        }
        setCheckedIds(map)
      }
      setLoading(false)
    }
    load()
  }, [currentYear, currentMonth])

  async function handleToggleCheck(paymentId: string) {
    if (toggling) return
    setToggling(paymentId)
    const checkId = checkedIds.get(paymentId)
    if (checkId) {
      await supabase.from('recurring_payment_checks').delete().eq('id', checkId)
      setCheckedIds((prev) => { const next = new Map(prev); next.delete(paymentId); return next })
    } else {
      const { data } = await supabase
        .from('recurring_payment_checks')
        .insert({ recurring_payment_id: paymentId, household_id: householdId, year: currentYear, month: currentMonth, paid_by: currentUserId })
        .select('id')
        .single()
      if (data) setCheckedIds((prev) => new Map(prev).set(paymentId, data.id))
    }
    setToggling(null)
  }

  const checkedCount = checkedIds.size
  const totalCount = payments.length

  return (
    <div className="min-h-screen bg-surface pb-16">
      <NavBar
        title="Gastos recurrentes"
        backTo="/"
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

      {/* Push notification status */}
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
        <div className="mt-4">
          <div className="px-4 pb-2 flex justify-between items-center">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Este mes
            </span>
            <span className="text-xs text-gray-400">{checkedCount}/{totalCount} pagados</span>
          </div>
          {payments.map((p) => {
            const checked = checkedIds.has(p.id)
            return (
              <div key={p.id} className="bg-card border-b border-sand px-4 py-3 flex items-center gap-3">
                <button
                  onClick={() => handleToggleCheck(p.id)}
                  disabled={toggling === p.id}
                  className="shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors disabled:opacity-50"
                  style={
                    checked
                      ? { borderColor: '#16a34a', backgroundColor: '#16a34a' }
                      : { borderColor: '#D1D5DB', backgroundColor: 'white' }
                  }
                  aria-label={checked ? 'Desmarcar como pagado' : 'Marcar como pagado'}
                >
                  {checked && (
                    <svg className="w-4 h-4 text-white" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8l3.5 3.5 6.5-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => navigate(`/gastos-recurrentes/${p.id}/edit`)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className={`text-sm font-medium transition-colors ${checked ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                    {p.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">día {p.due_day}</p>
                </button>
              </div>
            )
          })}
        </div>
      )}

      <BottomNav />
    </div>
  )
}
