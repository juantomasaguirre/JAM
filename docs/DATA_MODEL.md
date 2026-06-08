# DATA_MODEL.md — Modelo de datos

> Columna vertebral del proyecto. Leer antes de tocar la base de datos.
> Identificadores en inglés (estándar); explicaciones en español.

## Diagrama conceptual

```
households (1) ──< profiles (2 usuarios)
households (1) ──< categories
households (1) ──< movements >── category
fx_rates  (serie histórica de cotizaciones, independiente)
```

## Tablas

### households
La unidad que agrupa a los dos usuarios. Habrá una sola fila.

| columna     | tipo        | notas                          |
|-------------|-------------|--------------------------------|
| id          | uuid PK     |                                |
| name        | text        | ej. "Casa"                     |
| created_at  | timestamptz | default now()                  |

### profiles
Espejo de `auth.users`. Una fila por usuario.

| columna       | tipo        | notas                                   |
|---------------|-------------|-----------------------------------------|
| id            | uuid PK     | = auth.users.id                         |
| household_id  | uuid FK     | → households.id                         |
| display_name  | text        | nombre visible                          |
| created_at    | timestamptz | default now()                           |

### categories
Catálogo compartido del hogar. Ambos usan las mismas categorías.

| columna       | tipo        | notas                                   |
|---------------|-------------|-----------------------------------------|
| id            | uuid PK     |                                         |
| household_id  | uuid FK     | → households.id                         |
| name          | text        | ej. "Supermercado", "Salario"           |
| kind          | text        | 'expense' \| 'income'                   |
| is_archived   | boolean     | default false                           |

> Nota de privacidad: el catálogo de categorías es compartido. Saber que existe una
> categoría no revela montos ni quién la usó. Aceptable para el MVP. Si en el futuro
> molesta, se puede scopear por usuario.

### movements
El corazón. Un gasto o un ingreso.

| columna       | tipo          | notas                                                        |
|---------------|---------------|--------------------------------------------------------------|
| id            | uuid PK       |                                                              |
| household_id  | uuid FK       | → households.id (para scoping y RLS)                         |
| created_by    | uuid FK       | → profiles.id (quién lo cargó)                               |
| owner_id      | uuid FK       | → profiles.id (de quién es; en individual = el dueño)        |
| scope         | text          | 'individual' \| 'shared'                                     |
| kind          | text          | 'expense' \| 'income'                                        |
| category_id   | uuid FK null  | → categories.id                                              |
| description   | text          |                                                              |
| amount        | NUMERIC(14,2) | **siempre positivo**; el signo lo da `kind`                  |
| currency      | text          | 'ARS' \| 'USD'                                               |
| occurred_on   | date          | fecha del movimiento; **manda para la conversión de moneda** |
| paid_by       | uuid FK null  | → profiles.id; solo para `shared` (quién fronteó la plata)   |
| created_at    | timestamptz   | default now()                                                |
| updated_at    | timestamptz   |                                                              |

Reglas de integridad:
- Si `scope = 'individual'` → `owner_id = created_by`, `paid_by` es NULL.
- Si `scope = 'shared'` → `paid_by` obligatorio.

### División de gastos compartidos: 50/50 hardcodeado

No hay tabla de splits. Todo gasto compartido se divide **50/50, fijo**. La división
no se guarda: se deriva en el cálculo. Esto es deliberado (ver DECISIONS): menos
tablas, menos validaciones, menos superficie de error.

**Cálculo del saldo entre los dos** (solo sobre movimientos `shared`):

```
Para cada gasto compartido:
  a quien pagó (paid_by) se le acredita   amount / 2  (el otro le debe su mitad)
  al que no pagó se le imputa             amount / 2

saldo_neto(usuario) = Σ (amount/2 de los que pagó él)  −  Σ (amount/2 de los que pagó el otro)
```

Si `saldo_neto` de A es positivo, B le debe esa cantidad a A (y viceversa). El
dashboard muestra ese único número: quién le debe a quién y cuánto.

> Si en el futuro hiciera falta una división desigual (ej. 70/30), se agrega una tabla
> de splits con una migración. No antes: hoy la regla es 50/50 firme.

### fx_rates
Serie histórica de cotizaciones del dólar. Una fila por (fecha, tipo de dólar).

