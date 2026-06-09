import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 pt-10 pb-6">
        <p className="text-sm text-gray-400 mb-1">Bienvenido,</p>
        <h1 className="text-2xl font-bold text-gray-900">{displayName || '…'}</h1>
      </div>

      {/* Actions */}
      <div className="flex-1 p-4 space-y-3">
        <button
          onClick={() => navigate('/movements')}
          className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 flex items-center gap-4 text-left active:bg-gray-50 transition-colors"
        >
          <span className="text-2xl">📋</span>
          <div>
            <p className="text-sm font-semibold text-gray-900">Movimientos</p>
            <p className="text-xs text-gray-400 mt-0.5">Ver y gestionar tus gastos e ingresos</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/movements/new')}
          className="w-full bg-blue-600 rounded-2xl px-5 py-4 flex items-center gap-4 text-left active:opacity-80 transition-opacity"
        >
          <span className="text-2xl">＋</span>
          <div>
            <p className="text-sm font-semibold text-white">Nuevo movimiento</p>
            <p className="text-xs text-blue-200 mt-0.5">Registrar un gasto o ingreso</p>
          </div>
        </button>
      </div>

      {/* Footer */}
      <div className="px-6 pb-8">
        <button
          onClick={handleLogout}
          className="text-xs text-gray-300 hover:text-gray-500 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
