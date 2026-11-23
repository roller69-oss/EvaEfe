// Cálculo de notas de EvaEfe. Sin dependencias: se puede probar con node.

const EPS = 1e-9;

/** Nota sobre 10 de una rúbrica: media ponderada de los ítems ÷ escala × 10. Null si no hay ítems puntuados. */
export function notaRubrica(items, valores, escalaMax = 5) {
  return detalleRubrica(items, valores, escalaMax).nota;
}

/**
 * Rúbrica: los ítems "nivel" (0–escala) hacen la media ponderada sobre 10;
 * los ítems "suma"/"resta" añaden o quitan puntos por cada vez que ocurren.
 * El tope (0 a 10) se aplica al final: un 11 con 1 punto restado se queda en 10.
 */
export function detalleRubrica(items, valores, escalaMax = 5) {
  let s = 0, w = 0, ajuste = 0;
  for (const it of items) {
    const v = valores?.[it.id];
    if (v == null || v === "") continue;
    const tipo = it.tipo || "nivel";
    if (tipo === "suma" || tipo === "resta") {
      ajuste += (tipo === "suma" ? 1 : -1) * Number(v) * Number(it.puntos ?? 0.5);
      continue;
    }
    const p = Number(it.peso ?? 1);
    if (p <= 0) continue;
    s += Number(v) * p; w += p;
  }
  if (!w) return { base: null, ajuste, sinTope: null, nota: null };
  const base = (s / w / escalaMax) * 10;
  const sinTope = base + ajuste;
  return { base, ajuste, sinTope, nota: Math.max(0, Math.min(10, sinTope)) };
}

/**
 * Nota de un contenido para un alumno.
 * Devuelve { nota, cuenta, estado }: cuenta=false si el alumno está exento o aún no tiene nota.
 */
export function notaContenido(contenido, calif) {
  const r = notaContenidoBase(contenido, calif);
  // Contenido dado por terminado en el grupo: quien no tenga nota cuenta 0 (salvo exentos)
  if (contenido.terminado && !r.cuenta && r.estado !== "exento") return { ...r, nota: 0, cuenta: true, ceroAuto: true };
  return r;
}

function notaContenidoBase(contenido, calif) {
  const estado = calif?.estado ?? "normal";
  if (estado === "exento") return { nota: null, cuenta: false, estado };
  if (estado === "np") return { nota: 0, cuenta: true, estado };
  if (estado === "compensatorio") {
    const n = calif?.compensatorio?.nota;
    return n == null ? { nota: null, cuenta: false, estado } : { nota: Number(n), cuenta: true, estado };
  }
  if (contenido.tipo === "diario") return { ...notaDiario(contenido, calif), estado };
  const notas = notasIntentos(contenido, calif);
  const { nota, elegido, manual } = notaQueCuenta(contenido, calif, notas);
  return { nota, cuenta: nota != null, estado, intentos: notas, elegido, manual, repitio: notas.length > 1 && notas.slice(1).some(x => x != null) };
}

/* ---------- Repetición de pruebas ---------- */

export const REPETICION_DEFECTO = { modo: "no", intentos: 1, cuenta: "mejor" };
export const repeticion = c => ({ ...REPETICION_DEFECTO, ...(c?.repeticion || {}) });

/** Nota de un intento: 0 = el primero (campos de siempre), 1… = calif.intentos[i-1]. */
export function notaIntento(contenido, intento) {
  if (contenido.tipo === "nota") return intento?.nota == null ? null : Number(intento.nota);
  return notaRubrica(contenido.items ?? [], intento?.valores, Number(contenido.escala_max ?? 5));
}

/** Notas de todos los intentos: [primero, segundo, …] (null si ese intento no tiene nota). */
export function notasIntentos(contenido, calif) {
  const extra = Array.isArray(calif?.intentos) ? calif.intentos : [];
  return [notaIntento(contenido, calif), ...extra.map(i => notaIntento(contenido, i))];
}

