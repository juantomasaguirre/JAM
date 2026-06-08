# CLAUDE.md — App de Finanzas Personales y Compartidas

> Este archivo es el manual operativo del proyecto. Claude Code lo lee al inicio de
> cada sesión. Tiene prioridad sobre suposiciones propias. Si algo acá contradice
> lo que el usuario pide en el chat, **avisá y pedí confirmación antes de actuar**.

## Qué es esto

App de finanzas para **dos personas** (yo y mi novia). Sirve para registrar
movimientos (gastos e ingresos), categorizarlos, separarlos en **individuales**
(privados de cada uno) y **compartidos** (visibles para ambos), y analizar todo en
un dashboard. Funciona en celular y PC desde el navegador (PWA responsive). Una
sola base de código.

El dueño del proyecto **no programa**: dirige, responde dudas y aprende. Por eso:
- Explicá las decisiones técnicas en lenguaje claro antes de ejecutarlas.
- No asumas conocimiento previo. Si hay una decisión con consecuencias (seguridad,
  costo, datos), pará y explicá las opciones con tu recomendación.

## Stack (fijo, no cambiar sin discutir)

- **Frontend:** React + TypeScript + Vite. PWA instalable, responsive.
- **Estilos:** Tailwind CSS.
- **Gráficos:** Recharts.
- **Backend/DB/Auth:** Supabase (Postgres + Auth + Row Level Security + Edge Functions + Cron).
- **Deploy:** frontend en Vercel o Netlify (free tier); backend en Supabase (free tier).
- **Sin** apps nativas, **sin** app stores, **sin** servidor propio.

## Reglas de oro (innegociables)

1. **RLS SIEMPRE activo** en todas las tablas. Nunca lo desactives "para que funcione".
   Si una query falla por permisos, el problema es la policy, no el RLS. Arreglá la policy.
2. **Privacidad entre los dos usuarios es un requisito, no un nice-to-have.** Un
   movimiento `individual` SOLO lo ve su dueño. Un movimiento `shared` lo ven ambos.
   Cualquier cambio que pueda filtrar datos individuales de un usuario al otro es un bug grave.
3. **Nunca pongas secretos en el código ni en commits.** Variables de entorno siempre.
   En el frontend solo va la `anon key` de Supabase (es segura por diseño SI las RLS
   están bien). La `service_role key` NUNCA toca el frontend ni el repo.
4. **Plata = NUMERIC, nunca float.** Montos como `NUMERIC(14,2)` en DB. En JS/TS nunca
   uses `number` con coma flotante para cálculos de dinero; trabajá en enteros (centavos)
   o usá una librería decimal. Floats acumulan errores de redondeo: inaceptable en finanzas.
5. **Montos siempre positivos.** El signo lo determina el `kind` (`expense` / `income`),
   no el valor.
6. **Conversión de moneda solo en la capa de display, nunca mutando datos guardados.**
   Cada movimiento se guarda en su moneda original. Ver `docs/DATA_MODEL.md`.
7. **Nunca inventes una cotización.** Si falta el tipo de cambio de una fecha, usá la
   regla de carry-forward definida en el modelo de datos y, si no hay dato, marcalo
   en la UI. No estimes a ojo.
8. **No construyas funcionalidad fuera de la fase actual** (ver `docs/ROADMAP.md`). Si
   se te ocurre algo útil de una fase posterior, proponelo, no lo implementes.

## Manejo de dinero y moneda

- Monedas soportadas: **ARS** y **USD**. Nada más por ahora.
- Cada movimiento guarda `amount` + `currency` + `occurred_on` (fecha).
- El dashboard tiene **dos toggles independientes**: (a) moneda de visualización
  ARS/USD, y (b) qué dólar usar para convertir (oficial, blue, MEP, CCL, etc.).
- La conversión usa el tipo de cambio **del día del movimiento** (valor histórico),
  no el de hoy. La fuente y la mecánica están en `docs/DATA_MODEL.md`.

## Seguridad / RLS

- Toda tabla nueva: crear con RLS habilitado y sus policies en la MISMA migración.
- Para chequear pertenencia al hogar dentro de policies, usá una función
  `SECURITY DEFINER` (ej. `current_household_id()`). NO hagas que una policy sobre
  `profiles` consulte `profiles` directamente: causa recursión infinita de RLS.
- `fx_rates` es lectura para cualquier usuario autenticado, escritura SOLO para el
  proceso de cron (service_role). Ningún cliente escribe cotizaciones.

## Flujo de trabajo

- **Migraciones para todo cambio de esquema.** Nunca edites la DB a mano sin que quede
  capturado en una migración versionada (`supabase/migrations/`).
- **Commits chicos y atómicos**, mensajes estilo conventional commits (`feat:`, `fix:`,
  `chore:`...). Un commit = un cambio entendible.
- **Pedí confirmación antes de:** borrar datos, correr migraciones destructivas, cambiar
  el stack, o tocar policies de seguridad.
- **Cuando tomemos una decisión, registrala en `docs/DECISIONS.md`** con fecha y motivo,
  así no la volvemos a discutir en cada sesión.
- Si algo del usuario te parece equivocado o riesgoso, **decilo**. No ejecutes en
  silencio algo que creés que está mal.

## Documentos del proyecto

- `docs/PRD.md` — qué hace la app y, sobre todo, qué queda explícitamente afuera.
- `docs/DATA_MODEL.md` — entidades, reglas de moneda y de compartido, policies. **La
  columna vertebral. Leelo antes de tocar la base de datos.**
- `docs/ROADMAP.md` — fases. Qué se construye ahora y qué después.
- `docs/DECISIONS.md` — decisiones tomadas y por qué.

@docs/DECISIONS.md

## Glosario

- **Movimiento (movement):** una transacción: un gasto o un ingreso.
- **Individual:** movimiento privado, visible solo para su dueño.
- **Compartido (shared):** movimiento visible para ambos, con pagador y división.
- **Hogar (household):** la unidad que agrupa a los dos usuarios.
- **occurred_on:** fecha en que ocurrió el movimiento (la que manda para la cotización).
