import { useEffect, useMemo, useState } from "react";
import { notaContenido, detalleRubrica, derechoRepetir, repeticion, asistenciaExamen, fmt } from "../../lib/calc.js";
import { BotonBorrar, CampoEditable, NombreLista, numero } from "../../components/ui.jsx";
import Diario from "./Diario.jsx";

const ESTADOS = [["normal", "Normal"], ["compensatorio", "Trabajo"], ["exento", "Exento"], ["np", "NP"]];

function leer(k) { try { return localStorage.getItem(k); } catch { return null; } }
function escribir(k, v) { try { localStorage.setItem(k, v); } catch { /* nada */ } }

export default function PonerNotas({ g }) {
  const { alumnos, contenidos, grupo } = g.d;
  const conContenido = ["1", "2", "3"].filter(e => contenidos.some(c => String(c.evaluacion) === e));
  const [ev, setEv] = useState(() => {
    const guardado = leer("evaefe-ev-" + grupo.curso_id);
    return conContenido.includes(guardado) ? guardado : conContenido[conContenido.length - 1];
  });
  const deEval = contenidos.filter(c => String(c.evaluacion) === ev);
  const [cid, setCid] = useState(() => leer("evaefe-cont-" + grupo.curso_id));
  const cont = deEval.find(c => c.id === cid) || deEval[0];
  useEffect(() => { if (cont) escribir("evaefe-cont-" + grupo.curso_id, cont.id); }, [cont, grupo.curso_id]);

  const [soloPendientes, setSoloPendientes] = useState(false);
  const cal = g.d.cal;
  const progreso = useMemo(() => cont ? alumnos.filter(a => notaContenido(cont, cal[a.id]?.[cont.id]).nota != null || cal[a.id]?.[cont.id]?.estado === "exento").length : 0, [alumnos, cal, cont]);
  const lista = soloPendientes && cont
    ? alumnos.filter(a => { const c = cal[a.id]?.[cont.id]; return !(notaContenido(cont, c).nota != null || c?.estado === "exento"); })
    : alumnos;

  return (
    <div className="bloque">
      <div className="selector-notas">
        <div className="seg" role="group" aria-label="Evaluación">
          {["1", "2", "3"].map(e => (
            <button key={e} type="button" aria-pressed={ev === e} disabled={!conContenido.includes(e)}
              onClick={() => { setEv(e); escribir("evaefe-ev-" + grupo.curso_id, e); }}>{e}ª Ev.</button>
          ))}
        </div>
        <select className="in" value={cont?.id || ""} onChange={e => setCid(e.target.value)} aria-label="Contenido">
          {deEval.map(c => <option key={c.id} value={c.id}>{c.nombre} · {fmt(Number(c.peso), 0)}%</option>)}
        </select>
      </div>

      {cont && (
        <div className={`terminar ${cont.terminado ? "hecho" : ""}`}>
          <span>{cont.terminado
            ? <><b>Terminado</b> en este grupo: quien no tenga nota cuenta 0.</>
            : <><b>En curso:</b> quien aún no tiene nota no cuenta en la media.</>}</span>
          <span className="espacio" />
          <button type="button" className={`btn sm ${cont.terminado ? "fantasma" : "primario"}`} onClick={() => g.alternarTerminado(cont.id)}>
            {cont.terminado ? "Reabrir" : "Dar por terminado"}
          </button>
        </div>
      )}

      {cont && cont.tipo !== "diario" && <PasarLista key={"pl" + cont.id} g={g} cont={cont} />}

      {cont?.tipo === "diario" && <Diario key={cont.id} g={g} cont={cont} />}

      {cont && cont.tipo !== "diario" && (
        <>
          <div className="fila small">
            <span className="muted">{cont.tipo === "nota" ? "Nota directa de 0 a 10" : `Rúbrica de ${cont.items.length} ítems, de 0 a ${fmt(Number(cont.escala_max), 0)}`}</span>
            <span className="espacio" />
            <span><b>{progreso}</b>/{alumnos.length} evaluados</span>
            <label className="check pequeno"><input type="checkbox" checked={soloPendientes} onChange={e => setSoloPendientes(e.target.checked)} /> Solo pendientes</label>
          </div>
          {cont.tipo === "rubrica" && !cont.items.length && (
            <div className="vacio"><p>Esta rúbrica no tiene ítems todavía. Añádelos en el curso para poder puntuar.</p></div>
          )}
          <div className="tarjetas-alumnos">
            {lista.map(a => (
              <TarjetaAlumno key={a.id + cont.id} alumno={a} n={alumnos.indexOf(a) + 1} cont={cont}
                calif={cal[a.id]?.[cont.id]} guardar={cambios => g.guardarCalif(a.id, cont.id, cambios)} />
            ))}
            {soloPendientes && !lista.length && <div className="vacio"><p>Todos los alumnos tienen nota en {cont.nombre}.</p></div>}
          </div>
        </>
      )}
    </div>
  );
}

