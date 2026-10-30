# Guía del ETL de clientes: librerías, ejecución y programación

## 1. Librerías

### Ya instaladas (ver `package.json`)

| Librería      | Tipo       | Para qué sirve                                                      |
|---------------|------------|---------------------------------------------------------------------|
| `zod`         | producción | Valida y tipa los datos mientras el programa corre (como pydantic)   |
| `typescript`  | desarrollo | Compilador: convierte `.ts` → `.js` (`npm run build`)               |
| `tsx`         | desarrollo | Ejecuta `.ts` directo, sin compilar (`npm run dev`)                 |
| `@types/node` | desarrollo | Tipos de Node (`process`, `setTimeout`, etc.) para TypeScript       |

> **Producción** = las necesita el programa al correr.
> **Desarrollo** = solo las usas mientras programas o compilas.

### Faltan (para cuando conectemos SQL Server real)

```
npm install mssql pino
npm install -D @types/mssql
```

| Librería       | Para qué sirve                                        |
|----------------|-------------------------------------------------------|
| `mssql`        | Conexión a SQL Server (pool, consultas, `bulk`)       |
| `pino`         | Logs rápidos en formato JSON                          |
| `@types/mssql` | Tipos de `mssql` para TypeScript                      |

## 2. Librería para conectarse a SQL Server en Windows

`mssql` se puede usar con dos "drivers" por debajo. Escoge según cómo autentica tu banco:

| Caso | Driver | Instalación | Cuándo usarlo |
|------|--------|-------------|---------------|
| **Usuario y contraseña de SQL** (`sa`, `etl_user`...) | `tedious` (viene incluido) | `npm install mssql` | El más simple. JS puro, no necesita nada en Windows. |
| **Autenticación de Windows** (sin contraseña, usa la cuenta del dominio) | `msnodesqlv8` | `npm install mssql msnodesqlv8` + instalar **ODBC Driver 18 for SQL Server** de Microsoft | Cuando el DBA no te da usuario SQL y te dice "usa tu cuenta de dominio". |

### Ejemplo A: usuario y contraseña (tedious)

```ts
import sql from "mssql";

const pool = await new sql.ConnectionPool({
  server: process.env.DB_SERVER!,
  database: process.env.DB_NAME!,
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  options: {
    encrypt: true,
    trustServerCertificate: true, // solo si el servidor usa certificado propio
  },
}).connect();
```

### Ejemplo B: autenticación de Windows (msnodesqlv8)

```ts
import sql from "mssql/msnodesqlv8.js";

const pool = await new sql.ConnectionPool({
  connectionString:
    "Driver={ODBC Driver 18 for SQL Server};Server=MI_SERVIDOR;Database=MI_BD;" +
    "Trusted_Connection=yes;TrustServerCertificate=yes;",
}).connect();
```

> Con el ejemplo B, se conecta **la cuenta de Windows que ejecuta el programa**.
> Esto importa en la sección 4: la tarea programada debe correr con una cuenta
> que tenga acceso a SQL Server.

### Archivo `.env` (credenciales; NUNCA subirlo a git)

```
DB_SERVER=mi-servidor
DB_NAME=Clientes
DB_USER=etl_user
DB_PASSWORD=********
```

Node 22 lo lee de forma nativa con `--env-file=.env`, sin instalar `dotenv`.

## 3. Qué ejecutar

| Momento                     | Comando                                    |
|-----------------------------|--------------------------------------------|
| Instalar dependencias       | `npm install`                              |
| Probar mientras programas   | `npm run dev`                              |
| Compilar para producción    | `npm run build` (genera la carpeta `dist/`) |
| Ejecutar lo compilado       | `node --env-file=.env dist/main.js`        |

En producción **se ejecuta lo compilado** (`dist/`), no `tsx`. Es más rápido y
no depende de herramientas de desarrollo.

### Script `run-etl.bat` (lo que va a llamar el Programador de tareas)

Crearlo en la raíz del proyecto:

```bat
@echo off
cd /d "C:\Users\BME_PERSONAL\Documents\Programacion\etl-clientes"
if not exist logs mkdir logs
node --env-file=.env dist\main.js >> logs\etl.log 2>&1
exit /b %ERRORLEVEL%
```

- `cd /d`: el Programador de tareas arranca en `C:\Windows\System32`, así que
  sin esto no encuentra `.env` ni `dist`.
- `>> logs\etl.log 2>&1`: guarda la salida y los errores en un archivo, porque
  no hay consola que mirar.
- `exit /b %ERRORLEVEL%`: pasa el código de salida de Node (el `process.exit(1)`
  de `main.ts`) al Programador, para que marque la tarea como fallida.

## 4. Programarlo dos veces al día (Programador de tareas)

### Crear la tarea (PowerShell **como Administrador**)

Una sola tarea con dos horarios (mañana y tarde):

```powershell
$accion = New-ScheduledTaskAction -Execute "C:\Users\BME_PERSONAL\Documents\Programacion\etl-clientes\run-etl.bat"

$horarios = @(
  New-ScheduledTaskTrigger -Daily -At "07:00"
  New-ScheduledTaskTrigger -Daily -At "14:00"
)

$config = New-ScheduledTaskSettingsSet `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
  -StartWhenAvailable

