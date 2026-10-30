// src/transformacion.ts
import { z } from "zod";
import type { RegistroCrudo } from "./tipos.js";

// 1. EL ESQUEMA: cómo DEBE ser un registro válido (como una clase Pydantic)
const EsquemaCliente = z.object({
  dui: z.string().regex(/^\d{8}-\d$/, "DUI con formato inválido"),
  nombre: z.string().min(1, "El nombre no puede estar vacío"),
  monto: z.coerce.number().nonnegative("El monto no puede ser negativo"),
  // z.coerce.number() convierte "123" → 123, y rechaza "abc" o null
});

// 2. El tipo LIMPIO se deduce solo del esquema (no lo escribes dos veces)
export type Cliente = z.infer<typeof EsquemaCliente>;

// 3. El resultado de procesar un lote: buenos y malos separados
export type ResultadoLote = {
  validos: Cliente[];
  invalidos: { fila: RegistroCrudo; errores: string[] }[];
};

// 4. LA FUNCIÓN: valida y transforma un lote entero
export function transformarLote(crudos: RegistroCrudo[]): ResultadoLote {
  const validos: Cliente[] = [];
  const invalidos: ResultadoLote["invalidos"] = [];

  for (const crudo of crudos) {
    const r = EsquemaCliente.safeParse(crudo);  // safeParse NO lanza error

    if (r.success) {
      // Pasó la validación → ahora transformamos (limpieza del dato)
      const limpio: Cliente = {
        ...r.data,
        nombre: r.data.nombre.trim().toUpperCase(),  // normalizar nombre
        monto: Math.round(r.data.monto * 100) / 100, // 2 decimales
      };
      validos.push(limpio);
    } else {
      // Falló → guardamos el porqué (irá a estado 3)
      const errores = r.error.issues.map(i => i.message);
      invalidos.push({ fila: crudo, errores });
    }
  }

  return { validos, invalidos };
}