// src/tipos.ts

// Cómo viene un registro CRUDO de la base (todo puede venir sucio: texto, null, etc.)
// Por eso los campos son "desconocidos": no confiamos en ellos todavía.
export type RegistroCrudo = {
  dui: unknown;
  nombre: unknown;
  monto: unknown;
  correo?: unknown;
};

// Los estados de la máquina de control (idempotencia).
// 'as const' = valores fijos que no cambian, como un enum de Java.
export const Estado = {
  PENDIENTE: 0,
  EN_PROCESO: 1,
  TERMINADO: 2,
  ERROR_REINTENTO: 3,
  ERROR_PERMANENTE: 4,
} as const;