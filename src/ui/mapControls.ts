import type { StrategicMap } from "../render/strategicMap";

export interface MapControlHandlers {
  hover(id: string | null, x: number, y: number): void;
  select(id: string | null): void;
  /** Clic sur un étendard d'armée (PA.8) ; true = consommé. */
  army?(id: string): boolean;
}

const DRAG_THRESHOLD = 4;

/** Souris sur la carte : glisser = déplacer, molette = zoom, survol = bulle, clic = dossier, double-clic = centrer (F-STR-03). */
export function attachMapControls(host: HTMLElement, map: StrategicMap, on: MapControlHandlers): void {
  const canvas = map.canvas;
  let drag: { x: number; y: number; moved: boolean } | null = null;
  const local = (ev: MouseEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [ev.clientX - r.left, ev.clientY - r.top];
  };

  canvas.addEventListener("pointerdown", (ev) => {
    if (ev.button !== 0) return;
    drag = { x: ev.clientX, y: ev.clientY, moved: false };
    canvas.setPointerCapture(ev.pointerId);
  });
  canvas.addEventListener("pointermove", (ev) => {
    if (drag) {
      const dx = ev.clientX - drag.x;
      const dy = ev.clientY - drag.y;
      if (drag.moved || Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        drag.moved = true;
        drag.x = ev.clientX;
        drag.y = ev.clientY;
        map.panBy(dx, dy);
        on.hover(null, 0, 0);
        return;
      }
    }
    const [x, y] = local(ev);
    const id = map.provinceAt(x, y);
    map.setHover(id);
    on.hover(id, ev.clientX, ev.clientY);
  });
  canvas.addEventListener("pointerup", (ev) => {
    const wasDrag = drag?.moved ?? false;
    drag = null;
    if (canvas.hasPointerCapture(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
    if (wasDrag) return;
    const [x, y] = local(ev);
    const army = map.armyAt(x, y);
    if (army && on.army?.(army)) return;
    const id = map.provinceAt(x, y);
    map.setSelected(id);
    on.select(id);
  });
  canvas.addEventListener("pointerleave", () => {
    map.setHover(null);
    on.hover(null, 0, 0);
  });
  canvas.addEventListener("dblclick", (ev) => {
    const [x, y] = local(ev);
    const id = map.provinceAt(x, y);
    if (id) map.centerOn(id);
  });
  host.addEventListener(
    "wheel",
    (ev) => {
      ev.preventDefault();
      const [x, y] = local(ev);
      map.zoomAt(x, y, Math.exp(-ev.deltaY * 0.0015));
    },
    { passive: false },
  );
}
