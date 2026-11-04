import { useEffect, useState } from "react";
import { Routes, Route, Link } from "react-router-dom";
import { supabase, configurado } from "./lib/supabase.js";
import Login from "./pages/Login.jsx";
import Inicio from "./pages/Inicio.jsx";
import Curso from "./pages/Curso.jsx";
import Grupo from "./pages/Grupo.jsx";

export default function App() {
  const [sesion, setSesion] = useState(undefined); // undefined = comprobando

  useEffect(() => {
    if (!configurado) return;
    supabase.auth.getSession().then(({ data }) => setSesion(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSesion(s);
      // limpia el ?code= que deja el inicio de sesión con Google
      if (s && window.location.search.includes("code=")) {
        window.history.replaceState(null, "", window.location.pathname + window.location.hash);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!configurado) {
    return (
      <main className="wrap centro">
        <div className="panel" style={{ maxWidth: 520 }}>
          <h2>Falta configurar Supabase</h2>
          <p>No se han encontrado <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>.</p>
          <p className="muted">En local, crea el archivo <code>.env</code> a partir de <code>.env.example</code>. En GitHub, añádelos como <em>secrets</em> del repositorio (lo explica el README).</p>
        </div>
      </main>
    );
  }
  if (sesion === undefined) return <main className="wrap centro"><p className="muted">Cargando…</p></main>;
  if (!sesion) return <Login />;

  return (
    <>
      <header className="cabecera">
        <div className="wrap barra">
          <Link to="/" className="marca" aria-label="EvaEfe, inicio">
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" fill="var(--azul)" /><path d="M7 12.5l3 3 7-7" fill="none" stroke="var(--superficie)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            EvaEfe
          </Link>
          <span className="espacio" />
          <span className="muted small usuario">{sesion.user.email}</span>
          <button className="btn sm fantasma" onClick={() => supabase.auth.signOut()}>Salir</button>
        </div>
      </header>
      <main className="wrap contenido">
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/curso/:id" element={<Curso />} />
          <Route path="/grupo/:id" element={<Grupo />} />
          <Route path="*" element={<Inicio />} />
        </Routes>
      </main>
    </>
  );
}
