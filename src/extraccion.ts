// src/extraccion.ts — junta las 3 bases en un registro por DUI
import { obtenerClientes } from "./bd1.js";
import { obtenerMontos } from "./bd2.js";
import { obtenerCorreos } from "./bd3.js";
import type { RegistroCrudo } from "./tipos.js";

export async function extraer(): Promise<RegistroCrudo[]> {
  // 1. Traer de las 3 bases EN PARALELO (no una tras otra)
  const [clientes, montos, correos] = await Promise.all([
    obtenerClientes(),
    obtenerMontos(),
    obtenerCorreos(),
  ]);

  // 2. Map con DUI como llave (como un HashMap<String, Registro>)
  const mapa = new Map<string, RegistroCrudo>();

  // Base: arrancamos con la lista de clientes (bd1)
  for (const c of clientes) {
    mapa.set(c.dui, { dui: c.dui, nombre: c.nombre, monto: undefined, correo: undefined });
  }

  // Cruzamos el monto (bd2) por DUI
  for (const m of montos) {
    const reg = mapa.get(m.dui);
    if (reg) reg.monto = m.monto;   // si el DUI existe, le pega el monto
  }

  // Cruzamos el correo (bd3) por DUI
  for (const co of correos) {
    const reg = mapa.get(co.dui);
    if (reg) reg.correo = co.correo;
  }

  // 3. Devolver todos los registros consolidados
  return [...mapa.values()];   // convierte el Map a array
}