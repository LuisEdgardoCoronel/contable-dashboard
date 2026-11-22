// Helpers puros de los formularios con Server Actions. Sin `server-only`: los
// usan las actions (servidor) y los formularios (cliente).

/** Lo que devuelven las Server Actions a `useActionState`. */
export interface EstadoFormulario<C extends string = string> {
  errores?: Partial<Record<C, string>>;
  /** Error general (no asociado a un campo). */
  mensaje?: string;
  /** Lo que se envió, para volver a llenar el formulario (React lo resetea después de la action). */
  valores?: Partial<Record<C, string>>;
}

export const MENSAJES = {
  /** Para los 400 de la API: class-validator puede responder en inglés. */
  revisar: 'Revisá los datos',
} as const;

/** Lee los campos de un `FormData` como strings (un campo ausente o un archivo → `''`). */
export function leerCampos<C extends string>(formData: FormData, campos: readonly C[]): Record<C, string> {
  return Object.fromEntries(
    campos.map((c) => {
      const v = formData.get(c);
      return [c, typeof v === 'string' ? v : ''];
    }),
  ) as Record<C, string>;
}

export function hayErrores(errores: Record<string, string | undefined>): boolean {
  return Object.values(errores).some(Boolean);
}
