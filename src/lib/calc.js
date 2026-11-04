// Cálculo de notas de EvaEfe. Sin dependencias: se puede probar con node.

const EPS = 1e-9;

/** Nota sobre 10 de una rúbrica: media ponderada de los ítems ÷ escala × 10. Null si no hay ítems puntuados. */
export function notaRubrica(items, valores, escalaMax = 5) {
  let s = 0, w = 0;
  for (const it of items) {
    const v = valores?.[it.id];
    if (v == null || v === "") continue;
    const p = Number(it.peso ?? 1);
    if (p <= 0) continue;
    s += Number(v) * p; w += p;
  }
  return w ? (s / w / escalaMax) * 10 : null;
}

/**
 * Nota de un contenido para un alumno.
 * Devuelve { nota, cuenta, estado }: cuenta=false si el alumno está exento o aún no tiene nota.
 */
export function notaContenido(contenido, calif) {
  const estado = calif?.estado ?? "normal";
  if (estado === "exento") return { nota: null, cuenta: false, estado };
  if (estado === "np") return { nota: 0, cuenta: true, estado };
  if (estado === "compensatorio") {
    const n = calif?.compensatorio?.nota;
    return n == null ? { nota: null, cuenta: false, estado } : { nota: Number(n), cuenta: true, estado };
  }
  const n = contenido.tipo === "nota"
    ? (calif?.nota == null ? null : Number(calif.nota))
    : notaRubrica(contenido.items ?? [], calif?.valores, Number(contenido.escala_max ?? 5));
  return { nota: n, cuenta: n != null, estado };
}

/** Nota de una evaluación: contenidos de esa evaluación ponderados por su peso (se reparten los que no cuentan). */
export function notaEvaluacion(contenidos, califPorContenido) {
  let s = 0, w = 0;
  for (const c of contenidos) {
    const r = notaContenido(c, califPorContenido[c.id]);
    const p = Number(c.peso ?? 0);
    if (!r.cuenta || p <= 0) continue;
    s += r.nota * p; w += p;
  }
  return w ? s / w : null;
}

/** Nota final: media de las notas reales de las evaluaciones que tienen nota. */
export function notaFinal(notasEval) {
  const v = notasEval.filter(n => n != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** Redondeo para boletín según la regla del curso. */
export function redondear(nota, regla = { mitad_sube: true, umbral_diez: null }) {
  if (nota == null) return null;
  const u = regla?.umbral_diez;
  if (u != null && u !== "" && nota + EPS >= Number(u)) return 10;
  const r = regla?.mitad_sube === false ? Math.floor(nota + EPS) : Math.floor(nota + 0.5 + EPS);
  return Math.max(0, Math.min(10, r));
}

export const REDONDEO_POR_ETAPA = {
  ESO: { mitad_sube: true, umbral_diez: null },
  BACH: { mitad_sube: true, umbral_diez: 9.25 },
  OTRO: { mitad_sube: true, umbral_diez: null },
};

export const fmt = (n, d = 2) => (n == null || Number.isNaN(n) ? "" : Number(n).toFixed(d).replace(".", ","));
