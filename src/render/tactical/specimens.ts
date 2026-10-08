import { Application, Graphics } from "pixi.js";
import { PAPER } from "../palette";
import { drawFlare, drawSoldier, drawTitan } from "./figures";
import type { SoldierLook } from "./figures";

export const SOLDIER_LOOKS: readonly SoldierLook[] = ["eclaireur", "tueur", "soutien", "cavalier", "medecin", "chef", "officier", "ackerman"];
export const TITAN_SILHOUETTES = 10;
export const SPECIMEN_CELL = 118;
const C = SPECIMEN_CELL;

async function strip(host: HTMLElement, height: number, draw: (g: Graphics) => void): Promise<Application> {
  const app = new Application();
  await app.init({ width: C * 10, height, background: PAPER, antialias: true, preference: "webgl" });
  host.append(app.canvas);
  const g = new Graphics();
  app.stage.addChild(g);
  draw(g);
  return app;
}

/**
 * Planche de revue (AC4-13, 04 §2, §4), en trois bandes : les 10 silhouettes de Titans ; les 8 types de soldats ;
 * les états (rampant, membres coupés, abattu, soldat blessé sélectionné) et les trois fusées.
 * Dessinée avec les mêmes fonctions que la scène de bataille.
 */
export async function drawSpecimenSheet(hosts: [HTMLElement, HTMLElement, HTMLElement]): Promise<() => void> {
  const apps = [
    await strip(hosts[0], 200, (g) => {
      for (let i = 0; i < TITAN_SILHOUETTES; i++) drawTitan(g.context, C * i + C / 2, 190, 170, i, i % 2 ? -1 : 1, true, false, { armL: false, armR: false, legs: false });
    }),
    await strip(hosts[1], 90, (g) => {
      SOLDIER_LOOKS.forEach((look, i) => drawSoldier(g.context, C * (i + 1) + C / 2, 75, 18, look, true, false, false));
    }),
    await strip(hosts[2], 200, (g) => {
      drawTitan(g.context, C * 1.5, 190, 170, 3, 1, true, true, { armL: false, armR: false, legs: false });
      drawTitan(g.context, C * 2.5, 190, 170, 5, 1, true, false, { armL: true, armR: false, legs: true });
      drawTitan(g.context, C * 3.5, 150, 170, 2, 1, false, false, { armL: false, armR: false, legs: false });
      drawSoldier(g.context, C * 4.5, 160, 18, "tueur", false, true, true);
      drawFlare(g.context, C * 5.5, 190, 2.4, "rouge", 3);
      drawFlare(g.context, C * 6.5, 190, 2.4, "noir", 3);
      drawFlare(g.context, C * 7.5, 190, 2.4, "vert", 3);
    }),
  ];
  return () => {
    // `{ removeView: true }` et non `true` : `true` libère aussi les ressources globales de Pixi (réserve de lots), dont la
    // carte stratégique et la bataille se servent encore (« reading 'geometry' » au rendu suivant, dette n° 20).
    for (const a of apps) a.destroy({ removeView: true }, { children: true });
  };
}
