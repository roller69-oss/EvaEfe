import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase, q, mensajeError } from "../lib/supabase.js";
import { fmt } from "../lib/calc.js";
import { compararCodigo, enlaces, parsearCriterios, pesoEnCriterio } from "../lib/criterios.js";
import { Aviso, BotonBorrar, CampoEditable, Cargando, numero } from "../components/ui.jsx";

export default function Criterios() {
  const { id } = useParams();
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [texto, setTexto] = useState("");
  const [ok, setOk] = useState("");
  const [nuevo, setNuevo] = useState({ codigo: "", descripcion: "" });

  async function cargar() {
    try {
      const [curso, competencias, criterios, contenidos] = await Promise.all([
        q(supabase.from("cursos").select("*").eq("id", id).single()),
        q(supabase.from("competencias").select("*").eq("curso_id", id)),
        q(supabase.from("criterios").select("*").eq("curso_id", id)),
        q(supabase.from("contenidos").select("id, nombre, evaluacion, peso, criterios").eq("curso_id", id).order("evaluacion").order("orden")),
      ]);
      competencias.sort((a, b) => compararCodigo(a.codigo, b.codigo));
      criterios.sort((a, b) => compararCodigo(a.codigo, b.codigo));
      setD({ curso, competencias, criterios, contenidos });
    } catch (e) {
      setError(e?.code === "42P01" || /does not exist|schema cache/i.test(e?.message || "")
        ? "Falta crear las tablas de criterios: ejecuta supabase/02_criterios.sql en el SQL Editor de Supabase."
        : mensajeError(e));
    }
  }
  useEffect(() => { cargar(); }, [id]);

  const vista = useMemo(() => (texto.trim() ? parsearCriterios(texto) : null), [texto]);

  async function importar() {
    if (!vista) return;
    try {
      // Competencias: crea las que falten y actualiza la descripción si viene
      const porCodigo = new Map(d.competencias.map(c => [c.codigo, c]));
      const filasCE = vista.competencias.map((c, i) => ({ curso_id: id, codigo: c.codigo, descripcion: c.descripcion || porCodigo.get(c.codigo)?.descripcion || "", orden: c.numero ?? i }));
      const ces = filasCE.length ? await q(supabase.from("competencias").upsert(filasCE, { onConflict: "curso_id,codigo" }).select()) : [];
      const ceId = new Map([...d.competencias, ...ces].map(c => [c.codigo, c.id]));
      const existentes = new Map(d.criterios.map(c => [c.codigo, c]));
      const filasCr = vista.criterios.map((c, i) => ({
        curso_id: id, codigo: c.codigo, descripcion: c.descripcion || existentes.get(c.codigo)?.descripcion || "",
        competencia_id: ceId.get(`CE${c.competencia}`) || null, peso: existentes.get(c.codigo)?.peso ?? 1, orden: i,
      }));
      if (filasCr.length) await q(supabase.from("criterios").upsert(filasCr, { onConflict: "curso_id,codigo" }));
      setOk(`${filasCE.length} competencia(s) y ${filasCr.length} criterio(s) cargados`);
      setTexto(""); cargar();
    } catch (e) { setError(mensajeError(e)); }
  }

  async function guardar(tabla, fila, cambios) {
    try {
      await q(supabase.from(tabla).update(cambios).eq("id", fila));
      setD(x => ({ ...x, [tabla]: x[tabla].map(r => (r.id === fila ? { ...r, ...cambios } : r)) }));
    } catch (e) { setError(mensajeError(e)); }
  }

  async function borrar(tabla, fila) {
    try { await q(supabase.from(tabla).delete().eq("id", fila)); cargar(); } catch (e) { setError(mensajeError(e)); }
  }

  async function crearCriterio(e) {
    e.preventDefault();
    const m = nuevo.codigo.trim().match(/^(\d{1,2})\.(\d{1,2})$/);
    if (!m) { setError("Escribe el código del criterio como 2.2"); return; }
    const ceCod = `CE${Number(m[1])}`;
    try {
      let ce = d.competencias.find(c => c.codigo === ceCod);
      if (!ce) [ce] = await q(supabase.from("competencias").insert({ curso_id: id, codigo: ceCod, orden: Number(m[1]) }).select());
      await q(supabase.from("criterios").insert({ curso_id: id, codigo: `${Number(m[1])}.${Number(m[2])}`, descripcion: nuevo.descripcion.trim(), competencia_id: ce.id }));
      setNuevo({ codigo: "", descripcion: "" }); cargar();
    } catch (e2) { setError(e2?.code === "23505" ? "Ese criterio ya existe" : mensajeError(e2)); }
  }

  /** Cambia el peso de una herramienta en un criterio (null = su carga). */
  async function pesoHerramienta(cont, criterioId, peso) {
    const nuevos = enlaces(cont).map(e => (e.criterio_id === criterioId ? { ...e, peso } : e));
    try {
      await q(supabase.from("contenidos").update({ criterios: nuevos }).eq("id", cont.id));
      setD(x => ({ ...x, contenidos: x.contenidos.map(c => (c.id === cont.id ? { ...c, criterios: nuevos } : c)) }));
    } catch (e) { setError(mensajeError(e)); }
  }

  if (!d) return <><Aviso error={error} /><Cargando /></>;
  const { curso, competencias, criterios, contenidos } = d;
  const sinCE = criterios.filter(c => !c.competencia_id || !competencias.some(ce => ce.id === c.competencia_id));

  return (
    <>
      <Aviso error={error} onCerrar={() => setError("")} />
      <Link to={`/curso/${id}`} className="volver">‹ {curso.nombre}</Link>
      <h2>Criterios y competencias · {curso.nombre}</h2>
      <p className="muted" style={{ margin: 0 }}>Aquí ves qué herramientas evalúan cada criterio y cuánto pesan. Los criterios de cada herramienta se eligen en el propio contenido (Contenidos y pesos).</p>
      {ok && <p className="ok small" style={{ margin: 0 }}>{ok}</p>}

      {!criterios.length && (
        <div className="vacio"><p>Este curso aún no tiene criterios. Pégalos desde tu programación o el decreto en el recuadro de abajo.</p></div>
      )}

      {competencias.map(ce => {
        const crs = criterios.filter(c => c.competencia_id === ce.id);
        const sumaP = crs.reduce((a, c) => a + Number(c.peso || 0), 0);
        return (
          <section className="panel ce" key={ce.id}>
            <div className="fila">
              <span className="ce-codigo">{ce.codigo}</span>
              <CampoEditable valor={ce.descripcion} placeholder="Descripción de la competencia" style={{ flex: "1 1 240px" }}
                onGuardar={v => guardar("competencias", ce.id, { descripcion: v.trim() })} />
              {!crs.length && <BotonBorrar texto="Quitar" onConfirmar={() => borrar("competencias", ce.id)} />}
            </div>
            {crs.map(cr => {
              const usos = contenidos.flatMap(c => enlaces(c).filter(e => e.criterio_id === cr.id).map(e => ({ c, e })));
              const pctCE = sumaP ? (Number(cr.peso || 0) / sumaP) * 100 : 0;
              return (
                <div className="criterio" key={cr.id}>
                  <div className="criterio-cab">
                    <span className="cr-codigo">{cr.codigo}</span>
                    <CampoEditable valor={cr.descripcion} placeholder="Descripción del criterio" onGuardar={v => guardar("criterios", cr.id, { descripcion: v.trim() })} />
                    <label className="f en-linea" title="Peso del criterio dentro de su competencia">Peso
                      <CampoEditable valor={cr.peso} inputMode="decimal" style={{ width: 60 }} onGuardar={v => guardar("criterios", cr.id, { peso: Math.max(0, numero(v) ?? 1) })} />
                    </label>
                    <span className="pct-ce" title={`Cuenta un ${fmt(pctCE, 0)}% en ${ce.codigo}`}>{fmt(pctCE, 0)}% de {ce.codigo}</span>
                    <BotonBorrar texto="Quitar" confirmar="¿Quitar criterio?" onConfirmar={() => borrar("criterios", cr.id)} />
                  </div>
                  {usos.length ? (
                    <div className="usos">
                      {usos.map(({ c, e }) => (
                        <div className="uso" key={c.id}>
                          <span className="chip">{c.evaluacion}ª</span>
                          <span className="uso-nombre">{c.nombre}</span>
                          <span className="muted small">{fmt(Number(e.pct ?? 100), 0)}% de su nota</span>
                          <label className="f en-linea small" title="Peso de esta herramienta en el criterio. Vacío = su carga en la evaluación">peso
                            <CampoEditable valor={e.peso ?? ""} placeholder={fmt(Number(c.peso), 0)} inputMode="decimal" style={{ width: 64 }}
                              onGuardar={v => pesoHerramienta(c, cr.id, numero(v))} />
                          </label>
                          <span className="muted small">= {fmt(pesoEnCriterio(c, e), 1)}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="pista" style={{ margin: 0 }}>Ninguna herramienta evalúa este criterio todavía.</p>}
                </div>
              );
            })}
          </section>
        );
      })}

      {sinCE.length > 0 && (
        <section className="panel">
          <h3>Criterios sin competencia</h3>
          {sinCE.map(cr => <div className="fila" key={cr.id}><span className="cr-codigo">{cr.codigo}</span><span>{cr.descripcion}</span></div>)}
        </section>
      )}

      <div className="rejilla">
        <section className="panel">
          <h3>Pegar criterios</h3>
          <p className="pista" style={{ margin: 0 }}>Copia de tu programación o del decreto. Reconoce líneas como “CE1. …”, “Competencia específica 2. …”, “1.1 …” o “Criterio 2.3: …”. Si un criterio ya existe, se actualiza su descripción.</p>
          <textarea className="in" value={texto} onChange={e => setTexto(e.target.value)}
            placeholder={"CE1. Adoptar un estilo de vida activo y saludable…\n1.1 Planificar y desarrollar…\n1.2 Aplicar de forma autónoma…\nCE2. …\n2.1 …"} />
          {vista && (
            <p className="small" style={{ margin: 0 }}>
              Se van a cargar <b>{vista.competencias.length}</b> competencia(s) y <b>{vista.criterios.length}</b> criterio(s)
              {vista.criterios.length > 0 && <>: {vista.criterios.map(c => c.codigo).join(", ")}</>}
            </p>
          )}
          <div><button className="btn primario" disabled={!vista?.criterios.length && !vista?.competencias.length} onClick={importar}>Cargar</button></div>
        </section>

        <form className="panel" onSubmit={crearCriterio}>
          <h3>Añadir un criterio</h3>
          <div className="fila">
            <label className="f" style={{ flex: "0 1 90px" }}>Código
              <input className="in" value={nuevo.codigo} onChange={e => setNuevo({ ...nuevo, codigo: e.target.value })} placeholder="2.2" inputMode="decimal" />
            </label>
            <label className="f" style={{ flex: "1 1 200px" }}>Descripción
              <input className="in" value={nuevo.descripcion} onChange={e => setNuevo({ ...nuevo, descripcion: e.target.value })} />
            </label>
          </div>
          <div><button className="btn" type="submit">Añadir</button></div>
          <p className="pista" style={{ margin: 0 }}>La competencia se deduce del código: el 2.2 va a la CE2 (se crea si no existe).</p>
        </form>
      </div>
    </>
  );
}
