// Best-effort keyword → category name suggestions.
// Order matters: first match wins, so put more specific entries first.

const EXPENSE_KEYWORDS: [string[], string][] = [
  [['alquiler', 'expensas', 'consorcio'], 'Alquiler y expensas'],
  [
    ['luz', 'gas', 'agua', 'internet', 'telefono', 'teléfono', 'claro', 'personal',
      'movistar', 'directv', 'fibertel', 'cablevision', 'telecom', 'servicio', 'factura'],
    'Servicios',
  ],
  [
    ['netflix', 'spotify', 'disney', 'hbo', 'prime', 'amazon', 'apple', 'icloud',
      'suscripcion', 'suscripción', 'adobe', 'dropbox', 'youtube premium'],
    'Suscripciones',
  ],
  [
    ['uber', 'didi', 'cabify', 'taxi', 'subte', 'sube', 'colectivo', 'tren', 'nafta', 'ypf',
      'shell', 'axion', 'puma', 'combustible', 'estacionamiento', 'peaje', 'remis',
      'transporte'],
    'Transporte',
  ],
  [
    ['supermercado', 'mercado', 'jumbo', 'carrefour', 'coto', 'dia', 'disco', 'walmart',
      'almacen', 'almacén', 'verduleria', 'verdulería', 'verdu', 'panaderia', 'panadería',
      'carniceria', 'carnicería', 'fruteria', 'frutería', 'kiosco', 'polleria', 'pollería',
      'dietética', 'dietetica', 'rotisería', 'rotiseria', 'fiambrería', 'fiambreria',
      'barrio chino'],
    'Comida y mercado',
  ],
  [
    ['restaurant', 'restaurante', 'rappi', 'pedidos ya', 'pedidos', 'delivery',
      'cafe', 'café', 'bar', 'pizza', 'sushi', 'sushu', 'burger', 'hamburgues',
      'mcdonalds', 'starbucks', 'mostaza', 'wok', 'empanada', 'sanguche',
      'cine', 'teatro', 'concierto', 'boliche', 'salida'],
    'Salidas y ocio',
  ],
  [
    ['farmacia', 'farmacity', 'medico', 'médico', 'doctor', 'clinica', 'clínica',
      'hospital', 'medicina', 'dentista', 'oculista', 'psicologo', 'psicóloga',
      'psicóloga', 'prepaga', 'obra social', 'turno', 'funcional', 'gimnasio',
      'gym', 'pilates', 'yoga', 'crossfit', 'kinesio'],
    'Salud',
  ],
  [
    ['ropa', 'calzado', 'zapatillas', 'zara', 'nike', 'adidas', 'indumentaria',
      'remera', 'campera', 'buzo', 'zapatos', 'zapatería', 'zapateria'],
    'Ropa',
  ],
  [
    ['inversion', 'inversión', 'plazo fijo', 'cedear', 'bitcoin', 'cripto',
      'bono', 'accion', 'acción'],
    'Inversiones',
  ],
]

const INCOME_KEYWORDS: [string[], string][] = [
  [['sueldo', 'salario', 'haberes', 'empleador'], 'Sueldo'],
  [['aguinaldo', 'sac'], 'Aguinaldo'],
  [['freelance', 'honorarios', 'factura', 'consultoria', 'consultoría'], 'Freelance'],
  [['inversion', 'inversión', 'dividendo', 'renta', 'interes', 'interés', 'plazo fijo'], 'Inversiones'],
]

export function suggestCategoryName(
  description: string,
  kind: 'expense' | 'income',
): string | null {
  const lower = description.toLowerCase()
  const map = kind === 'expense' ? EXPENSE_KEYWORDS : INCOME_KEYWORDS
  for (const [keywords, categoryName] of map) {
    if (keywords.some((kw) => lower.includes(kw))) return categoryName
  }
  return null
}
