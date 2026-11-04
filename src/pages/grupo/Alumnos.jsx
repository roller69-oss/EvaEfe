import { useState } from "react";
import { supabase, q, mensajeError } from "../../lib/supabase.js";
import { BotonBorrar, CampoEditable } from "../../components/ui.jsx";
import { leerListado, nombresDeColumna, normalizar } from "../../lib/importar.js";

export default function Alumnos({ g }) {
  const { alumnos, grupo } = g.d;
  const [nuevo, setNuevo] = useState("");
  const [lista, setLista] = useState("");
  const [ok, setOk] = useState("");

  async function anadir(nombres) {
    const base = alumnos.reduce((m, a) => Math.max(m, a.orden), -1) + 1;
    const filas = nombres.map((n, i) => ({ grupo_id: grupo.id, nombre: n, orden: base + i }));
    try {
      const creados = await q(supabase.from("alumnos").insert(filas).select());
      g.setAlumnos(a => [...a, ...creados]);
      return true;
    } catch (e) { g.setError(mensajeError(e)); return false; }
  }

  async function guardar(al, cambios) {
    try { await q(supabase.from("alumnos").update(cambios).eq("id", al.id)); g.setAlumnos(as => as.map(a => a.id === al.id ? { ...a, ...cambios } : a)); }
    catch (e) { g.setError(mensajeError(e)); }
  }

  async function ordenarAZ() {
    const ord = [...alumnos].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).map((a, i) => ({ ...a, orden: i }));
    try {
      await Promise.all(ord.map(a => q(supabase.from("alumnos").update({ orden: a.orden }).eq("id", a.id))));
      g.setAlumnos(ord); setOk("Lista ordenada");
    } catch (e) { g.setError(mensajeError(e)); }
  }

  return (
    <div className="rejilla">
      <section className="panel" style={{ gridColumn: "span 2" }}>
        <div className="fila">
          <h3>Alumnos <span className="muted">· {alumnos.length}</span></h3>
          <span className="espacio" />
          {alumnos.length > 1 && <button className="btn sm" onClick={ordenarAZ}>Ordenar A–Z</button>}
        </div>
        {ok && <p className="ok small" style={{ margin: 0 }}>{ok}</p>}
        {!alumnos.length && <p className="muted" style={{ margin: 0 }}>Aún no hay alumnos. Pega la lista desde Rayuela o añádelos uno a uno.</p>}
        <div className="alumnos">
          {alumnos.map((a, i) => (
            <div className="alumno" key={a.id}>
              <span className="num">{i + 1}</span>
              <CampoEditable valor={a.nombre} aria-label="Nombre" onGuardar={v => guardar(a, { nombre: v.trim() || a.nombre })} />
              <CampoEditable valor={a.observaciones} className="in obs" placeholder="Observaciones" aria-label="Observaciones" onGuardar={v => guardar(a, { observaciones: v.trim() })} />
              <BotonBorrar texto="Quitar" confirmar="Borra sus notas" onConfirmar={async () => {
                try { await q(supabase.from("alumnos").delete().eq("id", a.id)); g.setAlumnos(as => as.filter(x => x.id !== a.id)); } catch (e) { g.setError(mensajeError(e)); }
              }} />
            </div>
          ))}
        </div>
      </section>

      <div className="columna">
        <Importar alumnos={alumnos} grupo={grupo} anadir={anadir} onHecho={t => setOk(t)} />
        <form className="panel" onSubmit={async e => { e.preventDefault(); if (nuevo.trim() && await anadir([nuevo.trim()])) setNuevo(""); }}>
          <h3>Añadir alumno</h3>
          <div className="fila">
            <input className="in" style={{ flex: "1 1 160px" }} value={nuevo} onChange={e => setNuevo(e.target.value)} placeholder="Apellidos, Nombre" aria-label="Nombre del alumno" />
            <button className="btn primario" type="submit">Añadir</button>
          </div>
        </form>
        <form className="panel" onSubmit={async e => {
          e.preventDefault();
          const nombres = lista.split(/\r?\n/).map(l => l.split("\t")[0].trim()).filter(Boolean);
          if (nombres.length && await anadir(nombres)) { setLista(""); setOk(`${nombres.length} alumno(s) añadidos`); }
        }}>
          <h3>Pegar lista</h3>
          <p className="pista" style={{ margin: 0 }}>Un alumno por línea. Puedes copiar la columna de nombres desde Rayuela o Excel; si copias varias columnas se usa la primera.</p>
          <textarea className="in" value={lista} onChange={e => setLista(e.target.value)} placeholder={"Benítez Soto, Lucía\nCano Díaz, Bruno\n…"} aria-label="Lista de alumnos" />
          <div><button className="btn primario" type="submit">Añadir lista</button></div>
        </form>
      </div>
    </div>
  );
}

