// Colores de los contenidos: 8 tonos (definidos en styles.css como --p1 … --p8).
export const N_COLORES = 8;

/** Color (1–8) de un contenido: el elegido a mano o uno automático según su posición en el curso. */
export function colorDe(c, todos) {
  if (c?.color >= 1 && c.color <= N_COLORES) return c.color;
  const i = Math.max(0, todos.findIndex(x => x.id === c.id));
  return (i % N_COLORES) + 1;
}

export const varColor = n => `var(--p${n})`;
