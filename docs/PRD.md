# PRD — App de Finanzas Personales y Compartidas

## 1. Problema

Necesito claridad sobre mis finanzas personales y, además, llevar las cuentas
compartidas con mi novia. Hoy no tengo una vista unificada de gastos, ingresos y de
cómo quedamos saldados entre los dos. Quiero registrar movimientos, categorizarlos y
analizarlos en un dashboard, accesible desde celular y PC, para ambos.

## 2. Usuarios

- **Dos usuarios**, cada uno con su login.
- Forman un único **hogar (household)**.
- No hay roles de admin ni jerarquía: son pares.

## 3. Principio rector de privacidad

Cada movimiento es **individual** o **compartido**:

- **Individual:** privado. Solo lo ve y edita su dueño. El otro usuario NO lo ve.
- **Compartido:** lo ven ambos. Registra quién pagó y cómo se divide.

Esto es un requisito duro. Filtrar movimientos individuales de un usuario al otro es
un fallo crítico, no un detalle.

## 4. Alcance del MVP (Fase 1)

### Incluido

- **Auth** con email + contraseña (Supabase Auth). Dos usuarios, un hogar.
- **Carga manual** de movimientos:
  - Tipo: gasto (`expense`) o ingreso (`income`).
  - Alcance: individual o compartido.
  - Campos: monto, moneda (ARS/USD), fecha, categoría, descripción.
  - Para compartidos: quién pagó (`paid_by`). La división es **50/50 fija**.
- **Categorías:** catálogo compartido del hogar, por tipo (gasto/ingreso).
- **Importación por CSV** con mapeo manual de columnas (sin parsing de bancos todavía).
- **Dashboard / análisis:**
  - Totales por período (mes en curso, meses anteriores).
  - Gasto por categoría.
  - Individual vs compartido.
  - **Saldo entre los dos** (quién le debe a quién según los compartidos).
  - **Toggle de moneda** ARS/USD y **toggle de tipo de dólar** (oficial/blue/MEP/CCL/...).
- **Tipo de cambio histórico:** fetch diario automático desde DolarAPI y almacenamiento
  de la serie para conversión por fecha.

### Explícitamente FUERA del MVP

Esto NO se construye en Fase 1. Si surge la tentación, se propone, no se hace:

- ❌ Parsing de extractos bancarios / resúmenes de tarjeta (Galicia, Santander, Mercado
  Pago). → **Fase 3**.
- ❌ Deudas e inversiones como tipos de movimiento modelados. → **Fase 2**.
- ❌ Apps nativas / publicación en app stores.
- ❌ Cifrado end-to-end (el proveedor no podría leer los datos). Overkill para 2 usuarios
  de confianza; rompe los reportes del lado del servidor.
- ❌ Más de un hogar o más de dos usuarios.
- ❌ Presupuestos, alertas, movimientos recurrentes. → posible Fase 4.

## 5. Plataforma

- Web app **responsive + PWA** instalable. Misma base de código en celular y PC.
- Sin servidor propio: backend gestionado (Supabase), deploy estático (Vercel/Netlify).

## 6. Restricciones

- **Costo: $0.** Todo dentro de free tiers. Si algo va a requerir pago, avisar antes.
- **Región:** Argentina. Inflación y multiplicidad de tipos de cambio son centrales,
  no un caso borde.

## 7. Criterios de éxito del MVP

1. Ambos usuarios pueden loguearse desde celular y PC y ver su propia data.
2. Un usuario NO puede ver los movimientos individuales del otro (verificado).
3. Cargar un gasto compartido y ver reflejado el saldo entre ambos.
4. Importar un CSV de movimientos y verlos categorizados.
5. El dashboard muestra los mismos números correctamente en ARS y en USD usando MEP
   como tipo de cambio fijo. (El toggle de tipo de dólar fue descartado — ver DECISIONS.md.)
