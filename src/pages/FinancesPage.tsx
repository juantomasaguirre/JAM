import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import NavBar from '../components/NavBar'
import BottomNav from '../components/BottomNav'

type Tab = 'debts' | 'installments' | 'investments'

interface Debt {
  id: string
  direction: 'i_owe' | 'they_owe'
  counterpart: string
  description: string
  original_amount: number
  pending_amount: number
  currency: 'ARS' | 'USD'
  occurred_on: string
}

interface InstallmentPlan {
  id: string
  scope: 'individual' | 'shared'
  paid_by: string | null
  description: string
  total_amount: number
  currency: 'ARS' | 'USD'
  installment_count: number
  installment_amount: number
  first_due_date: string
}

interface Profile {
  id: string
  display_name: string
}

function formatAmount(amount: number, currency: 'ARS' | 'USD'): string {
  const num = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
  return currency === 'ARS' ? `$ ${num}` : `U$S ${num}`
}

// Returns how many installments have come due based on today's date.
function computePaid(firstDueDateStr: string, installmentCount: number): number {
  const today = new Date()
  const first = new Date(firstDueDateStr + 'T12:00:00')
  const monthsElapsed =
    (today.getFullYear() - first.getFullYear()) * 12 +
    (today.getMonth() - first.getMonth())
  const dayAdjust = today.getDate() >= first.getDate() ? 1 : 0
  return Math.max(0, Math.min(monthsElapsed + dayAdjust, installmentCount))
}

function addMonths(dateStr: string, months: number): Date {
  const d = new Date(dateStr + 'T12:00:00')
  return new Date(d.getFullYear(), d.getMonth() + months, d.getDate())
}

