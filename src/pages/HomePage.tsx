import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function HomePage() {
  const [displayName, setDisplayName] = useState('')

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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
      <p className="text-2xl font-semibold text-gray-900">
        Hola, {displayName || '…'}
      </p>
      <button
        onClick={handleLogout}
        className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
      >
        Cerrar sesión
      </button>
    </div>
  )
}