/** Qué nota cuenta: el intento elegido a mano o la regla del contenido (mejor, último o media). */
export function notaQueCuenta(contenido, calif, notas) {
  const validas = notas.map((n, i) => [n, i]).filter(([n]) => n != null);
  if (!validas.length) return { nota: null, elegido: null, manual: false };
  const man = calif?.extra?.intento_elegido;
  if (man != null && notas[man] != null) return { nota: notas[man], elegido: man, manual: true };
  const regla = repeticion(contenido).cuenta;
  if (regla === "ultima") { const [n, i] = validas[validas.length - 1]; return { nota: n, elegido: i, manual: false }; }
  if (regla === "media") return { nota: validas.reduce((a, [n]) => a + n, 0) / validas.length, elegido: null, manual: false };
  const [n, i] = validas.reduce((m, x) => (x[0] > m[0] ? x : m));
  return { nota: n, elegido: i, manual: false };
}

/** ¿Tiene derecho a repetir? El cambio a mano manda sobre la regla del contenido. */
export function derechoRepetir(contenido, calif) {
  const man = calif?.extra?.derecho_repetir;
  if (man && typeof man.valor === "boolean") return { derecho: man.valor, manual: true, motivo: man.motivo || "" };
  const { modo } = repeticion(contenido);
  if (modo === "todos") return { derecho: true, manual: false };
  if (modo === "presentados") {
    const presentado = (calif?.estado ?? "normal") === "normal" && (notaIntento(contenido, calif) != null || calif?.extra?.asistencia?.valor === "vino");
    return { derecho: presentado, manual: false };
  }
  return { derecho: false, manual: false };
}

/**
 * Asistencia al examen (1.er intento): "evaluado" si ya tiene nota, "pendiente" si vino y falta evaluarlo,
 * "falta" si no vino, null si no se pasó lista.
 */
export function asistenciaExamen(contenido, calif) {
  if (contenido.tipo === "diario" || (calif?.estado ?? "normal") !== "normal") return null;
  if (notaIntento(contenido, calif) != null) return "evaluado";
  const a = calif?.extra?.asistencia?.valor;
  return a === "vino" ? "pendiente" : a === "falta" ? "falta" : null;
}

/** Texto para el Excel: "Repitió: 1.º 5,5 / 2.º 7 → cuenta 7 (mejor)". */
export function textoIntentos(contenido, r) {
  if (!r?.repitio) return "";
  const regla = { mejor: "mejor", ultima: "último", media: "media" }[repeticion(contenido).cuenta];
  const lista = r.intentos.map((n, i) => `${i + 1}.º ${n == null ? "—" : fmt(n)}`).join(" / ");
  return `Repitió: ${lista} → cuenta ${fmt(r.nota)} (${r.manual ? "elegido a mano" : regla})`;
}

/** Cara 1–5 a nota sobre 10: 1 = 0 · 2 = 2,5 · 3 = 5 · 4 = 7,5 · 5 = 10 */
export const caraANota = v => ((Number(v) - 1) / 4) * 10;

/**
 * Diario: media de los días que vino (las faltas no cuentan en la media).
 * Si su asistencia no llega al mínimo y no tiene excepción → 0 y debe hacer trabajo.
 * contenido.sesiones = ids de las sesiones de ESTE grupo.
 */
export function notaDiario(contenido, calif) {
  const vals = calif?.valores || {};
  // Los días con falta justificada ("J") no cuentan para nada
  const ses = (contenido.sesiones ?? []).filter(s => vals[s] !== "J");
  const justificadas = (contenido.sesiones ?? []).length - ses.length;
  const total = ses.length;
  const presentes = ses.filter(s => vals[s] != null && vals[s] !== "");
  const asistencia = total ? (presentes.length / total) * 100 : null;
  const suma = presentes.reduce((a, s) => a + caraANota(vals[s]), 0);
  // falta_cero: los días sin cara cuentan 0; si no, la media es solo de los días que vino
  const media = contenido.falta_cero
    ? (total ? suma / total : null)
    : (presentes.length ? suma / presentes.length : null);
  const excepcion = calif?.extra?.excepcion || null;
  const base = { presentes: presentes.length, total, justificadas, asistencia, media, excepcion, debeTrabajo: false };
  if (!total) return { ...base, nota: null, cuenta: false };
  const usarMinimo = contenido.usar_minimo !== false;
  if (usarMinimo && !excepcion && asistencia + 1e-9 < Number(contenido.min_asistencia ?? 80)) return { ...base, nota: 0, cuenta: true, debeTrabajo: true };
  return { ...base, nota: media, cuenta: media != null };
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