Register-ScheduledTask -TaskName "ETL-Clientes" `
  -Action $accion -Trigger $horarios -Settings $config `
  -User "DOMINIO\usuario_etl" -Password "********" `
  -RunLevel Limited
```

| Opción | Por qué |
|--------|---------|
| `-MultipleInstances IgnoreNew` | Si la corrida de la mañana sigue viva a las 14:00, **no arranca otra encima**. Dos corridas a la vez se pisarían en la tabla intermedia. |
| `-ExecutionTimeLimit 2h` | Si se cuelga, Windows la mata. Al día siguiente, el "rescate" de filas en estado 1 las recupera. |
| `-StartWhenAvailable` | Si la PC estaba apagada a la hora programada, corre apenas encienda. |
| `-User` + `-Password` | Corre **aunque nadie haya iniciado sesión**. |
| `-RunLevel Limited` | No necesita ser administrador para correr. Menos permisos = más seguro. |

Probar sin esperar a la hora:

```powershell
Start-ScheduledTask -TaskName "ETL-Clientes"
Get-ScheduledTaskInfo -TaskName "ETL-Clientes"   # LastTaskResult 0 = OK
```

### Permisos necesarios

1. **Para crear la tarea**: PowerShell abierto como Administrador (o la cuenta
   que la crea tiene que ser la misma con la que va a correr).
2. **"Iniciar sesión como proceso por lotes"** para la cuenta `usuario_etl`:
   `secpol.msc` → Directivas locales → Asignación de derechos de usuario →
   *Iniciar sesión como proceso por lotes* → agregar la cuenta.
   Sin esto falla con "error de inicio de sesión" cuando nadie tiene la sesión abierta.
   (En un dominio, normalmente lo asigna TI por GPO.)
3. **Carpeta del proyecto**: la cuenta necesita leer la carpeta (incluido `.env`)
   y escribir en `logs\`.
4. **En SQL Server** (lo pide el DBA), para el login de la cuenta:
   - Bases origen (bd1, bd2, bd3): solo `SELECT`.
   - Tabla intermedia: `SELECT`, `INSERT`, `UPDATE`.
   - Tabla final: `SELECT`, `INSERT`, `UPDATE` (para el MERGE).
   - Nada de `db_owner` ni `sysadmin`.

## 5. Consultas por lotes de 10.000

### ¿OFFSET o "keyset"? → **Keyset es más rápido**

SQL Server no tiene `LIMIT`; usa `TOP` o `OFFSET ... FETCH`.

**Opción 1: OFFSET (paginación por posición)**

```sql
SELECT dui, nombre FROM dbo.Clientes
ORDER BY dui
OFFSET 90000 ROWS FETCH NEXT 10000 ROWS ONLY;
```

**Opción 2: Keyset (paginación por "último visto")** ✅

```sql
SELECT TOP (10000) dui, nombre FROM dbo.Clientes
WHERE dui > @ultimoDui
ORDER BY dui;
```

| | OFFSET | Keyset |
|---|---|---|
| Cómo llega al lote 10 | **Lee y descarta** 90.000 filas para devolver 10.000 | Con el índice salta **directo** al DUI siguiente |
| Costo total con 100k | Crece con cada lote (1+2+…+10 = 55 "lotes" leídos) | Siempre igual (10 lotes leídos) |
| Si entra o sale una fila a mitad de la corrida | Se corren las posiciones: **saltas o repites** filas | Estable: sigue desde el último DUI |
| Requisito | Ninguno | Índice en `dui` (normalmente es la llave primaria) |

Con 100k la diferencia todavía es tolerable, pero keyset es igual de fácil de
escribir y además es **más seguro**: no salta ni repite filas, y eso importa
para la idempotencia.

### Ejemplo con `mssql` (keyset, lotes de 10k)

```ts
import sql from "mssql";

type FilaBd1 = { dui: string; nombre: string };

const TAMANO_LOTE = 10_000;

// async function* = "generador asíncrono": devuelve los lotes de a uno,
// como un Iterator de Java, pero cada next() puede esperar a la BD.
// Así nunca hay más de 10k filas en memoria.
export async function* leerClientesPorLotes(pool: sql.ConnectionPool) {
  let ultimoDui = ""; // "" es menor que cualquier DUI → arranca desde el primero

  while (true) {
    const r = await pool.request()
      .input("ultimo", sql.VarChar(10), ultimoDui) // parámetro = sin inyección SQL
      .input("tam", sql.Int, TAMANO_LOTE)
      .query<FilaBd1>(`
        SELECT TOP (@tam) dui, nombre
        FROM dbo.Clientes
        WHERE dui > @ultimo
        ORDER BY dui
      `);

    const filas = r.recordset;
    if (filas.length === 0) break;

    yield filas; // entrega este lote y se "pausa" hasta que pidan el siguiente

    ultimoDui = filas[filas.length - 1].dui;
    if (filas.length < TAMANO_LOTE) break; // lote incompleto = era el último
  }
}
```

Cómo se usa:

```ts
for await (const lote of leerClientesPorLotes(pool)) {
  console.log("Lote de", lote.length, "filas");
  // aquí: insertar el lote en la tabla intermedia con estado 0 (PENDIENTE)
}
```

> **Nota:** el DUI es texto (`"01234567-8"`), así que `>` compara en orden
> alfabético. Funciona bien porque todos tienen el mismo formato y largo.
