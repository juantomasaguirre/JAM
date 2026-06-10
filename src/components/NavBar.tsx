import { useNavigate } from 'react-router-dom'

interface Props {
  title: string
  backTo?: string
  showBack?: boolean
  right?: React.ReactNode
}

export default function NavBar({ title, backTo, showBack, right }: Props) {
  const navigate = useNavigate()
  const handleBack = backTo ? () => navigate(backTo) : () => navigate(-1)
  const hasBack = backTo || showBack
  return (
    <header className="sticky top-0 z-10 bg-nav px-4 h-14 flex items-center justify-between">
      <div className="w-20">
        {hasBack && (
          <button onClick={handleBack} className="text-white/70 text-sm">
            ← Volver
          </button>
        )}
      </div>
      <h1 className="text-base font-semibold text-white">{title}</h1>
      <div className="w-20 flex justify-end">{right}</div>
    </header>
  )
}
