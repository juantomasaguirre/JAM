import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

function formatAmount(amount: number, currency: 'ARS' | 'USD'): string {
  const num = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
  return currency === 'ARS' ? `$ ${num}` : `U$S ${num}`
}

export default function FinancesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('debts')
  const [debts, setDebts] = useState<Debt[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    supabase
      .from('debts')
      .select('*')
      .order('pending_amount', { ascending: false })
      .order('occurred_on', { ascending: false })
      .then(({ data }) => {
        if (data) setDebts(data)
        setLoading(false)
      })
  }, [])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'debts', label: 'Deudas' },
    { id: 'installments', label: 'Cuotas' },
    { id: 'investments', label: 'Inversiones' },
  ]

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
              {/* Summary cards */}
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

      {activeTab === 'installments' && (
        <div className="flex flex-col items-center pt-16 gap-2">
          <p className="text-gray-400 text-sm">Cuotas — próximamente</p>
        </div>
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
