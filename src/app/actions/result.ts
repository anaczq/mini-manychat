// Retorno comum das server actions: o cliente mostra `error` num toast e, no editor, `fieldErrors` ao lado de cada campo.
export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
