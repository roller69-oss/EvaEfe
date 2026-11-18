// Lee en el navegador un listado de alumnos (Excel, OpenOffice o CSV exportado de Rayuela).
// Nada sale del ordenador hasta que se confirma la importación.

/** Devuelve { filas: string[][], columnas: [{indice, titulo, muestra}], sugerida } */
export async function leerListado(file) {
  const filas = await leerFilas(file);
  return { filas, ...detectarColumna(filas) };
}

/** Lee la primera hoja de un Excel/ODS/CSV como filas de texto. */
export async function leerFilas(file) {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  let wb;
  if (/\.(csv|txt)$/i.test(file.name)) {
    // Rayuela suele exportar el CSV en Windows-1252: si UTF-8 da caracteres rotos, se usa ese
    let txt = new TextDecoder("utf-8").decode(buf);
    if (txt.includes("�")) txt = new TextDecoder("windows-1252").decode(buf);
    wb = XLSX.read(txt, { type: "string" });
  } else {
    wb = XLSX.read(buf, { type: "array" });
  }
  const hoja = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false, defval: "" })
    .map(r => r.map(c => String(c ?? "").replace(/\s+/g, " ").trim()));
}

const pareceNombre = s => /^[\p{L}][\p{L} .'’-]*,\s*[\p{L}][\p{L} .'’-]*$/u.test(s);

/** Busca la columna con más celdas tipo "Apellidos, Nombre" y la fila de cabecera. */
export function detectarColumna(filas) {
  const ancho = Math.max(0, ...filas.map(r => r.length));
  const columnas = [];
  for (let i = 0; i < ancho; i++) {
    const celdas = filas.map(r => r[i] || "").filter(Boolean);
    const puntos = celdas.filter(pareceNombre).length;
    const cab = filas.find(r => /alumn|nombre/i.test(r[i] || "") && !/^mis /i.test(r[i]) && r[i].length < 30)?.[i] || "";
    columnas.push({ indice: i, titulo: cab || `Columna ${String.fromCharCode(65 + (i % 26))}`, puntos, muestra: celdas.find(pareceNombre) || celdas[0] || "" });
  }
  const sugerida = [...columnas].sort((a, b) => b.puntos - a.puntos)[0]?.indice ?? 0;
  return { columnas: columnas.filter(c => c.muestra), sugerida };
}

/** Nombres de una columna, sin cabeceras, títulos ni filas vacías. */
export function nombresDeColumna(filas, indice) {
  const vistos = new Set();
  const out = [];
  for (const r of filas) {
    const s = (r[indice] || "").trim();
    if (!s || !/\p{L}/u.test(s)) continue;
    if (/^(alumn|nombre|apellido|mis alumnos)/i.test(s)) continue;
    if (s.length > 80) continue;
    const k = normalizar(s);
    if (vistos.has(k)) continue;
    vistos.add(k); out.push(s);
  }
  return out;
}

export const normalizar = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/* ---------- Resultados de un cuestionario del aula virtual (Moodle) ---------- */

/**
 * Busca la cabecera con "Apellido(s)", "Nombre" y "Calificación/X" y devuelve
 * [{ apellidos, nombre, nota (sobre 10) | null, estado }]. Ignora correos, tiempos, preguntas y el promedio.
 */
export function leerResultadosAula(filas) {
  const iCab = filas.findIndex(r => r.some(c => /^apellido/i.test(c)) && r.some(c => /^nombre$/i.test(c)) && r.some(c => /^calificaci[oó]n/i.test(c)));
  if (iCab < 0) throw new Error("cabecera");
  const cab = filas[iCab];
  const iApe = cab.findIndex(c => /^apellido/i.test(c));
  const iNom = cab.findIndex(c => /^nombre$/i.test(c));
  const iCal = cab.findIndex(c => /^calificaci[oó]n/i.test(c));
  const iEst = cab.findIndex(c => /^estado$/i.test(c));
  const m = cab[iCal].match(/\/\s*([\d.,]+)/);
  const escala = m ? Number(m[1].replace(/\.(?=\d{3}\b)/g, "").replace(",", ".")) : 10;
  const out = [];
  for (const r of filas.slice(iCab + 1)) {
    const apellidos = (r[iApe] || "").trim(), nombre = (r[iNom] || "").trim();
    if (!apellidos && !nombre) continue;
    if (/promedio/i.test(apellidos)) continue;
    const bruto = (r[iCal] || "").trim();
    const n = /^[\d.,]+$/.test(bruto) ? Number(bruto.replace(",", ".")) : null;
    const nota = n == null || Number.isNaN(n) || !escala ? null : Math.max(0, Math.min(10, (n / escala) * 10));
    out.push({ apellidos, nombre, nota: nota == null ? null : Math.round(nota * 100) / 100, estado: iEst >= 0 ? r[iEst] || "" : "" });
  }
  return { filas: out, escala };
}

const tokens = t => normalizar(t).replace(/[^a-z0-9ñ ]/g, " ").split(" ").filter(x => x.length > 1);

/** Empareja una persona del archivo con un alumno del grupo ("Apellidos, Nombre"). Devuelve el alumno o null. */
export function emparejar(fila, alumnos) {
  const clave = normalizar(`${fila.apellidos} ${fila.nombre}`);
  const exacto = alumnos.filter(a => {
    const i = a.nombre.lastIndexOf(",");
    const k = i < 0 ? normalizar(a.nombre) : normalizar(`${a.nombre.slice(0, i)} ${a.nombre.slice(i + 1)}`);
    return k === clave;
  });
  if (exacto.length === 1) return exacto[0];
  // Si no coincide exacto: todas las palabras del archivo están en el nombre del alumno (o al revés), y solo hay uno así
  const tf = tokens(`${fila.apellidos} ${fila.nombre}`);
  const cand = alumnos.filter(a => { const ta = tokens(a.nombre); return tf.every(t => ta.includes(t)) || ta.every(t => tf.includes(t)); });
  return cand.length === 1 ? cand[0] : null;
}
