/**
 * One palette for every sprite.
 *
 * Sharing a single char->colour map across all the art is what makes the app
 * look like one system rather than twenty unrelated drawings. Each character
 * has a fixed meaning everywhere: `s` is always skin, `c` is always the shirt,
 * `o` is always the outline.
 *
 * `.` is transparent and is never listed here.
 */
export const PALETTE: Readonly<Record<string, string>> = {
  // Structure
  o: '#151821', // outline, near-black
  k: '#2a2f3a', // dark slate — screens, shadow shapes
  a: '#8d99ae', // cool grey accent
  w: '#ffffff', // pure white highlight
  W: '#d7dee8', // soft white

  // Figure
  s: '#f2c199', // skin
  S: '#cf9468', // skin shadow
  h: '#4a3527', // hair
  H: '#33241a', // hair shadow
  c: '#5b8dd6', // shirt
  C: '#3d6aa8', // shirt shadow
  p: '#39414f', // trousers
  P: '#272d38', // trousers shadow

  // Water
  g: '#9fdcf5', // glass
  G: '#5fa8c7', // glass shadow
  b: '#2f9fd8', // water
  B: '#1b6fa0', // water shadow
  l: '#7fd4f5', // water surface highlight

  // Signals
  y: '#ffd166', // energy / highlight
  Y: '#e0a800', // energy shadow
  r: '#ef6f6c', // strain / accent red
  n: '#6bbf59', // green — plants, success
  N: '#3f8f38', // green shadow
  m: '#c98b5e', // terracotta (pot)
  M: '#a06a44', // terracotta shadow
  d: '#7a5942', // desk
  D: '#553b2b', // desk shadow
};
