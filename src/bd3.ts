// src/bd3.ts — SIMULA la base de contacto (correos)

type FilaBd3 = { dui: string; correo: string };

export async function obtenerCorreos(): Promise<FilaBd3[]> {
  await esperar(300);
  return [
    { dui: "01234567-8", correo: "ana@banco.com" },
    { dui: "04567890-1", correo: "elena@banco.com" },
    // beto y caro no tienen correo → es opcional
  ];
}

function esperar(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}