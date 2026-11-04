# EvaEfe

Cuaderno de evaluación de Educación Física: cursos → grupos → alumnos, contenidos con rúbricas o nota directa, notas por evaluación y final con redondeo de boletín.

- **Web:** GitHub Pages (gratis, despliegue automático en cada `git push`).
- **Datos:** Supabase (Postgres), región UE, con Row Level Security: cada usuario solo ve lo suyo.
- **Acceso:** con tu cuenta de Google.

> Los datos de alumnos **nunca** van en el repositorio. Solo están en Supabase.

---

## Puesta en marcha (unos 20 minutos, una sola vez)

### 1. Supabase

1. En [supabase.com](https://supabase.com) → **New project**.
   - Nombre: `evaefe`.
   - **Region: Central EU (Frankfurt)** o cualquier región de la UE.
   - Guarda la contraseña de la base de datos en un sitio seguro.
2. **SQL Editor → New query**: pega todo `supabase/schema.sql` y pulsa **Run**. Debe terminar sin errores.
3. **Project Settings → API**: copia
   - `Project URL` → será `VITE_SUPABASE_URL`
   - la clave `anon` / `public` → será `VITE_SUPABASE_ANON_KEY`
   - ⚠️ La clave `service_role` **no la uses nunca** en este proyecto.

### 2. Acceso con Google

1. En [console.cloud.google.com](https://console.cloud.google.com) crea un proyecto (`EvaEfe`).
2. **APIs y servicios → Pantalla de consentimiento de OAuth**: tipo *Externo*, nombre `EvaEfe`, tu correo como soporte y contacto. En *Usuarios de prueba* añade tu correo (o publica la app: con los permisos básicos no hace falta verificación).
3. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web**.
   - *URI de redireccionamiento autorizados*: `https://TU-PROYECTO.supabase.co/auth/v1/callback`
     (la URL exacta aparece en Supabase → Authentication → Providers → Google).
4. Copia el *ID de cliente* y el *Secreto* en **Supabase → Authentication → Providers → Google** y actívalo.
5. **Supabase → Authentication → URL Configuration**:
   - *Site URL*: `https://TU-USUARIO.github.io/EvaEfe/`
   - *Redirect URLs*: añade `https://TU-USUARIO.github.io/EvaEfe/` y `http://localhost:5173/`

### 3. GitHub

1. Crea el repositorio **EvaEfe** (público) y sube este proyecto:
   ```bash
   git init && git add . && git commit -m "EvaEfe: base"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/EvaEfe.git
   git push -u origin main
   ```
2. **Settings → Secrets and variables → Actions → New repository secret**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. **Actions → Publicar en GitHub Pages → Run workflow** (o haz cualquier `push`). En un par de minutos estará en `https://TU-USUARIO.github.io/EvaEfe/`.

### 4. Cerrar la puerta

1. Entra en la web con tu cuenta de Google una vez (así se crea tu usuario).
2. **Supabase → Authentication → Sign In / Providers → desactiva "Allow new users to sign up"**. Desde ese momento nadie más puede crearse una cuenta en tu proyecto.
3. Comprueba la seguridad: abre la web en una ventana de incógnito sin iniciar sesión → no debe verse nada. Y desde un terminal:
   ```bash
   curl "https://TU-PROYECTO.supabase.co/rest/v1/alumnos?select=*" -H "apikey: TU_CLAVE_ANON"
   ```
   Debe devolver un error de permisos o `[]`, **nunca** datos.

### 5. Que no se pause en vacaciones

El plan gratuito de Supabase pausa el proyecto tras 7 días sin actividad. El workflow `keepalive.yml` hace una consulta mínima cada 3 días usando los mismos secrets. Si alguna vez se pausara, se reactiva desde el panel de Supabase con los datos intactos.

---

## Trabajar en local

```bash
cp .env.example .env     # y rellena la URL y la clave anon
npm install
npm run dev              # http://localhost:5173
```

## Cómo calcula las notas

| Qué | Regla |
|---|---|
| Rúbrica | media ponderada de los ítems ÷ escala × 10 (con escala 0–5, todo a 3 = 6) |
| Nota directa | el número de 0 a 10 |
| Trabajo compensatorio | su nota sustituye a la del contenido y queda registrado con motivo y descripción |
| Exento | el contenido no cuenta y su peso se reparte entre los demás |
| NP | cuenta como 0 |
| Nota de evaluación | contenidos de esa evaluación × su peso (en proporción, no hace falta que sumen 100) |
| Nota final | media de las notas **reales** de las evaluaciones |
| Boletín | desde ,5 se sube; en Bachillerato además desde 9,25 es 10 (editable por curso) y se puede cambiar a mano por alumno |

## Estado

- [x] Acceso con Google, base de datos y seguridad
- [x] Cursos, grupos y alumnos (pegar lista desde Rayuela)
- [x] Contenidos por evaluación: rúbricas con ítems y pesos, nota directa, datos que solo se anotan, redondeo por curso
- [ ] Poner notas desde el móvil (botones 0–5, trabajo compensatorio, exento, NP)
- [ ] Tablas de 1ª, 2ª, 3ª y final con nota real y de boletín, ajustes manuales
- [ ] Exportar a Excel
- [ ] Estadísticas por grupo y curso
