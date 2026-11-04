import { useEffect, useRef, useState } from "react";

/** Input que guarda al salir del campo o pulsar Intro, solo si cambió. */
export function CampoEditable({ valor, onGuardar, className = "in", tipo = "text", ...rest }) {
  const [v, setV] = useState(valor ?? "");
  useEffect(() => setV(valor ?? ""), [valor]);
  const guardar = () => { if (String(v) !== String(valor ?? "")) onGuardar(v); };
  return (
    <input
      {...rest}
      type={tipo}
      className={className}
      value={v}
      onChange={e => setV(e.target.value)}
      onBlur={guardar}
      onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setV(valor ?? ""); } }}
    />
  );
}

/** Botón de borrado en dos pulsaciones (sin diálogos del navegador). */
export function BotonBorrar({ onConfirmar, texto = "Borrar", confirmar = "¿Seguro?", className = "" }) {
  const [armado, setArmado] = useState(false);
  const t = useRef();
  useEffect(() => () => clearTimeout(t.current), []);
  return (
    <button
      type="button"
      className={`btn sm peligro ${armado ? "armado" : ""} ${className}`}
      onClick={() => {
        if (armado) { setArmado(false); onConfirmar(); return; }
        setArmado(true); clearTimeout(t.current); t.current = setTimeout(() => setArmado(false), 4000);
      }}
    >{armado ? confirmar : texto}</button>
  );
}

export function Aviso({ error, onCerrar }) {
  if (!error) return null;
  return <div className="aviso" role="alert"><span>{error}</span>{onCerrar && <button className="btn sm fantasma" onClick={onCerrar}>Cerrar</button>}</div>;
}

export function Cargando() {
  return <p className="muted">Cargando…</p>;
}

/** Convierte "9,25" o "9.25" en número; devuelve null si está vacío. */
export function numero(v) {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isNaN(n) ? null : n;
}