function TarjetaAlumno({ alumno, n, cont, calif, guardar }) {
  const estado = calif?.estado || "normal";
  const r = notaContenido(cont, calif);
  const max = Math.floor(Number(cont.escala_max) || 5);
  const niveles = Array.from({ length: max + 1 }, (_, i) => i);
  const anot = Array.isArray(cont.anotaciones) ? cont.anotaciones : [];
  const extraIntentos = Array.isArray(calif?.intentos) ? calif.intentos : [];
  const [idx, setIdx] = useState(extraIntentos.length);
  const i = Math.min(idx, extraIntentos.length);
  const intento = i === 0 ? calif : extraIntentos[i - 1];
  const valores = intento?.valores || {};
  const notaActual = intento?.nota ?? null;
  const guardarIntento = cambios => (i === 0
    ? guardar(cambios)
    : guardar({ intentos: extraIntentos.map((x, j) => (j === i - 1 ? { ...x, ...cambios } : x)) }));
  const rep = repeticion(cont);
  const der = derechoRepetir(cont, calif);
  // Repetir solo cuando ya hizo el 1.er intento (o se le dio derecho a mano, p. ej. faltó con justificante)
  const hizoPrimero = r.intentos?.[0] != null;
  const puedeOtro = der.derecho && (hizoPrimero || der.manual) && extraIntentos.length < rep.intentos;
  const [editDerecho, setEditDerecho] = useState(false);
  const anotV = calif?.anotaciones || {};
  const comp = calif?.compensatorio || {};

  return (
    <article className={`tarjeta-alumno estado-${estado}`}>
      <header>
        <span className="num">{n}</span>
        <span className="nombre"><NombreLista nombre={alumno.nombre} /></span>
        <span className={`nota-chip ${r.nota != null && r.nota < 5 ? "suspenso" : ""}`}>
          {estado === "exento" ? "Exento" : r.nota == null ? "—" : fmt(r.nota)}
          {r.repitio && <sup className="marca rep" title="Ha repetido">R</sup>}
        </span>
      </header>
      {alumno.observaciones && <p className="obs-alumno">{alumno.observaciones}</p>}
      {(() => {
        const ae = asistenciaExamen(cont, calif);
        const f = calif?.extra?.asistencia?.fecha;
        const fc = f ? ` (${f.split("-").reverse().slice(0, 2).join("/")})` : "";
        if (ae === "pendiente") return <span className="chip asis pendiente">Vino{fc} · pendiente de evaluar</span>;
        if (ae === "falta") return <span className="chip asis falta">Faltó al examen{fc}</span>;
        return null;
      })()}

      <div className="estados" role="group" aria-label="Situación">
        {ESTADOS.map(([k, l]) => (
          <button key={k} type="button" aria-pressed={estado === k} onClick={() => guardar({ estado: k })}>{l}</button>
        ))}
      </div>

      {estado === "normal" && (rep.modo !== "no" || extraIntentos.length > 0) && (
        <div className="intentos">
          {extraIntentos.length > 0 && (
            <div className="intentos-tabs" role="group" aria-label="Intento">
              {[calif, ...extraIntentos].map((_, j) => (
                <button key={j} type="button" aria-pressed={i === j} onClick={() => setIdx(j)}>
                  {j + 1}.º <b>{r.intentos?.[j] == null ? "—" : fmt(r.intentos[j])}</b>{r.elegido === j && <span className="cuenta"> ✓</span>}
                </button>
              ))}
            </div>
          )}
          <div className="fila small">
            {puedeOtro && <button type="button" className="btn sm" onClick={() => { const hoy = new Date().toISOString().slice(0, 10); guardar({ intentos: [...extraIntentos, { valores: {}, nota: null, fecha: hoy }] }); setIdx(extraIntentos.length + 1); }}>Repetir ({extraIntentos.length + 2}.º intento)</button>}
            {!der.derecho && rep.modo !== "no" && <span className="chip sin-derecho">Sin derecho a repetir</span>}
            {der.manual && <span className="muted" title={der.motivo}>{der.derecho ? "Derecho dado a mano" : "Derecho quitado a mano"}{der.motivo ? `: ${der.motivo}` : ""}</span>}
            <span className="espacio" />
            <button type="button" className="btn sm fantasma" onClick={() => setEditDerecho(!editDerecho)}>{der.derecho ? "Quitar derecho" : "Dar derecho"}</button>
          </div>
          {editDerecho && (
            <div className="fila">
              <CampoEditable valor={der.motivo || ""} placeholder="Motivo (p. ej. justificante médico)" autoFocus style={{ flex: "1 1 200px" }}
                onGuardar={m => { guardar({ extra: { ...(calif?.extra || {}), derecho_repetir: { valor: !der.derecho, motivo: m.trim() } } }); setEditDerecho(false); }} />
              {der.manual && <button type="button" className="btn sm fantasma" onClick={() => { guardar({ extra: { ...(calif?.extra || {}), derecho_repetir: null } }); setEditDerecho(false); }}>Volver a la regla</button>}
            </div>
          )}
          {extraIntentos.length > 0 && (
            <div className="fila small">
              <label className="f en-linea">Cuenta
                <select className="in" style={{ width: "auto", minHeight: 34 }} value={calif?.extra?.intento_elegido ?? ""}
                  onChange={e => guardar({ extra: { ...(calif?.extra || {}), intento_elegido: e.target.value === "" ? null : Number(e.target.value) } })}>
                  <option value="">{{ mejor: "La mejor", ultima: "El último", media: "La media" }[rep.cuenta]} (regla)</option>
                  {[calif, ...extraIntentos].map((_, j) => <option key={j} value={j}>{j + 1}.º intento</option>)}
                </select>
              </label>
              <span className="espacio" />
              {i > 0 && <BotonBorrar texto={`Borrar ${i + 1}.º intento`} confirmar="¿Borrar este intento?" onConfirmar={() => {
                const resto = extraIntentos.filter((_, j) => j !== i - 1);
                const ex = { ...(calif?.extra || {}) };
                if (ex.intento_elegido != null && ex.intento_elegido >= i) ex.intento_elegido = null;
                guardar({ intentos: resto, extra: ex }); setIdx(Math.max(0, i - 1));
              }} />}
            </div>
          )}
          {extraIntentos[i - 1]?.fecha && <p className="pista" style={{ margin: 0 }}>{i + 1}.º intento · {extraIntentos[i - 1].fecha.split("-").reverse().join("/")}</p>}
        </div>
      )}

      {estado === "normal" && cont.tipo === "rubrica" && cont.items.map(it => (it.tipo === "suma" || it.tipo === "resta") ? (
        <div className={`item-nota contador ${it.tipo}`} key={it.id}>
          <span className="item-nombre">{it.nombre} <span className="muted">({it.tipo === "suma" ? "+" : "−"}{fmt(Number(it.puntos ?? 0.5), 2)} por vez)</span></span>
          <div className="contador-ctrl">
            <button type="button" aria-label={`Quitar una vez: ${it.nombre}`} disabled={!valores[it.id]}
              onClick={() => { const nv = { ...valores }; const n = (nv[it.id] || 0) - 1; if (n > 0) nv[it.id] = n; else delete nv[it.id]; guardarIntento({ valores: nv }); }}>−</button>
            <span className="veces" aria-live="polite">{valores[it.id] || 0}</span>
            <button type="button" aria-label={`Añadir una vez: ${it.nombre}`}
              onClick={() => guardarIntento({ valores: { ...valores, [it.id]: (valores[it.id] || 0) + 1 } })}>+</button>
            {valores[it.id] > 0 && <span className={`efecto ${it.tipo}`}>{it.tipo === "suma" ? "+" : "−"}{fmt(valores[it.id] * Number(it.puntos ?? 0.5), 2)}</span>}
          </div>
        </div>
      ) : (
        <div className="item-nota" key={it.id}>
          <span className="item-nombre">{it.nombre}</span>
          <div className="niveles" role="group" aria-label={it.nombre}>
            {niveles.map(v => (
              <button key={v} type="button" aria-pressed={valores[it.id] === v}
                onClick={() => {
                  const nv = { ...valores };
                  if (nv[it.id] === v) delete nv[it.id]; else nv[it.id] = v;
                  guardarIntento({ valores: nv });
                }}>{v}</button>
            ))}
          </div>
        </div>
      ))}

      {estado === "normal" && cont.tipo === "rubrica" && (() => {
        const dr = detalleRubrica(cont.items, valores, Number(cont.escala_max ?? 5));
        if (dr.base == null || !dr.ajuste) return null;
        return <p className="pista" style={{ margin: 0 }}>Rúbrica {fmt(dr.base)} {dr.ajuste > 0 ? "+" : "−"} {fmt(Math.abs(dr.ajuste))} = {fmt(dr.sinTope)}{(dr.sinTope > 10 || dr.sinTope < 0) && ` → se queda en ${fmt(dr.nota)}`}</p>;
      })()}

      {estado === "normal" && cont.tipo === "nota" && (
        <label className="f en-linea nota-directa">Nota
          <CampoEditable valor={notaActual == null ? "" : String(notaActual).replace(".", ",")} inputMode="decimal" placeholder="0–10"
            onGuardar={v => { const x = numero(v); if (x == null || (x >= 0 && x <= 10)) guardarIntento({ nota: x }); }} />
        </label>
      )}

      {estado === "compensatorio" && (
        <div className="compensatorio">
          <div className="fila">
            <label className="f" style={{ flex: "0 1 100px" }}>Nota del trabajo
              <CampoEditable valor={comp.nota == null ? "" : String(comp.nota).replace(".", ",")} inputMode="decimal" placeholder="0–10"
                onGuardar={v => { const x = numero(v); if (x == null || (x >= 0 && x <= 10)) guardar({ compensatorio: { ...comp, nota: x } }); }} />
            </label>
            <label className="f" style={{ flex: "0 1 150px" }}>Fecha
              <CampoEditable tipo="date" valor={comp.fecha || ""} onGuardar={v => guardar({ compensatorio: { ...comp, fecha: v } })} />
            </label>
          </div>
          <label className="f">Motivo
            <CampoEditable valor={comp.motivo || ""} placeholder="Lesión de tobillo" onGuardar={v => guardar({ compensatorio: { ...comp, motivo: v.trim() } })} />
          </label>
          <label className="f">Trabajo
            <CampoEditable valor={comp.descripcion || ""} placeholder="Trabajo escrito sobre el reglamento" onGuardar={v => guardar({ compensatorio: { ...comp, descripcion: v.trim() } })} />
          </label>
        </div>
      )}

      {estado === "exento" && <p className="muted small" style={{ margin: 0 }}>Este contenido no cuenta para su nota; su peso se reparte entre los demás.</p>}
      {estado === "np" && <p className="muted small" style={{ margin: 0 }}>No presentado: cuenta como 0.</p>}

      {anot.length > 0 && estado !== "exento" && (
        <div className="anotaciones">
          {anot.map(a => (
            <div className="anot" key={a.id}>
              <span className="muted small">{a.nombre}</span>
              {a.opciones?.length ? (
                <div className="opciones">
                  {a.opciones.map(o => (
                    <button key={o} type="button" aria-pressed={anotV[a.id] === o}
                      onClick={() => guardar({ anotaciones: { ...anotV, [a.id]: anotV[a.id] === o ? undefined : o } })}>{o}</button>
                  ))}
                </div>
              ) : (
                <CampoEditable valor={anotV[a.id] || ""} onGuardar={v => guardar({ anotaciones: { ...anotV, [a.id]: v.trim() } })} />
              )}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

const hoyISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

/** Lista del día del examen: quién vino (aunque no dé tiempo a evaluarlo) y quién faltó. */
function PasarLista({ g, cont }) {
  const { alumnos, cal } = g.d;
  const [abierta, setAbierta] = useState(false);
  const [fecha, setFecha] = useState(hoyISO());
  const marca = a => cal[a.id]?.[cont.id]?.extra?.asistencia;
  const poner = (a, valor) => {
    const c = cal[a.id]?.[cont.id];
    const extra = { ...(c?.extra || {}) };
    if (extra.asistencia?.valor === valor) extra.asistencia = null; else extra.asistencia = { valor, fecha };
    g.guardarCalif(a.id, cont.id, { extra });
  };
  const n = { vino: 0, falta: 0, pendiente: 0 };
  for (const a of alumnos) {
    const v = marca(a)?.valor; if (v) n[v]++;
    if (asistenciaExamen(cont, cal[a.id]?.[cont.id]) === "pendiente") n.pendiente++;
  }
  const sinMarca = alumnos.filter(a => !marca(a) && cal[a.id]?.[cont.id]?.estado !== "exento" && asistenciaExamen(cont, cal[a.id]?.[cont.id]) !== "evaluado");

  return (
    <div className="pasar-lista">
      <div className="fila">
        <button type="button" className="btn sm" aria-expanded={abierta} onClick={() => setAbierta(!abierta)}>{abierta ? "Cerrar lista" : "Pasar lista del examen"}</button>
        <span className="small muted">{n.vino} vinieron · {n.falta} faltaron{n.pendiente ? <> · <b className="ambar">{n.pendiente} pendientes de evaluar</b></> : ""}</span>
      </div>
      {abierta && (
        <div className="lista-examen">
          <div className="fila">
            <label className="f en-linea">Día<input type="date" className="in" style={{ width: "auto" }} value={fecha} onChange={e => setFecha(e.target.value || hoyISO())} /></label>
            <span className="espacio" />
            {sinMarca.length > 0 && <button type="button" className="btn sm primario" onClick={() => sinMarca.forEach(a => poner(a, "vino"))}>Todos vinieron ({sinMarca.length})</button>}
          </div>
          {alumnos.map(a => {
            const m = marca(a)?.valor;
            return (
              <div className="fila-lista" key={a.id}>
                <span className="nombre"><NombreLista nombre={a.nombre} /></span>
                <div className="vino-falta" role="group" aria-label={a.nombre}>
                  <button type="button" aria-pressed={m === "vino"} className="vino" onClick={() => poner(a, "vino")}>Vino</button>
                  <button type="button" aria-pressed={m === "falta"} className="falta" onClick={() => poner(a, "falta")}>No vino</button>
                </div>
              </div>
            );
          })}
          <p className="pista" style={{ margin: 0 }}>Quien vino y aún no tiene nota queda como pendiente de evaluar y conserva su derecho a repetir. Quien no vino no tiene derecho (salvo que se lo des a mano) y cuenta 0 al dar el contenido por terminado.</p>
        </div>
      )}
    </div>
  );
}
