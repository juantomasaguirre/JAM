const COLORS: Record<string, string> = {
  'Comida y mercado':    '#4A7C59',
  'Alquiler y expensas': '#7C5C3A',
  'Servicios':           '#5C7A8C',
  'Transporte':          '#6B8C5C',
  'Salidas y ocio':      '#B5652A',
  'Salud':               '#8C5C7C',
  'Ropa':                '#C49A3C',
  'Hogar':               '#5C8C7A',
  'Liquidaciones':       '#7C8C8C',
  'Otros':               '#9C8C6C',
}

export function getCategoryColor(name: string | null | undefined): string {
  if (!name) return '#B0A898'
  return COLORS[name] ?? '#B0A898'
}
