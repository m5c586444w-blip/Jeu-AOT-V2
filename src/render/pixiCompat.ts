/**
 * Dette n° 47 : en WebGL 1 (repli sans WebGL 2), Pixi 8 règle à la mise à jour d'un style de texture des paramètres propres à
 * WebGL 2 (`TEXTURE_COMPARE_MODE`, absent du contexte WebGL 1 : `undefined`) ; le pilote répond « INVALID_ENUM:
 * texParameter » à chaque fois. Garde locale : sur un contexte WebGL 1, un nom de paramètre inconnu est ignoré. Le rendu ne
 * change pas (le paramètre n'existe pas en WebGL 1). La garde est posée dès la création du contexte (canevas fourni à Pixi),
 * avant les premières textures.
 */
type TexParam = (target: number, pname: number, param: number) => void;

/** Garde un contexte WebGL 1 ; sans effet sur un contexte WebGL 2 ou un autre objet. Vrai si la garde est posée. */
export function guardContext(gl: unknown): boolean {
  if (!gl || typeof gl !== "object") return false;
  if (typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext) return false;
  const ctx = gl as Record<string, unknown>;
  if (typeof ctx["texParameteri"] !== "function") return false;
  for (const name of ["texParameteri", "texParameterf"] as const) {
    const orig = (ctx[name] as TexParam).bind(gl);
    const guarded: TexParam = (target, pname, param) => {
      if (typeof pname !== "number") return;
      orig(target, pname, param);
    };
    ctx[name] = guarded;
  }
  return true;
}

/** Canevas pour `Application.init({ canvas })` : tout contexte WebGL 1 qu'il rend est gardé. */
export function guardedCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const orig = canvas.getContext.bind(canvas) as (type: string, opts?: unknown) => unknown;
  const wrapped = (type: string, opts?: unknown): unknown => {
    const ctx = orig(type, opts);
    if (type === "webgl" || type === "experimental-webgl") guardContext(ctx);
    return ctx;
  };
  (canvas as unknown as { getContext: typeof wrapped }).getContext = wrapped;
  return canvas;
}
