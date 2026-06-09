import { useNavigate } from 'react-router-dom'

interface Props {
  title: string
  backTo?: string
  right?: React.ReactNode
}

export default function NavBar({ title, backTo, right }: Props) {
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 h-14 flex items-center justify-between">
      <div className="w-20">
        {backTo && (
          <button onClick={() => navigate(backTo)} className="text-blue-600 text-sm">
            ← Volver
          </button>
        )}
      </div>
      <h1 className="text-base font-semibold text-gray-900">{title}</h1>
      <div className="w-20 flex justify-end">{right}</div>
    </header>
  )
}
