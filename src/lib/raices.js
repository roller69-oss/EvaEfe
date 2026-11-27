// Revisión de notas contra el Excel "Evaluación de alumnos/as por materias" de Raíces.
// Todo se hace en el navegador: el archivo no se guarda ni se sube a ningún sitio.
import { emparejar, normalizar } from "./importar.js";

/**
 * Lee las filas del Excel de Raíces:
 *   Título / Autor / Fecha de creación
 *   Alumno/a | EFB | …
 *   Apellidos, Nombre | 8 | …
 * Devuelve { materias: ["EFB"], filas: [{ nombre, valores: { EFB: "8" } }], fecha } o lanza error.
 */
export function leerRaices(filas) {
  const iCab = filas.findIndex(r => /^alumno/i.test(r[0] || ""));
  if (iCab < 0) throw new Error("cabecera");
  const cab = filas[iCab];
  const materias = [];
  cab.forEach((t, i) => { if (i > 0 && t) materias.push({ indice: i, codigo: t }); });
  if (!materias.length) throw new Error("materias");
  const out = [];
  for (const r of filas.slice(iCab + 1)) {
    const nombre = (r[0] || "").trim();
    if (!nombre || !/\p{L}/u.test(nombre)) continue;
    const valores = {};
    for (const m of materias) valores[m.codigo] = (r[m.indice] || "").trim();
    out.push({ nombre, valores });
  }
  const fecha = filas.find(r => /^fecha de creaci/i.test(r[0] || ""))?.[1] || "";
  return { materias: materias.map(m => m.codigo), filas: out, fecha };
}

/** Materia que se revisa por defecto: la de Educación Física si hay varias. */
export function materiaPorDefecto(materias) {
  return materias.find(m => /^EF/i.test(m)) || materias[0];
}

/** "8", "8,5" → nota; "" → vacío; "EXEN", "NP"… → código. */
export function interpretar(valor) {
  const s = String(valor ?? "").trim();
  if (!s) return { tipo: "vacio" };
  if (/^\d+([.,]\d+)?$/.test(s)) return { tipo: "nota", n: Number(s.replace(",", ".")) };
  return { tipo: "codigo", texto: s.toUpperCase() };
}

/** "Apellido1 Apellido2, Nombre" → { apellidos, nombre } para emparejar con los alumnos de EvaEfe. */
export function partirNombre(s) {
  const i = s.lastIndexOf(",");
  return i < 0 ? { apellidos: s.trim(), nombre: "" } : { apellidos: s.slice(0, i).trim(), nombre: s.slice(i + 1).trim() };
}

/** Empareja cada fila de Raíces con un alumno (sin repetir alumnos). Devuelve los ids o "" si no lo encuentra. */
export function emparejarTodos(filasRaices, alumnos) {
  const usados = new Set();
  return filasRaices.map(f => {
    const a = emparejar(partirNombre(f.nombre), alumnos.filter(x => !usados.has(x.id)));
    if (!a) return "";
    usados.add(a.id);
    return a.id;
  });
}

/**
 * ¿De qué grupo es el archivo? Cuenta cuántos alumnos de Raíces hay en cada grupo.
 * grupos: [{ id, alumnos: [{id, nombre}] }]. Devuelve la lista ordenada de mejor a peor: [{ id, encontrados }].
 */
export function detectarGrupo(filasRaices, grupos) {
  return grupos
    .map(g => ({ id: g.id, encontrados: emparejarTodos(filasRaices, g.alumnos || []).filter(Boolean).length }))
    .sort((a, b) => b.encontrados - a.encontrados);
}

const IGUAL = 1e-6;

/**
 * Compara alumno por alumno.
 *   evaefe: Map alumnoId → { boletin: número|null, exento: bool }
 * Cada fila: { nombre, alumnoId, raices, evaefe, estado, texto }
 *   estado: "ok" | "distinta" | "revisar"
 */
export function comparar(filasRaices, materia, alumnos, evaefe) {
  const ids = emparejarTodos(filasRaices, alumnos);
  const out = filasRaices.map((f, i) => {
    const alumnoId = ids[i];
    const r = interpretar(f.valores[materia]);
    const base = { nombre: f.nombre, alumnoId, raices: f.valores[materia] || "" };
    if (!alumnoId) return { ...base, evaefe: null, estado: "revisar", texto: "No está en este grupo de EvaEfe" };
    const e = evaefe.get(alumnoId) || { boletin: null, exento: false };
    const fila = { ...base, evaefe: e.boletin, exento: e.exento };
    if (r.tipo === "codigo") {
      if (/^EXEN/.test(r.texto) && e.exento && e.boletin == null) return { ...fila, estado: "ok", texto: "Exento en los dos" };
      return { ...fila, estado: "revisar", texto: e.exento ? "Exento en EvaEfe; en Raíces pone otro código" : `En Raíces pone ${r.texto}` };
    }
    if (r.tipo === "vacio") {
      if (e.boletin == null) return { ...fila, estado: "ok", texto: e.exento ? "Exento y sin nota en Raíces" : "Sin nota en los dos" };
      return { ...fila, estado: "distinta", texto: "Falta la nota en Raíces" };
    }
    if (e.boletin == null) return { ...fila, estado: "revisar", texto: e.exento ? "Exento en EvaEfe, pero Raíces tiene nota" : "Sin nota en EvaEfe" };
    if (Math.abs(e.boletin - r.n) < IGUAL) return { ...fila, estado: "ok", texto: "Coincide" };
    return { ...fila, estado: "distinta", texto: "Nota distinta" };
  });
  // Alumnos del grupo que no aparecen en el Excel
  const vistos = new Set(ids.filter(Boolean));
  for (const a of alumnos) {
    if (vistos.has(a.id)) continue;
    const e = evaefe.get(a.id) || { boletin: null, exento: false };
    out.push({ nombre: a.nombre, alumnoId: a.id, raices: null, evaefe: e.boletin, exento: e.exento, estado: "revisar", texto: "No está en el Excel de Raíces" });
  }
  return out;
}

/**
 * El Excel no dice de qué evaluación es: se elige la que más notas tiene en común.
 * porEval: { "1": Map, "2": Map, "3": Map, final: Map }. Si empatan, gana la primera (1.ª antes que final).
 */
export function detectarEvaluacion(filasRaices, materia, alumnos, porEval) {
  let mejor = "1", max = -1;
  for (const ev of ["1", "2", "3", "final"]) {
    const filas = comparar(filasRaices, materia, alumnos, porEval[ev]);
    const n = filas.filter(f => f.estado === "ok" && f.evaefe != null).length;
    if (n > max) { max = n; mejor = ev; }
  }
  return mejor;
}

export function contar(filas) {
  const n = { ok: 0, distinta: 0, revisar: 0 };
  for (const f of filas) n[f.estado]++;
  return n;
}

/** Ordena como en Raíces: por apellidos, sin tildes. */
export const porNombre = (a, b) => normalizar(a.nombre).localeCompare(normalizar(b.nombre), "es");