| columna       | tipo          | notas                                                  |
|---------------|---------------|--------------------------------------------------------|
| id            | uuid PK       |                                                        |
| rate_date     | date          |                                                        |
| dollar_type   | text          | 'oficial' \| 'blue' \| 'mep' \| 'ccl' \| 'mayorista' \| 'tarjeta' \| 'cripto' |
| buy           | NUMERIC(14,4) | compra (ARS por 1 USD)                                  |
| sell          | NUMERIC(14,4) | venta (ARS por 1 USD)                                   |
| source        | text          | 'dolarapi'                                              |
| fetched_at    | timestamptz   |                                                        |

- **Unique (rate_date, dollar_type).**
- Lectura: cualquier usuario autenticado. Escritura: solo el cron (service_role).

## Regla de moneda y conversión

Cada movimiento se guarda en **su moneda original**. La conversión ocurre **solo al
mostrar**, nunca se persiste convertida.

Para mostrar un movimiento en moneda destino `T` usando tipo de dólar `D`:

```
rate = fx_rate(D, movement.occurred_on).sell

if movement.currency == T:        value = amount
elif ARS → USD (currency=ARS, T=USD):  value = amount / rate
elif USD → ARS (currency=USD, T=ARS):  value = amount * rate
```

`fx_rate(D, fecha)`:
1. Buscar fila exacta `(fecha, D)` en `fx_rates`.
2. Si no existe (fin de semana, feriado, mercado cerrado) → usar la cotización más
   reciente **anterior** a esa fecha (**carry-forward**).
3. Si no hay ningún dato anterior (movimiento más viejo que la serie) → devolver NULL
   y que la UI lo marque ("sin cotización para esta fecha"). **Nunca inventar un valor.**

Decisiones de conversión:
- Se usa el valor **venta (`sell`)** por defecto. (Simple y consistente; revisable.)
- El dólar para convertir lo elige el usuario en el dashboard (toggle): por defecto
  **MEP**, que es la referencia que el dueño prefiere hoy.

## Origen de las cotizaciones (DolarAPI)

- Endpoint: `GET https://dolarapi.com/v1/dolares` — gratis, sin API key.
- Devuelve un array; cada item tiene `casa`, `compra`, `venta`, `fechaActualizacion`.
- Mapeo `casa` → `dollar_type`:
  `oficial→oficial`, `blue→blue`, `bolsa→mep`, `contadoconliqui→ccl`,
  `mayorista→mayorista`, `tarjeta→tarjeta`, `cripto→cripto`.
- **Importante:** DolarAPI da el valor *actual*, no series históricas. Por eso un
  **Edge Function programado (Supabase Cron) corre una vez por día**, toma las
  cotizaciones y hace upsert en `fx_rates`. Así la serie histórica se construye hacia
  adelante desde el día 1.
- Backfill opcional de fechas pasadas (movimientos viejos): existe ArgentinaDatos
  (`https://api.argentinedatos.com`) con series históricas. Considerarlo solo si hace
  falta cargar movimientos previos al arranque. No es parte del MVP base.

## RLS (Row Level Security)

RLS habilitado en TODAS las tablas. Patrón para evitar recursión: una función
`SECURITY DEFINER` que devuelve el household del usuario actual.

```sql
create or replace function current_household_id()
returns uuid language sql security definer stable as $$
  select household_id from profiles where id = auth.uid()
$$;
```

Policies (resumen funcional, traducir a SQL en la migración):

- **households** — SELECT: `id = current_household_id()`.
- **profiles** — SELECT: `household_id = current_household_id()`. UPDATE: solo `id = auth.uid()`.
- **categories** — SELECT/INSERT/UPDATE/DELETE: `household_id = current_household_id()`.
- **movements**
  - SELECT: `(scope='individual' AND owner_id = auth.uid())
             OR (scope='shared' AND household_id = current_household_id())`
  - INSERT: `created_by = auth.uid() AND household_id = current_household_id()`
            y si `scope='individual'` entonces `owner_id = auth.uid()`.
  - UPDATE/DELETE: individual → `owner_id = auth.uid()`; shared → `household_id = current_household_id()`.
- **fx_rates** — SELECT: cualquier autenticado. INSERT/UPDATE/DELETE: nadie vía cliente
  (solo service_role del cron).

> ⚠️ Verificación obligatoria antes de cerrar Fase 1: loguearse como usuario A e
> intentar leer un movimiento `individual` de usuario B. Debe devolver vacío.
