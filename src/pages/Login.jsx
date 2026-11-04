import { useState } from "react";
import { supabase, mensajeError } from "../lib/supabase.js";

export default function Login() {
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function entrar() {
    setCargando(true); setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) { setError(mensajeError(error)); setCargando(false); }
  }

  return (
    <main className="wrap centro">
      <div className="login">
        <svg width="56" height="56" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" fill="var(--azul)" /><path d="M7 12.5l3 3 7-7" fill="none" stroke="var(--superficie)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <h1>EvaEfe</h1>
        <p className="muted">Cuaderno de evaluación de Educación Física</p>
        <button className="btn primario grande" onClick={entrar} disabled={cargando}>
          {cargando ? "Abriendo Google…" : "Entrar con Google"}
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    </main>
  );
}
