import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import MovementsPage from './pages/MovementsPage'
import MovementFormPage from './pages/MovementFormPage'
import DashboardPage from './pages/DashboardPage'
import CategoryEvolutionPage from './pages/CategoryEvolutionPage'
import ImportPage from './pages/ImportPage'
import ImportHistoricalPage from './pages/ImportHistoricalPage'
import FinancesPage from './pages/FinancesPage'
import DebtFormPage from './pages/DebtFormPage'
import InstallmentFormPage from './pages/InstallmentFormPage'
import InvestmentFormPage from './pages/InvestmentFormPage'
import PortfolioAssetPage from './pages/PortfolioAssetPage'
import PortfolioAssetFormPage from './pages/PortfolioAssetFormPage'
import PortfolioTransactionFormPage from './pages/PortfolioTransactionFormPage'

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
            <Route path="/" element={<HomePage />} />
            <Route path="/movements" element={<MovementsPage />} />
            <Route path="/movements/new" element={<MovementFormPage />} />
            <Route path="/movements/:id/edit" element={<MovementFormPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/dashboard/categories/:id" element={<CategoryEvolutionPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/import/historical" element={<ImportHistoricalPage />} />
            <Route path="/finances" element={<FinancesPage />} />
            <Route path="/finances/debts/new" element={<DebtFormPage />} />
            <Route path="/finances/debts/:id/edit" element={<DebtFormPage />} />
            <Route path="/finances/installments/new" element={<InstallmentFormPage />} />
            <Route path="/finances/installments/:id/edit" element={<InstallmentFormPage />} />
            <Route path="/finances/investments/new" element={<InvestmentFormPage />} />
            <Route path="/finances/investments/:id/edit" element={<InvestmentFormPage />} />
            <Route path="/finances/portfolio/new" element={<PortfolioAssetFormPage />} />
            <Route path="/finances/portfolio/:assetId/edit" element={<PortfolioAssetFormPage />} />
            <Route path="/finances/portfolio/:assetId/transactions/new" element={<PortfolioTransactionFormPage />} />
            <Route path="/finances/portfolio/:assetId/transactions/:txId/edit" element={<PortfolioTransactionFormPage />} />
            <Route path="/finances/portfolio/:assetId" element={<PortfolioAssetPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        ) : (
          <Route path="*" element={<Navigate to="/login" replace />} />
        )}
      </Routes>
    </BrowserRouter>
  )
}
