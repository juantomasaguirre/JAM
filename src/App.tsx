import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import MovementsPage from './pages/MovementsPage'
import MovementFormPage from './pages/MovementFormPage'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return null

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={session ? <Navigate to="/movements" replace /> : <LoginPage />}
        />
        {session ? (
          <>
            <Route path="/movements" element={<MovementsPage />} />
            <Route path="/movements/new" element={<MovementFormPage />} />
            <Route path="/movements/:id/edit" element={<MovementFormPage />} />
            <Route path="*" element={<Navigate to="/movements" replace />} />
          </>
        ) : (
          <Route path="*" element={<Navigate to="/login" replace />} />
        )}
      </Routes>
    </BrowserRouter>
  )
}
