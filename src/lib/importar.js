// Lee en el navegador un listado de alumnos (Excel, OpenOffice o CSV exportado de Rayuela).
// Nada sale del ordenador hasta que se confirma la importación.

/** Devuelve { filas: string[][], columnas: [{indice, titulo, muestra}], sugerida } */
export async function leerListado(file) {
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
  const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false, defval: "" })
    .map(r => r.map(c => String(c ?? "").replace(/\s+/g, " ").trim()));
  return { filas, ...detectarColumna(filas) };
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
