# BACKLOG.md — Ideas y features futuros

> Ideas capturadas para no perderlas. No tienen fecha ni compromiso.
> Cuando una pase a planificarse, se mueve al ROADMAP.md.

---

### Modo viaje / vacaciones (tags de contexto)

Poder activar un "modo viaje" que agrupa todos los gastos cargados durante ese período bajo un tag de contexto. Ejemplo: un gasto de $2000 en "Comida y mercado" cargado durante el viaje quedaría etiquetado como `(Comida y mercado) (Viaje a Italia)`.

Ideas de implementación a definir cuando llegue el momento:
- Tabla `trips` con nombre, fecha inicio, fecha fin, activo (boolean).
- Columna opcional `trip_id` en `movements`.
- UI: toggle "estoy de viaje" que activa el trip activo; se desactiva al volver.
- El dashboard podría filtrar o agrupar por trip.