export default function FinancesPage() {
  const location = useLocation()
  const initialTab = (new URLSearchParams(location.search).get('tab') as Tab | null) ?? 'debts'
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)

  const [debts, setDebts] = useState<Debt[]>([])
  const [installments, setInstallments] = useState<InstallmentPlan[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      const { data: ownProfile } = await supabase
        .from('profiles')
        .select('household_id')
        .eq('id', user.id)
        .single()

      const [
        { data: debtsData },
        { data: installmentsData },
        { data: profilesData },
      ] = await Promise.all([
        supabase
          .from('debts')
          .select('*')
          .order('pending_amount', { ascending: false })
          .order('occurred_on', { ascending: false }),
        supabase
          .from('installment_plans')
          .select('*')
          .order('first_due_date'),
        ownProfile
          ? supabase
              .from('profiles')
              .select('id, display_name')
              .eq('household_id', ownProfile.household_id)
          : Promise.resolve({ data: [] as Profile[] }),
      ])

      if (debtsData) setDebts(debtsData)
      if (installmentsData) setInstallments(installmentsData)
      if (profilesData) setProfiles(profilesData)
      setLoading(false)
    }
    load()
  }, [])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'debts', label: 'Deudas' },
    { id: 'installments', label: 'Cuotas' },
    { id: 'investments', label: 'Inversiones' },
  ]

  // Debts
  const activeDebts = debts.filter((d) => d.pending_amount > 0)
  const settledDebts = debts.filter((d) => d.pending_amount === 0)
  const iOwe = activeDebts.filter((d) => d.direction === 'i_owe')
  const theyOwe = activeDebts.filter((d) => d.direction === 'they_owe')

  const iOweTotals = {
    ars: iOwe.filter((d) => d.currency === 'ARS').reduce((s, d) => s + d.pending_amount, 0),
    usd: iOwe.filter((d) => d.currency === 'USD').reduce((s, d) => s + d.pending_amount, 0),
  }
  const theyOweTotals = {
    ars: theyOwe.filter((d) => d.currency === 'ARS').reduce((s, d) => s + d.pending_amount, 0),
    usd: theyOwe.filter((d) => d.currency === 'USD').reduce((s, d) => s + d.pending_amount, 0),
  }

  // Installments
  const activeInstallments = installments.filter(
    (p) => computePaid(p.first_due_date, p.installment_count) < p.installment_count,
  )
  const completedInstallments = installments.filter(
    (p) => computePaid(p.first_due_date, p.installment_count) >= p.installment_count,
  )
  const monthlyArs = activeInstallments
    .filter((p) => p.currency === 'ARS')
    .reduce((s, p) => s + p.installment_amount, 0)
  const monthlyUsd = activeInstallments
    .filter((p) => p.currency === 'USD')
    .reduce((s, p) => s + p.installment_amount, 0)

  function resolvedName(profileId: string | null): string {
    if (!profileId) return '—'
    if (profileId === currentUserId) return 'Yo'
    return profiles.find((p) => p.id === profileId)?.display_name ?? '—'
  }

  return (
    <div className="min-h-screen bg-surface pb-16">
      <NavBar
        title="Finanzas"
        right={
          activeTab === 'debts' ? (
            <button
              onClick={() => navigate('/finances/debts/new')}
              className="text-white text-2xl font-light leading-none pb-0.5"
              aria-label="Nueva deuda"
            >
              +
            </button>
          ) : activeTab === 'installments' ? (
            <button
              onClick={() => navigate('/finances/installments/new')}
              className="text-white text-2xl font-light leading-none pb-0.5"
              aria-label="Nuevas cuotas"
            >
              +
            </button>
          ) : undefined
        }
      />

      {/* Tab bar */}
      <div className="flex border-b border-border bg-card sticky top-14 z-10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'text-primary border-primary'
                : 'text-gray-400 border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Debts tab */}
      {activeTab === 'debts' && (
        <>
          {loading ? (
            <div className="flex justify-center pt-16 text-gray-400 text-sm">Cargando…</div>
          ) : debts.length === 0 ? (
            <div className="flex flex-col items-center pt-16 gap-3">
              <p className="text-gray-400 text-sm">Sin deudas registradas.</p>
              <button
                onClick={() => navigate('/finances/debts/new')}
                className="text-primary text-sm font-medium"
              >
                Agregar la primera
              </button>
            </div>
          ) : (
            <div>
              {(iOwe.length > 0 || theyOwe.length > 0) && (
                <div className="flex gap-3 p-4">
                  {iOwe.length > 0 && (
                    <div className="flex-1 bg-card rounded-xl p-3 border border-border">
                      <p className="text-xs text-gray-400 mb-1">Les debo</p>
                      {iOweTotals.ars > 0 && (
                        <p className="text-sm font-bold text-negative">
                          {formatAmount(iOweTotals.ars, 'ARS')}
                        </p>
                      )}
                      {iOweTotals.usd > 0 && (
                        <p className="text-sm font-bold text-negative">
                          {formatAmount(iOweTotals.usd, 'USD')}
                        </p>
                      )}
                    </div>
                  )}
                  {theyOwe.length > 0 && (
                    <div className="flex-1 bg-card rounded-xl p-3 border border-border">
                      <p className="text-xs text-gray-400 mb-1">Me deben</p>
                      {theyOweTotals.ars > 0 && (
                        <p className="text-sm font-bold text-green-600">
                          {formatAmount(theyOweTotals.ars, 'ARS')}
                        </p>
                      )}
                      {theyOweTotals.usd > 0 && (
                        <p className="text-sm font-bold text-green-600">
                          {formatAmount(theyOweTotals.usd, 'USD')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {iOwe.length > 0 && (
                <DebtSection
                  title="Les debo"
                  items={iOwe}
                  amountColor="text-negative"
                  onEdit={(id) => navigate(`/finances/debts/${id}/edit`)}
                />
              )}
              {theyOwe.length > 0 && (
                <DebtSection
                  title="Me deben"
                  items={theyOwe}
                  amountColor="text-green-600"
                  onEdit={(id) => navigate(`/finances/debts/${id}/edit`)}
                />
              )}
              {settledDebts.length > 0 && (
                <DebtSection
                  title="Saldadas"
                  items={settledDebts}
                  amountColor="text-gray-300"
                  muted
                  onEdit={(id) => navigate(`/finances/debts/${id}/edit`)}
                />
              )}
            </div>
          )}
        </>
      )}

      {/* Installments tab */}
      {activeTab === 'installments' && (
        <>
          {loading ? (
            <div className="flex justify-center pt-16 text-gray-400 text-sm">Cargando…</div>
          ) : installments.length === 0 ? (
            <div className="flex flex-col items-center pt-16 gap-3">
              <p className="text-gray-400 text-sm">Sin cuotas registradas.</p>
              <button
                onClick={() => navigate('/finances/installments/new')}
                className="text-primary text-sm font-medium"
              >
                Agregar la primera
              </button>
            </div>
          ) : (
            <div>
              {/* Monthly commitment summary */}
              {activeInstallments.length > 0 && (
                <div className="p-4">
                  <div className="bg-card rounded-xl p-3 border border-border">
                    <p className="text-xs text-gray-400 mb-1">Compromiso mensual</p>
                    {monthlyArs > 0 && (
                      <p className="text-sm font-bold text-gray-900">
                        {formatAmount(monthlyArs, 'ARS')}
                      </p>
                    )}
                    {monthlyUsd > 0 && (
                      <p className="text-sm font-bold text-gray-900">
                        {formatAmount(monthlyUsd, 'USD')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {activeInstallments.length > 0 && (
                <InstallmentSection
                  title="En curso"
                  items={activeInstallments}
                  currentUserId={currentUserId}
                  resolvedName={resolvedName}
                  onEdit={(id) => navigate(`/finances/installments/${id}/edit`)}
                />
              )}
              {completedInstallments.length > 0 && (
                <InstallmentSection
                  title="Terminadas"
                  items={completedInstallments}
                  currentUserId={currentUserId}
                  resolvedName={resolvedName}
                  muted
                  onEdit={(id) => navigate(`/finances/installments/${id}/edit`)}
                />
              )}
            </div>
          )}
        </>
      )}

      {activeTab === 'investments' && (
        <div className="flex flex-col items-center pt-16 gap-2">
          <p className="text-gray-400 text-sm">Inversiones — próximamente</p>
        </div>
      )}

      <BottomNav />
    </div>
  )
}

function DebtSection({
  title,
  items,
  amountColor,
  muted = false,
  onEdit,
}: {
  title: string
  items: Debt[]
  amountColor: string
  muted?: boolean
  onEdit: (id: string) => void
}) {
  return (
    <div className={muted ? 'opacity-50' : ''}>
      <div className="px-4 py-2 bg-sand text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {title}
      </div>
      {items.map((debt) => (
        <button
          key={debt.id}
          onClick={() => onEdit(debt.id)}
          className="w-full bg-card border-b border-sand px-4 py-3 flex items-center justify-between text-left active:bg-sand"
        >
          <div className="flex-1 min-w-0 mr-3">
            <p className="text-sm font-medium text-gray-900 truncate">{debt.counterpart}</p>
            <p className="text-xs text-gray-400 mt-0.5 truncate">{debt.description}</p>
          </div>
          <div className="text-right">
            <p className={`text-sm font-semibold ${amountColor}`}>
              {formatAmount(debt.pending_amount, debt.currency)}
            </p>
            {debt.pending_amount > 0 && debt.pending_amount !== debt.original_amount && (
              <p className="text-xs text-gray-300">
                de {formatAmount(debt.original_amount, debt.currency)}
              </p>
            )}
          </div>
        </button>
      ))}
    </div>
  )
}

function InstallmentSection({
  title,
  items,
  resolvedName,
  muted = false,
  onEdit,
}: {
  title: string
  items: InstallmentPlan[]
  currentUserId: string
  resolvedName: (id: string | null) => string
  muted?: boolean
  onEdit: (id: string) => void
}) {
  return (
    <div className={muted ? 'opacity-50' : ''}>
      <div className="px-4 py-2 bg-sand text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {title}
      </div>
      {items.map((plan) => {
        const paid = computePaid(plan.first_due_date, plan.installment_count)
        const remaining = plan.installment_count - paid
        const nextDue =
          remaining > 0 ? addMonths(plan.first_due_date, paid) : null

        return (
          <button
            key={plan.id}
            onClick={() => onEdit(plan.id)}
            className="w-full bg-card border-b border-sand px-4 py-3 flex items-center justify-between text-left active:bg-sand"
          >
            <div className="flex-1 min-w-0 mr-3">
              <p className="text-sm font-medium text-gray-900 truncate">{plan.description}</p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <p className="text-xs text-gray-400">
                  {paid}/{plan.installment_count} cuotas
                </p>
                {plan.scope === 'shared' && (
                  <span className="text-xs text-gray-400">
                    · paga {resolvedName(plan.paid_by)}
                  </span>
                )}
              </div>
              {nextDue && (
                <p className="text-xs text-gray-300 mt-0.5">
                  Próx.{' '}
                  {nextDue.toLocaleDateString('es-AR', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold text-gray-900">
                {formatAmount(plan.installment_amount, plan.currency)}
              </p>
              {remaining > 0 && (
                <p className="text-xs text-gray-400">
                  {remaining} {remaining === 1 ? 'restante' : 'restantes'}
                </p>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
