// src/bd1.ts — SIMULA la base de datos de clientes (personales)
// Cuando haya SQL Server real, solo cambia el INTERIOR de esta función.

type FilaBd1 = { dui: string; nombre: string };

// async + delay: imita la latencia de una consulta real a la BD
export async function obtenerClientes(): Promise<FilaBd1[]> {
  await esperar(300); // simula que la red tarda
  return [
    { dui: "01234567-8", nombre: "  ana lópez  " },
    { dui: "02345678-9", nombre: "beto ríos" },
    { dui: "03456789-0", nombre: "caro díaz" },
    { dui: "04567890-1", nombre: "elena vega" },
  ];
}

function esperar(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}