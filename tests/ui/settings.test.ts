import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, crossesAutosave, loadSettings, saveSettings } from "../../src/ui/settings";

function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe("préférences (AC1-14)", () => {
  it("échelle 100–200 % et langue, persistées ; valeurs invalides ignorées", () => {
    const s = memory();
    expect(loadSettings(s)).toEqual(DEFAULT_SETTINGS);
    saveSettings(s, { ...DEFAULT_SETTINGS, locale: "en", uiScale: 175, volMusic: 20, subtitles: false });
    expect(loadSettings(s)).toEqual({ ...DEFAULT_SETTINGS, locale: "en", uiScale: 175, volMusic: 20, subtitles: false });
    s.setItem("murs-et-sang:preferences", JSON.stringify({ locale: "de", uiScale: 400, volSfx: 300, subtitles: "oui" }));
    expect(loadSettings(s)).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
  });
});

describe("sauvegarde automatique mensuelle (F-SYS-03)", () => {
  it("déclenchée au passage d'un multiple de 30 jours", () => {
    expect(crossesAutosave({ year: 845, day: 29 }, { year: 845, day: 31 }, 30)).toBe(true);
    expect(crossesAutosave({ year: 845, day: 2 }, { year: 845, day: 5 }, 30)).toBe(false);
    expect(crossesAutosave({ year: 845, day: 359 }, { year: 846, day: 2 }, 30)).toBe(true);
  });

  it("préférences antérieures à la musique d'AUD : le volume de musique revient à 45 % (gain ≤ 0,35, D-117)", () => {
    const s = memory();
    s.setItem("murs-et-sang:preferences", JSON.stringify({ volMaster: 70, volMusic: 60, volSfx: 30 }));
    const old = loadSettings(s);
    expect(old.volMusic).toBe(DEFAULT_SETTINGS.volMusic);
    expect(old.volSfx).toBe(30);
    expect((old.volMaster / 100) * (old.volMusic / 100)).toBeLessThanOrEqual(0.35);
    saveSettings(s, { ...old, volMusic: 80 });
    expect(loadSettings(s).volMusic).toBe(80);
  });
});
