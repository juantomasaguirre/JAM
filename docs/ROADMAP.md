# ROADMAP.md — Fases

Principio: **MVP flaco primero, crecer después.** No construir funcionalidad de una
fase posterior antes de tiempo. Si algo de una fase futura parece útil ahora,
proponerlo, no implementarlo.

## Fase 0 — Setup (cimientos)

- Repo + estructura del proyecto (Vite + React + TS + Tailwind).
- Proyecto Supabase creado. Variables de entorno configuradas (anon key en frontend).
- Esquema inicial + RLS en migraciones: `households`, `profiles`, `categories`,
  `movements`, `fx_rates`.
- Auth funcionando (email + contraseña). Seed: un hogar + los dos usuarios.
- Deploy skeleton (Vercel/Netlify) + PWA básica instalable.
- **Cierre de fase:** ambos pueden loguearse desde celu y PC y ven una pantalla vacía
  pero propia.

## Fase 1 — MVP

- Alta/edición/baja de movimientos manuales (gasto/ingreso, individual/compartido).
- Compartidos: pagador (`paid_by`) + división 50/50 fija. Saldo entre los dos derivado.
- Gestión de categorías (catálogo del hogar).
- Edge Function programado (cron diario) que puebla `fx_rates` desde DolarAPI.
- Lógica de conversión por fecha con carry-forward.
- Importación CSV con mapeo manual de columnas.
- Dashboard: totales por período, por categoría, individual vs compartido, saldo entre
  los dos, toggle ARS/USD + toggle tipo de dólar.
- **Cierre de fase:** se cumplen los 5 criterios de éxito del PRD. Verificado el
  aislamiento de privacidad entre usuarios.

## Fase 2 — Deudas e inversiones

- Modelar deudas (préstamos, cuotas, a quién/de quién) e inversiones (plazo fijo,
  dólares guardados, etc.) como tipos de movimiento o entidades propias.
- Definir primero el modelo de datos de cada uno (no improvisar sobre `movements`).
- Reflejarlos en el dashboard.

## Fase 3 — Parsing de extractos

Lo más frágil del proyecto. Un parser por vez, validando contra archivos reales.

- Orden sugerido: Mercado Pago → Galicia → Santander (o según disponibilidad de
  archivos de prueba).
- Cada parser: subir archivo → extraer movimientos → previsualizar y editar antes de
  confirmar la carga. Nunca importar a ciegas.
- Manejar cambios de formato del banco como caso esperado, no excepción rara.

## Fase 4 — Nice to have (sin compromiso)

- Presupuestos por categoría y alertas.
- Movimientos recurrentes (sueldo, alquiler, suscripciones).
- Exportación de reportes.
- Backfill histórico de cotizaciones para movimientos previos al arranque.
