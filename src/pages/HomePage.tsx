import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

export default function HomePage() {
  const [displayName, setDisplayName] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single()
      if (data) setDisplayName(data.display_name)
    }
    fetchProfile()
  }, [])

  return (
    <div className="min-h-screen bg-surface flex flex-col pb-16">
      {/* Header */}
      <div className="bg-nav px-6 pt-10 pb-6">
        <p className="text-sm text-white/60 mb-1">Bienvenido,</p>
        <h1 className="text-2xl font-bold text-white">{displayName || '…'}</h1>
      </div>

      {/* Actions */}
      <div className="flex-1 p-4 space-y-3">
        <button
          onClick={() => navigate('/movements')}
          className="w-full bg-card border border-border rounded-2xl px-5 py-4 flex items-center gap-4 text-left active:bg-sand transition-colors"
        >
          <span className="text-2xl">📋</span>
          <div>
            <p className="text-sm font-semibold text-gray-900">Movimientos</p>
            <p className="text-xs text-gray-400 mt-0.5">Ver y gestionar tus gastos e ingresos</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/dashboard')}
          className="w-full bg-card border border-border rounded-2xl px-5 py-4 flex items-center gap-4 text-left active:bg-sand transition-colors"
        >
          <span className="text-2xl">📊</span>
          <div>
            <p className="text-sm font-semibold text-gray-900">Dashboard</p>
            <p className="text-xs text-gray-400 mt-0.5">Resumen y análisis por categoría</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/gastos-recurrentes')}
          className="w-full bg-card border border-border rounded-2xl px-5 py-4 flex items-center gap-4 text-left active:bg-sand transition-colors"
        >
          <span className="text-2xl">📅</span>
          <div>
            <p className="text-sm font-semibold text-gray-900">Gastos recurrentes</p>
            <p className="text-xs text-gray-400 mt-0.5">Recordatorios de pagos mensuales</p>
          </div>
        </button>
      </div>

      {/* Footer */}
      <div className="px-6 pb-8">
        <button
          onClick={() => navigate('/settings')}
          className="text-xs text-gray-300 hover:text-gray-500 transition-colors"
        >
          Ajustes
        </button>
      </div>

      <button
        onClick={() => navigate('/movements/new')}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-14 h-14 bg-primary rounded-full shadow-lg flex items-center justify-center active:opacity-80 transition-opacity"
        aria-label="Nuevo movimiento"
      >
        <span className="text-white text-3xl font-light leading-none">+</span>
      </button>

      <BottomNav />
    </div>
  )
}
