import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, q, mensajeError } from "./supabase.js";

/** Carga todo lo de un grupo: grupo, curso, alumnos, contenidos del curso, calificaciones y ajustes de boletín. */
export function useGrupo(id) {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(0);
  const pendientes = useRef(new Map()); // clave -> {timer, cambios}

  const cargar = useCallback(async () => {
    try {
      const grupo = await q(supabase.from("grupos").select("*, cursos(*)").eq("id", id).single());
      const [alumnos, contenidos] = await Promise.all([
        q(supabase.from("alumnos").select("*").eq("grupo_id", id).order("orden").order("created_at")),
        q(supabase.from("contenidos").select("*, items(*)").eq("curso_id", grupo.curso_id).order("orden").order("created_at")),
      ]);
      contenidos.forEach(c => c.items.sort((a, b) => a.orden - b.orden));
      const ids = alumnos.map(a => a.id);
      const [califs, ajustes] = ids.length
        ? await Promise.all([
            q(supabase.from("calificaciones").select("*").in("alumno_id", ids)),
            q(supabase.from("ajustes_boletin").select("*").in("alumno_id", ids)),
          ])
        : [[], []];
      const cal = {};
      for (const c of califs) (cal[c.alumno_id] ||= {})[c.contenido_id] = c;
      const aj = {};
      for (const a of ajustes) (aj[a.alumno_id] ||= {})[a.evaluacion] = a;
      // Criterios y competencias (vacío si aún no se ejecutó 02_criterios.sql)
      const [{ data: competencias }, { data: criterios }] = await Promise.all([
        supabase.from("competencias").select("*").eq("curso_id", grupo.curso_id),
        supabase.from("criterios").select("*").eq("curso_id", grupo.curso_id),
      ]);
      // Días del diario de este grupo (vacío si aún no se ejecutó 03_diario.sql)
      const { data: sesiones } = await supabase.from("sesiones_diario").select("id, contenido_id, fecha").eq("grupo_id", id).order("fecha");
      setD({ grupo, curso: grupo.cursos, alumnos, contenidos: conSesiones(contenidos, sesiones || []), sesiones: sesiones || [], cal, aj, competencias: competencias || [], criterios: criterios || [] });
    } catch (e) { setError(mensajeError(e)); }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  const setAlumnos = fn => setD(x => ({ ...x, alumnos: typeof fn === "function" ? fn(x.alumnos) : fn }));

  /** Cambia una calificación al instante en pantalla y la guarda en Supabase agrupando toques rápidos. */
  const guardarCalif = useCallback((alumnoId, contenidoId, cambios) => {
    let fila;
    setD(x => {
      const prev = x.cal[alumnoId]?.[contenidoId] || { alumno_id: alumnoId, contenido_id: contenidoId, valores: {}, anotaciones: {}, estado: "normal", nota: null, compensatorio: null, extra: {} };
      fila = { ...prev, ...cambios };
      return { ...x, cal: { ...x.cal, [alumnoId]: { ...(x.cal[alumnoId] || {}), [contenidoId]: fila } } };
    });
    const clave = alumnoId + ":" + contenidoId;
    const p = pendientes.current.get(clave);
    if (p) clearTimeout(p.timer); else setGuardando(n => n + 1);
    const timer = setTimeout(async () => {
      pendientes.current.delete(clave);
      try {
        const { alumno_id, contenido_id, nota, valores, estado, compensatorio, anotaciones, extra } = fila;
        const datos = { alumno_id, contenido_id, nota, valores, estado, compensatorio, anotaciones };
        if (extra && Object.keys(extra).length) datos.extra = extra; // columna de 03_diario.sql
        await q(supabase.from("calificaciones").upsert(datos, { onConflict: "alumno_id,contenido_id" }));
      } catch (e) { setError("No se ha guardado una nota: " + mensajeError(e)); }
      finally { setGuardando(n => n - 1); }
    }, 600);
    pendientes.current.set(clave, { timer });
  }, []);

  /** Nota de boletín puesta a mano. nota=null la quita y vuelve al redondeo automático. */
  const guardarAjuste = useCallback(async (alumnoId, evaluacion, nota) => {
    try {
      if (nota == null) {
        await q(supabase.from("ajustes_boletin").delete().eq("alumno_id", alumnoId).eq("evaluacion", evaluacion));
      } else {
        await q(supabase.from("ajustes_boletin").upsert({ alumno_id: alumnoId, evaluacion, nota }, { onConflict: "alumno_id,evaluacion" }));
      }
      setD(x => {
        const a = { ...(x.aj[alumnoId] || {}) };
        if (nota == null) delete a[evaluacion]; else a[evaluacion] = { alumno_id: alumnoId, evaluacion, nota };
        return { ...x, aj: { ...x.aj, [alumnoId]: a } };
      });
    } catch (e) { setError(mensajeError(e)); }
  }, []);

  /** Crea (o recupera) el día de diario de una fecha. Devuelve su id. */
  const crearSesion = useCallback(async (contenidoId, fecha) => {
    try {
      const [s] = await q(supabase.from("sesiones_diario").upsert({ contenido_id: contenidoId, grupo_id: id, fecha }, { onConflict: "contenido_id,grupo_id,fecha" }).select("id, contenido_id, fecha"));
      setD(x => {
        const sesiones = [...x.sesiones.filter(z => z.id !== s.id), s].sort((a, b) => a.fecha.localeCompare(b.fecha));
        return { ...x, sesiones, contenidos: conSesiones(x.contenidos, sesiones) };
      });
      return s.id;
    } catch (e) {
      setError(/sesiones_diario|schema cache|does not exist/i.test(e?.message || "") ? "Falta ejecutar supabase/03_diario.sql en Supabase." : mensajeError(e));
      return null;
    }
  }, [id]);

  const borrarSesion = useCallback(async sesionId => {
    try {
      await q(supabase.from("sesiones_diario").delete().eq("id", sesionId));
      setD(x => {
        const sesiones = x.sesiones.filter(z => z.id !== sesionId);
        return { ...x, sesiones, contenidos: conSesiones(x.contenidos, sesiones) };
      });
    } catch (e) { setError(mensajeError(e)); }
  }, []);

  // Avisa si se intenta cerrar con notas sin guardar
  useEffect(() => {
    const h = e => { if (pendientes.current.size) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  return { d, error, setError, cargar, setAlumnos, guardarCalif, guardarAjuste, guardando, crearSesion, borrarSesion };
}

/** Añade a cada contenido diario la lista ordenada de ids de sus días en este grupo. */
function conSesiones(contenidos, sesiones) {
  return contenidos.map(c => (c.tipo === "diario" ? { ...c, sesiones: sesiones.filter(s => s.contenido_id === c.id).map(s => s.id) } : c));
}
