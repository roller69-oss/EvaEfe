import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configurado = Boolean(url && key);

export const supabase = configurado
  ? createClient(url, key, {
      auth: {
        // PKCE devuelve ?code= en la URL y no choca con el enrutado por # de la app
        flowType: "pkce",
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

/** Lanza el error de Supabase como excepción para usar try/catch. */
export async function q(promesa) {
  const { data, error } = await promesa;
  if (error) throw error;
  return data;
}

export function mensajeError(e) {
  if (!e) return "";
  if (e.message?.includes("Failed to fetch")) return "Sin conexión con el servidor. Comprueba los datos móviles o el wifi.";
  if (e.code === "42501") return "No tienes permiso para esa operación. Vuelve a iniciar sesión.";
  return e.message || String(e);
}