function Importar({ alumnos, grupo, anadir, onHecho }) {
  const [datos, setDatos] = useState(null); // { nombre, filas, columnas, col }
  const [marcados, setMarcados] = useState({});
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const existentes = new Set(alumnos.map(a => normalizar(a.nombre)));

  async function elegir(e) {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setError(""); setCargando(true);
    try {
      const r = await leerListado(f);
      if (!r.columnas.length) throw new Error("vacío");
      prepararColumna({ nombre: f.name, filas: r.filas, columnas: r.columnas }, r.sugerida);
    } catch {
      setError("No he podido leer ese archivo. Exporta desde Rayuela como “Hoja Microsoft Excel” o “Fichero CSV” y vuelve a probar.");
      setDatos(null);
    } finally { setCargando(false); }
  }

  function prepararColumna(d, col) {
    const nombres = nombresDeColumna(d.filas, col);
    setDatos({ ...d, col, nombres });
    setMarcados(Object.fromEntries(nombres.map(n => [n, !existentes.has(normalizar(n))])));
  }

  const elegidos = datos ? datos.nombres.filter(n => marcados[n]) : [];

  async function importar() {
    if (!elegidos.length) return;
    setCargando(true);
    if (await anadir(elegidos)) { onHecho(`${elegidos.length} alumno(s) importados de ${datos.nombre}`); setDatos(null); }
    setCargando(false);
  }

  return (
    <section className="panel">
      <h3>Importar desde Rayuela</h3>
      {!datos && (
        <>
          <p className="pista" style={{ margin: 0 }}>En Rayuela, exporta “Mis alumnos y alumnas” de este grupo como <b>Hoja Microsoft Excel</b> (o CSV) y elige aquí el archivo. Se lee en tu navegador y antes de guardar ves la lista.</p>
          <label className="btn primario" style={{ alignSelf: "flex-start" }}>
            {cargando ? "Leyendo…" : "Elegir archivo"}
            <input type="file" accept=".xls,.xlsx,.ods,.csv,.txt" onChange={elegir} hidden />
          </label>
        </>
      )}
      {error && <p className="error small" style={{ margin: 0 }}>{error}</p>}
      {datos && (
        <>
          <p className="small" style={{ margin: 0 }}>Archivo <b>{datos.nombre}</b> → grupo <b>{grupo.nombre}</b></p>
          {datos.columnas.length > 1 && (
            <label className="f">Columna con los nombres
              <select className="in" value={datos.col} onChange={e => prepararColumna(datos, Number(e.target.value))}>
                {datos.columnas.map(c => <option key={c.indice} value={c.indice}>{c.titulo} — p. ej. {c.muestra}</option>)}
              </select>
            </label>
          )}
          <div className="fila small">
            <span><b>{elegidos.length}</b> de {datos.nombres.length} marcados</span>
            <span className="espacio" />
            <button type="button" className="btn sm fantasma" onClick={() => setMarcados(Object.fromEntries(datos.nombres.map(n => [n, true])))}>Todos</button>
            <button type="button" className="btn sm fantasma" onClick={() => setMarcados({})}>Ninguno</button>
          </div>
          <div className="vista-import">
            {datos.nombres.map(n => {
              const ya = existentes.has(normalizar(n));
              return (
                <label key={n} className={`check pequeno ${ya ? "ya" : ""}`}>
                  <input type="checkbox" checked={!!marcados[n]} onChange={e => setMarcados(m => ({ ...m, [n]: e.target.checked }))} />
                  <span>{n}</span>{ya && <span className="muted"> · ya está</span>}
                </label>
              );
            })}
            {!datos.nombres.length && <p className="muted small" style={{ margin: 0 }}>No hay nombres en esa columna. Prueba con otra.</p>}
          </div>
          <div className="fila">
            <button type="button" className="btn primario" disabled={!elegidos.length || cargando} onClick={importar}>
              {cargando ? "Guardando…" : `Importar ${elegidos.length} alumno(s)`}
            </button>
            <button type="button" className="btn" onClick={() => setDatos(null)}>Cancelar</button>
          </div>
        </>
      )}
    </section>
  );
}
