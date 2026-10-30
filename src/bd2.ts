// src/bd2.ts — SIMULA la base financiera (montos)

type FilaBd2 = { dui: string; monto: number };

export async function obtenerMontos(): Promise<FilaBd2[]> {
  await esperar(300);
  return [
    { dui: "01234567-8", monto: 1500.5 },
    { dui: "02345678-9", monto: -50 },   // ← dato malo a propósito (negativo)
    { dui: "04567890-1", monto: 3200 },
    // OJO: caro (03456789-0) NO aparece aquí → le faltará el monto
  ];
}

function esperar(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}