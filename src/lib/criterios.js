// Notas por criterio y por competencia. Sin dependencias: se puede probar con node.
import { notaContenido } from "./calc.js";

/** Enlaces de un contenido a criterios, siempre como array válido. */
export const enlaces = c => (Array.isArray(c.criterios) ? c.criterios.filter(e => e && e.criterio_id) : []);

/** Peso efectivo de una herramienta en un criterio: (peso propio o carga) × pct. */
export const pesoEnCriterio = (c, e) => Number(e.peso ?? c.peso ?? 0) * Number(e.pct ?? 100) / 100;

/**
 * Nota de un alumno en cada criterio.
 * contenidos: los que cuentan (los de una evaluación, o todos para la final).
 * Devuelve { [criterio_id]: nota|null }
 */
export function notasCriterios(criterios, contenidos, califPorContenido) {
  const acc = {};
  for (const c of contenidos) {
    const r = notaContenido(c, califPorContenido[c.id]);
    if (!r.cuenta) continue;
    for (const e of enlaces(c)) {
      const w = pesoEnCriterio(c, e);
      if (w <= 0) continue;
      const a = (acc[e.criterio_id] ||= { s: 0, w: 0 });
      a.s += r.nota * w; a.w += w;
    }
  }
  const out = {};
  for (const cr of criterios) out[cr.id] = acc[cr.id]?.w ? acc[cr.id].s / acc[cr.id].w : null;
  return out;
}

/** Nota de cada competencia: media de sus criterios con nota, ponderada por el peso del criterio. */
export function notasCompetencias(competencias, criterios, notasCrit) {
  const out = {};
  for (const ce of competencias) {
    let s = 0, w = 0;
    for (const cr of criterios) {
      if (cr.competencia_id !== ce.id) continue;
      const n = notasCrit[cr.id], p = Number(cr.peso ?? 1);
      if (n == null || p <= 0) continue;
      s += n * p; w += p;
    }
    out[ce.id] = w ? s / w : null;
  }
  return out;
}

/**
 * Interpreta texto pegado de la programación o del decreto.
 * Reconoce líneas como:
 *   "CE1. Descripción" · "Competencia específica 1. Descripción" · "1. Descripción" (si no hay criterios con ese número aún es competencia)
 *   "1.1 Descripción" · "1.1. Descripción" · "Criterio 1.1: Descripción"
 * Las líneas sin código se añaden a la descripción anterior.
 */
export function parsearCriterios(texto) {
  const comp = new Map(); // numero -> {codigo, descripcion}
  const crit = [];
  let ultimo = null;
  for (const bruta of texto.split(/\r?\n/)) {
    const l = bruta.replace(/\s+/g, " ").trim();
    if (!l) continue;
    let m;
    if ((m = l.match(/^(?:criterio(?:s)?(?: de evaluaci[oó]n)?\s*)?(\d{1,2})\.(\d{1,2})\.?\s*[:.\-–—)]?\s*(.*)$/i))) {
      const n = Number(m[1]);
      if (!comp.has(n)) comp.set(n, { numero: n, codigo: `CE${n}`, descripcion: "" });
      ultimo = { codigo: `${n}.${Number(m[2])}`, competencia: n, descripcion: m[3] };
      crit.push(ultimo);
    } else if ((m = l.match(/^(?:CE\s*|competencia(?:s)? espec[ií]fica\s*)(\d{1,2})\.?\s*[:.\-–—)]?\s*(.*)$/i)) || (m = l.match(/^(\d{1,2})\.\s+(.*)$/))) {
      const n = Number(m[1]);
      const prev = comp.get(n);
      ultimo = { numero: n, codigo: `CE${n}`, descripcion: m[2] || prev?.descripcion || "" };
      comp.set(n, ultimo);
    } else if (ultimo) {
      ultimo.descripcion = (ultimo.descripcion ? ultimo.descripcion + " " : "") + l;
    }
  }
  return { competencias: [...comp.values()].sort((a, b) => a.numero - b.numero), criterios: crit };
}

/** Ordena códigos tipo "2.10" después de "2.9". */
export const compararCodigo = (a, b) => {
  const pa = String(a).match(/\d+/g)?.map(Number) || [], pb = String(b).match(/\d+/g)?.map(Number) || [];
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pa[i] ?? -1) !== (pb[i] ?? -1)) return (pa[i] ?? -1) - (pb[i] ?? -1);
  return String(a).localeCompare(String(b));
};
