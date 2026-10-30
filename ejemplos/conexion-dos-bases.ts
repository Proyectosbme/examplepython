// ejemplos/conexion-dos-bases.ts — EJEMPLO de referencia (no es parte del ETL todavía)
// Conecta a DOS servidores SQL Server (sqlqa1 y sqlqa2) al mismo tiempo.
//
// Está fuera de src/ a propósito: así "npm run build" no lo compila hasta que
// se instale la librería.
//
// Requisitos para probarlo:
//   npm install mssql
//   npm install -D @types/mssql
//   copiar .env.example como .env y llenar los datos
//   npx tsx --env-file=.env ejemplos/conexion-dos-bases.ts

import sql from "mssql";

// 1. Arma la configuración de UNA base leyendo las variables con un prefijo
//    ("DB1" → DB1_SERVER, DB1_NAME...). Así no repetimos código por cada base.
function configDesdeEnv(prefijo: string): sql.config {
  const leer = (nombre: string): string => {
    const valor = process.env[`${prefijo}_${nombre}`];
    if (!valor) throw new Error(`Falta la variable ${prefijo}_${nombre} en el .env`);
    return valor;
  };

  const instancia = process.env[`${prefijo}_INSTANCE`];

  return {
    server: leer("SERVER"),
    database: leer("NAME"),
    user: leer("USER"),
    password: leer("PASSWORD"),
    // Con instancia con nombre se usa instanceName y NO el puerto (lo resuelve SQL Browser)
    port: instancia ? undefined : Number(process.env[`${prefijo}_PORT`] ?? 1433),
    options: {
      instanceName: instancia || undefined,
      encrypt: true,
      trustServerCertificate: true, // servidores QA suelen tener certificado propio
    },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30_000 },
  };
}

// 2. IMPORTANTE: un ConnectionPool POR BASE.
//    No usar sql.connect() global: ese es UN solo pool compartido, y al
//    conectar la segunda base reemplazaría (o reusaría) la primera.
async function conectar(prefijo: string): Promise<sql.ConnectionPool> {
  const pool = new sql.ConnectionPool(configDesdeEnv(prefijo));
  pool.on("error", err => console.error(`[${prefijo}] error del pool:`, err));
  await pool.connect();
  console.log(`[${prefijo}] conectado a ${pool.config.server}/${pool.config.database}`);
  return pool;
}

async function main() {
  // Conectamos a las dos bases en paralelo (solo es abrir conexión, es liviano)
  const [poolQa1, poolQa2] = await Promise.all([conectar("DB1"), conectar("DB2")]);

  try {
    // Consulta de prueba en cada una: confirma a qué servidor llegamos
    const r1 = await poolQa1.request().query<{ servidor: string; base: string }>(
      "SELECT @@SERVERNAME AS servidor, DB_NAME() AS base",
    );
    const r2 = await poolQa2.request().query<{ servidor: string; base: string }>(
      "SELECT @@SERVERNAME AS servidor, DB_NAME() AS base",
    );

    console.log("sqlqa1 →", r1.recordset[0]);
    console.log("sqlqa2 →", r2.recordset[0]);
  } finally {
    // finally = se cierra SIEMPRE, aunque falle la consulta (como try-with-resources en Java)
    await Promise.all([poolQa1.close(), poolQa2.close()]);
  }
}

main().catch(err => {
  console.error("Falló la conexión:", err);
  process.exit(1);
});

// ---------------------------------------------------------------------------
// ALTERNATIVA: autenticación de Windows (sin usuario/contraseña de SQL)
// Usa la cuenta de Windows que ejecuta el programa.
// Requiere: npm install msnodesqlv8  +  "ODBC Driver 18 for SQL Server" instalado.
//
// import sql from "mssql/msnodesqlv8.js";
//
// const poolQa1 = await new sql.ConnectionPool({
//   connectionString:
//     "Driver={ODBC Driver 18 for SQL Server};Server=sqlqa1;Database=Clientes;" +
//     "Trusted_Connection=yes;TrustServerCertificate=yes;",
// }).connect();
//
// const poolQa2 = await new sql.ConnectionPool({
//   connectionString:
//     "Driver={ODBC Driver 18 for SQL Server};Server=sqlqa2;Database=Finanzas;" +
//     "Trusted_Connection=yes;TrustServerCertificate=yes;",
// }).connect();
// ---------------------------------------------------------------------------
