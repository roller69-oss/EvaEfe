import { notaContenido, notaEvaluacion, notaFinal, redondear } from "./calc.js";

export const EVALS = ["1", "2", "3"];

/** Todas las notas calculadas de un alumno. */
export function notasAlumno(d, alumnoId) {
  const cal = d.cal[alumnoId] || {};
  const regla = d.curso.redondeo;
  const porEval = {};
  for (const e of EVALS) {
    const cs = d.contenidos.filter(c => String(c.evaluacion) === e);
    const real = notaEvaluacion(cs, cal);
    porEval[e] = { real, ...boletin(d, alumnoId, e, real, regla) };
  }
  const realFinal = notaFinal(EVALS.map(e => porEval[e].real));
  return { porEval, final: { real: realFinal, ...boletin(d, alumnoId, "final", realFinal, regla) }, cal };
}

function boletin(d, alumnoId, ev, real, regla) {
  const auto = redondear(real, regla);
  const aj = d.aj[alumnoId]?.[ev];
  return { auto, boletin: aj ? Number(aj.nota) : auto, ajustada: Boolean(aj) };
}

export function celdaContenido(c, calif) {
  return notaContenido(c, calif);
}

/** Reparto para estadísticas rápidas. */
export function resumen(notas) {
  const v = notas.filter(n => n != null);
  const media = v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  return {
    n: v.length, media,
    suspensos: v.filter(n => n < 5).length,
    de5a6: v.filter(n => n >= 5 && n < 6).length,
    de6a8: v.filter(n => n >= 6 && n < 8).length,
    de8: v.filter(n => n >= 8).length,
  };
}
