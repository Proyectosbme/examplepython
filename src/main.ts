// src/main.ts
import { extraer } from "./extraccion.js";
import { transformarLote } from "./transformacion.js";

// Simulamos lo que vendría de la BD (con datos buenos Y malos a propósito)


async function main() {
  const datosCrudos = await extraer();
  console.log("Procesando lote de", datosCrudos.length, "registros...\n");

  const { validos, invalidos } = transformarLote(datosCrudos);

  console.log("VÁLIDOS:", validos.length);
  console.log(validos);

  console.log("\nINVÁLIDOS:", invalidos.length);
  for (const inv of invalidos) {
    console.log(" -", inv.fila.dui, "→", inv.errores.join(", "));
  }

  
}

main();