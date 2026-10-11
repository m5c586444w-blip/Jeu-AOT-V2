import { Color } from "three";
import { PRESETS } from "../lighting";

/**
 * Dettes n° 70 et 72 : heure et pluie de la bataille 3D (04 §4 : « ambiance lumineuse (aube, jour, crépuscule, nuit) »).
 * Rendu seul : la nuit vient de la bataille (`setup.night`, règles de vision) ; l'aube, le crépuscule et la pluie sont des
 * choix d'affichage de la bataille, sans effet sur la simulation. Teintes et direction de l'astre reprises des heures de
 * l'essai 3D (`lighting.ts`), ramenées aux intensités de la bataille ; pluie : ciel bas et gris, brume rapprochée, soleil voilé
 * (multiplicateurs de la météo de R1b). Valeurs : choix de rendu (A).
 */
export type BattleLight = "jour" | "aube" | "crepuscule";
export const BATTLE_LIGHTS: readonly BattleLight[] = ["jour", "aube", "crepuscule"];

export interface BattleAmbiance {
  /** Fond et brouillard (même teinte : l'horizon se fond dans la brume). */
  sky: number;
  fogNear: number;
  fogFar: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  sunColor: number;
  sunIntensity: number;
  exposure: number;
  /** Position de l'astre rapportée au centre de la carte (m ; x vers l'est, z vers le sud, la carte ayant le nord en haut). */
  sunOffset: [number, number, number];
  /** Fenêtres allumées (intensité d'émission des façades). */
  windows: number;
  rain: boolean;
}

/** Soleil de la bataille de jour (matin, sud-est) ; distance au centre gardée pour les autres heures. */
const DAY_SUN: [number, number, number] = [260, 420, 180];
const SUN_DIST = Math.hypot(...DAY_SUN);
/** Intensités de la bataille de jour rapportées à celles de l'heure « jour » de l'essai 3D. */
const SUN_K = 2.4 / PRESETS.jour.sunIntensity;
const HEMI_K = 1.5 / PRESETS.jour.hemiIntensity;
/** Pluie (A) : brume rapprochée, soleil voilé (météo de R1b), ciel gris. */
const RAIN_FOG = 1.9;
const RAIN_SUN = 0.3;
const RAIN_SKY = 0x7f878d;

const mix = (a: number, b: number, k: number): number => new Color(a).lerp(new Color(b), k).getHex();

/** Astre à une élévation et un azimut donnés (degrés ; azimut 0 = nord, 90 = est), à la distance du soleil de jour. */
export function sunOffsetFor(elevationDeg: number, azimuthDeg: number): [number, number, number] {
  const e = (elevationDeg * Math.PI) / 180;
  const a = (azimuthDeg * Math.PI) / 180;
  return [SUN_DIST * Math.sin(a) * Math.cos(e), SUN_DIST * Math.sin(e), -SUN_DIST * Math.cos(a) * Math.cos(e)];
}

export function battleAmbiance(light: BattleLight, night: boolean, rain: boolean): BattleAmbiance {
  let a: BattleAmbiance;
  if (night) {
    a = { sky: 0x1b2333, fogNear: 120, fogFar: 700, hemiSky: 0x46557a, hemiGround: 0x1c1a14, hemiIntensity: 0.5, sunColor: 0x9fb1d6, sunIntensity: 0.5, exposure: 0.7, sunOffset: [...DAY_SUN], windows: 0.85, rain };
  } else if (light === "jour") {
    a = { sky: 0xaebfcc, fogNear: 450, fogFar: 2200, hemiSky: 0xdfe8f0, hemiGround: 0x6b6350, hemiIntensity: 1.5, sunColor: 0xfff1dc, sunIntensity: 2.4, exposure: 1.05, sunOffset: [...DAY_SUN], windows: 0, rain };
  } else {
    const p = PRESETS[light];
    a = {
      sky: mix(p.fog, p.horizon, 0.4),
      fogNear: 320,
      fogFar: 1700,
      hemiSky: p.hemiSky,
      hemiGround: p.hemiGround,
      // Astre bas : le sol ne reçoit presque plus le soleil ; le ciel (hémisphère) éclaire davantage pour garder la bataille
      // lisible (environ 40 % de l'éclairement du jour au sol, façades tournées vers l'astre bien éclairées).
      hemiIntensity: p.hemiIntensity * HEMI_K * 2,
      sunColor: p.sunColor,
      sunIntensity: p.sunIntensity * SUN_K,
      exposure: (1.05 * p.exposure) / PRESETS.jour.exposure,
      sunOffset: sunOffsetFor(p.elevation, p.azimuth),
      windows: light === "crepuscule" ? 0.35 : 0.12,
      rain,
    };
  }
  if (!rain) return a;
  return {
    ...a,
    sky: mix(a.sky, night ? 0x141a22 : RAIN_SKY, 0.7),
    fogNear: a.fogNear / RAIN_FOG,
    fogFar: a.fogFar / RAIN_FOG,
    hemiSky: mix(a.hemiSky, night ? 0x2a3140 : 0xb4bcc2, 0.6),
    // Ciel couvert : lumière diffuse plus forte, soleil voilé.
    hemiIntensity: a.hemiIntensity * 1.15,
    sunIntensity: a.sunIntensity * RAIN_SUN,
    exposure: a.exposure * 0.95,
  };
}

/** Traits de pluie selon la qualité de la bataille ; boîte resserrée autour de la caméra (m), traits plus longs que ceux de R1b. */
export const RAIN_PARTICLES = { bas: 1500, moyen: 3000, haut: 5000 } as const;
export const RAIN_BOX = { radius: 40, height: 28, streak: 1.6, opacity: 0.5 } as const;
