# BACKLOG.md — Ideas y features futuros

> Ideas capturadas para no perderlas. No tienen fecha ni compromiso.
> Cuando una pase a planificarse, se mueve al ROADMAP.md.

---

### Recordatorios de pagos mensuales fijos

Lista de pagos recurrentes a recordar cada mes: alquiler, expensas, servicios (gas,
luz, AGIP, etc.), cuotas de tarjeta de crédito, suscripciones, etc. La idea es tener
un checklist mensual que marque qué ya se pagó y qué falta. Distinto de las cuotas
finitas de la Fase 2: estos son pagos que se repiten indefinidamente.

Ideas de implementación a definir cuando llegue el momento:
- Tabla `recurring_payments` con nombre, monto estimado, moneda, día del mes esperado.
- Estado mensual: `payment_checks(recurring_payment_id, year, month, paid_at)`.
- UI: checklist por mes, con indicador de cuántos faltan y cuánto suman.

---

### Modo viaje / vacaciones (tags de contexto)

Poder activar un "modo viaje" que agrupa todos los gastos cargados durante ese período bajo un tag de contexto. Ejemplo: un gasto de $2000 en "Comida y mercado" cargado durante el viaje quedaría etiquetado como `(Comida y mercado) (Viaje a Italia)`.

Ideas de implementación a definir cuando llegue el momento:
- Tabla `trips` con nombre, fecha inicio, fecha fin, activo (boolean).
- Columna opcional `trip_id` en `movements`.
- UI: toggle "estoy de viaje" que activa el trip activo; se desactiva al volver.
- El dashboard podría filtrar o agrupar por trip.
