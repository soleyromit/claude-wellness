/**
 * One palette for every sprite.
 *
 * Sharing a single char->colour map across all the art is what makes the app
 * look like one system rather than twenty unrelated drawings. Each character
 * has a fixed meaning everywhere: `s` is always mid skin, `c` is always the
 * shirt, `o` is always the outline.
 *
 * **Materials are ramps, not single colours.** Every surface gets an outline,
 * a shadow, a mid tone and a highlight, because that is the difference between
 * pixel art that reads as a drawn object and pixel art that reads as coloured
 * blocks. Detail at this size comes almost entirely from tonal steps — there
 * are not enough pixels for it to come from anywhere else.
 *
 * Convention, so the ramps stay memorable:
 *   lowercase = mid tone      UPPERCASE = shadow
 *   digit     = highlight     `o`/`k`   = outline and deep shade
 *
 * `.` is transparent and is never listed here.
 */
export const PALETTE: Readonly<Record<string, string>> = {
  // ---------------------------------------------------------------- structure
  o: '#12151b', // outline, near-black
  k: '#232833', // deep shade
  a: '#8d99ae', // cool grey accent
  A: '#5c6779', // grey shadow
  w: '#ffffff', // pure white highlight
  W: '#d7dee8', // soft white

  // -------------------------------------------------------------------- skin
  '1': '#ffd9b8', // skin highlight
  s: '#f2c199', // skin mid
  S: '#cf9468', // skin shadow
  '2': '#a06b45', // skin deep shadow

  // -------------------------------------------------------------------- hair
  h: '#5a4030', // hair mid
  H: '#33241a', // hair shadow
  '3': '#7d5a42', // hair highlight

  // ------------------------------------------------------------------ clothes
  '4': '#7fb0e8', // shirt highlight
  c: '#5b8dd6', // shirt mid
  C: '#3d6aa8', // shirt shadow
  '5': '#2a4d7d', // shirt deep

  p: '#39414f', // trousers mid
  P: '#272d38', // trousers shadow
  '6': '#4d5768', // trousers highlight

  // ------------------------------------------------------------------- plants
  '7': '#8fd97a', // leaf highlight
  n: '#6bbf59', // leaf mid
  N: '#4a8f3f', // leaf shadow
  '8': '#2f6329', // leaf deep
  e: '#c9e88a', // pale spine / bloom centre

  // Wilting and dead ramps. A neglected plant yellows and then browns; simply
  // darkening the healthy green turns it into a silhouette, which reads as
  // "unlit" rather than "unwell".
  f: '#b3bd6e', // wilted highlight, yellow-green
  F: '#8a9450', // wilted mid
  v: '#5f6a38', // wilted shadow
  V: '#3d4526', // wilted deep

  u: '#9c8a63', // dead highlight, dry brown
  U: '#75664a', // dead mid
  z: '#4a4030', // dead shadow

  // -------------------------------------------------------------------- water
  g: '#bde8fa', // glass highlight
  G: '#5fa8c7', // glass shadow
  l: '#7fd4f5', // water surface
  b: '#2f9fd8', // water mid
  B: '#1b6fa0', // water deep

  // ----------------------------------------------------------------- terracotta
  '9': '#e2a878', // pot highlight
  m: '#c98b5e', // pot mid
  M: '#a06a44', // pot shadow
  '0': '#7d4f30', // pot deep
  d: '#6b4a33', // soil
  D: '#4a3122', // soil shadow

  // ------------------------------------------------------------------ signals
  y: '#ffd166', // energy / highlight
  Y: '#c99b1f', // energy shadow
  r: '#ef6f6c', // strain / accent red
  R: '#b8433f', // strain shadow
};
