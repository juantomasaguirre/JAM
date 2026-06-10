# DECISIONS.md — Registro de decisiones

> Decisiones ya tomadas, para no rediscutirlas en cada sesión. Si una se revierte,
> no borrar: agregar una nueva entrada que la supere y marcar la vieja como obsoleta.

---

### 2026-06-10 — Fase 1 cerrada
Todos los criterios de éxito del PRD verificados: auth funcionando, aislamiento de
privacidad confirmado, saldo compartido correcto, importación CSV operativa, y dashboard
mostrando correctamente ARS/USD con MEP (~$1459 venta al cierre). Edge Function
`fetch-fx-rates` deployada y cron corriendo desde 2026-06-09.

---

### 2026-06-10 — Gestión de categorías: solo desde dev side, sin UI en el MVP
Las categorías se crean y modifican únicamente vía seed/migraciones por el desarrollador.
No se construye UI de alta/baja/edición de categorías para el usuario final. **Motivo:**
decisión del dueño; el catálogo de categorías es estable y no justifica UI extra en el MVP.
Si se necesita agregar una categoría, se hace desde dev side con una migración o seed.

---

### 2026-06-09 — Toggle de tipo de dólar descartado; MEP fijo en todo el MVP
El dashboard usa MEP como único tipo de cambio para conversión ARS/USD. No se construye
el toggle oficial/blue/MEP/CCL. **Motivo:** decisión ejecutiva del dueño; complejidad
de UI vs valor marginal bajo para dos usuarios con el mismo contexto de referencia.
El criterio 5 del PRD fue actualizado en consecuencia.

---

### 2026-06-09 — [ACTUALIZA la de abajo] Deploy migrado a Cloudflare Pages
Se abandonó Netlify y se migró a Cloudflare Pages. URL: `jam-f7u.pages.dev`, conectado
al repo `juantomasaguirre/JAM`, redeploy automático en cada push a main.
**Motivo:** free tier más generoso que Netlify.

### 2026-06-05 — Stack: web app (PWA) + Supabase + Cloudflare Pages
Una sola base de código React que corre en navegador de celu y PC, instalable como
PWA. Backend gestionado en Supabase. **Motivo:** funciona en ambos dispositivos sin
apps nativas ni app stores; free tier; menos superficie de mantenimiento.

### 2026-06-05 — Hosting gestionado, NO en la PC propia
Se descartó hostear en la computadora del dueño. **Motivo:** requeriría la PC prendida
24/7, exponer la red doméstica a internet (riesgo real) o túneles, y volver al dueño
sysadmin. Es más trabajo y *menos* seguro que un free tier bien configurado, no menos.

### 2026-06-05 — Sin cifrado end-to-end en el MVP
HTTPS (en tránsito) y cifrado en reposo del proveedor: sí. E2E (que ni el proveedor
pueda leer): no. **Motivo:** rompe reportes/agregaciones del lado del servidor y suma
mucha complejidad; overkill para dos usuarios de confianza. El riesgo real a cuidar es
la configuración de RLS y no filtrar claves, no que hackeen al proveedor.

### 2026-06-05 — Privacidad real entre los dos usuarios
Cada uno ve solo sus movimientos individuales + los compartidos. **Motivo:** decisión
explícita del dueño (eligió privacidad sobre la opción más simple de "ver todo").
Es un requisito duro, no opcional.

### 2026-06-05 — [OBSOLETA, ver 2026-06-06] Gastos compartidos con pagador + división editable
Se había planteado `paid_by` + tabla `movement_splits` (default 50/50, editable).
**Superada por la decisión del 2026-06-06:** el dueño confirmó que la división es
siempre 50/50, así que se eliminó la tabla de splits.

### 2026-06-06 — Split compartido 50/50 hardcodeado, sin tabla de splits
Todo gasto compartido se divide 50/50, fijo. NO existe tabla `movement_splits`: la
división se deriva en el cálculo a partir de `paid_by` y `amount`. El dashboard muestra
el saldo neto entre los dos (quién le debe a quién). **Motivo:** el dueño confirmó que
la división es siempre 50/50 sin excepción. Con dos personas y división fija, una tabla
de splits es maquinaria innecesaria: menos código, menos validaciones, menos superficie
de error (relevante porque el dueño no programa). Si alguna vez hace falta una división
desigual, se agrega la tabla con una migración trivial; no antes.

### 2026-06-06 — Control de versiones: GitHub (ya en uso)
El dueño ya maneja Git/GitHub con Claude Code. No es bloqueante para Fase 0. Aplica la
regla del CLAUDE.md: commits chicos y atómicos, cerrar fases en puntos que funcionen.

### 2026-06-05 — Monedas: solo ARS y USD
Gastos siempre en ARS; ingresos (sueldo) pueden ser en USD. **Motivo:** alcance real
del dueño. No agregar más monedas sin pedido explícito.

### 2026-06-05 — Conversión: valor histórico por fecha del movimiento
Cada movimiento se guarda en su moneda original; la conversión se hace al mostrar,
usando la cotización del día del movimiento (no la de hoy). Con carry-forward para
fechas sin cotización. **Motivo:** correcto contablemente; un gasto de enero debe verse
en su valor USD de enero.

### 2026-06-05 — Toggle de tipo de dólar; default MEP
El dashboard permite elegir qué dólar usar para convertir (oficial/blue/MEP/CCL/...).
Default MEP. **Motivo:** el dueño prefiere MEP como referencia hoy; el blue no siempre
es la referencia correcta.

### 2026-06-05 — Fuente de cotizaciones: DolarAPI + cron diario
`GET https://dolarapi.com/v1/dolares` (gratis, sin key). Como solo da el valor actual,
un Edge Function programado corre 1 vez/día y arma la serie histórica en `fx_rates`
hacia adelante. **Motivo:** gratis, cubre todos los tipos de dólar, sin auth.

### 2026-06-05 — Import: empezar por carga manual + CSV; parsing de bancos a Fase 3
Bancos de interés: Galicia, Santander, Mercado Pago. **Motivo:** el parsing de
extractos/resúmenes argentinos es frágil e inconsistente; meterlo en el MVP estanca el
proyecto. Se difiere.

### 2026-06-05 — Sin skills.md custom por ahora
No se crean skills custom de Claude Code todavía. **Motivo:** optimización prematura;
no hay aún tareas repetitivas identificadas que justifiquen encapsular. Se reconsidera
cuando aparezca una (ej. un parser de banco que se repita).

### 2026-06-05 — Costo objetivo: $0 (free tiers)
Todo dentro de free tiers. Si algo va a requerir pago, avisar y decidir antes.
