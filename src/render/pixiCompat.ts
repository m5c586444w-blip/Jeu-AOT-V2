/**
 * Dette n° 47 : en WebGL 1 (repli sans WebGL 2), Pixi 8 règle à la mise à jour d'un style de texture des paramètres propres à
 * WebGL 2 (`TEXTURE_COMPARE_MODE`, absent du contexte WebGL 1 : `undefined`) ; le pilote répond « INVALID_ENUM:
 * texParameter » à chaque fois. Garde locale : sur un contexte WebGL 1, un nom de paramètre inconnu est ignoré. Le rendu ne
 * change pas (le paramètre n'existe pas en WebGL 1).
 */
type TexParam = (target: number, pname: number, param: number) => void;

export function guardWebGl1(renderer: unknown): boolean {
  const gl = (renderer as { gl?: WebGLRenderingContext | WebGL2RenderingContext } | null)?.gl;
  if (!gl || (typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext)) return false;
  for (const name of ["texParameteri", "texParameterf"] as const) {
    const orig = (gl[name] as TexParam).bind(gl);
    const guarded: TexParam = (target, pname, param) => {
      if (typeof pname !== "number") return;
      orig(target, pname, param);
    };
    (gl as unknown as Record<string, TexParam>)[name] = guarded;
  }
  return true;
}
