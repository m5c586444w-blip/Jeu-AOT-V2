"""Table « bloc -> géométrie + matériau du projet ».
Les couleurs sont des valeurs choisies par le projet (sRGB 0-255, ton sombre réaliste), pas des couleurs ni des textures extraites du jeu d'origine.
Chaque nom de bloc est rangé dans : une GÉOMÉTRIE (kind) et une FAMILLE de matériau.
kind : 0 ignoré (air, décor immatériel) | 1 cube plein | 2 dalle | 3 escalier | 4 poteau fin (clôture, muret) | 5 eau (translucide) | 6 verre (translucide)
"""
import re

# ---------- couleurs de base par nom de couleur (laine, béton, terre cuite, verre teinté, tapis...) ----------
COUL = {
 "white": (205, 205, 200), "light_gray": (146, 146, 144), "gray": (70, 72, 76), "black": (26, 26, 30), "brown": (98, 66, 42),
 "red": (138, 42, 38), "orange": (186, 100, 42), "yellow": (196, 168, 52), "lime": (108, 152, 42), "green": (68, 88, 46),
 "cyan": (42, 106, 116), "light_blue": (68, 136, 182), "blue": (50, 60, 142), "purple": (104, 52, 142), "magenta": (150, 62, 142), "pink": (194, 112, 138),
}
BOIS = {
 "oak": (158, 128, 80), "spruce": (108, 80, 50), "birch": (188, 172, 124), "jungle": (148, 108, 74), "acacia": (160, 94, 56),
 "dark_oak": (66, 46, 28), "mangrove": (112, 50, 46), "bamboo": (196, 176, 80), "cherry": (214, 158, 166), "crimson": (110, 48, 70), "warped": (44, 112, 108),
}
# (mot-clé à trouver dans le nom, famille, rgb) ; première règle qui correspond. Ordre = priorité.
PIERRES = [
 ("mossy_cobblestone", "pave_moussu", (92, 108, 86)), ("mossy_stone_brick", "pierre_moussue", (96, 112, 90)), ("mossy", "pierre_moussue", (96, 112, 90)),
 ("cobbled_deepslate", "ardoise_pavee", (72, 72, 78)), ("deepslate_brick", "ardoise_brique", (66, 66, 72)), ("deepslate_tile", "ardoise_brique", (60, 60, 66)),
 ("polished_deepslate", "ardoise_brique", (68, 68, 74)), ("deepslate", "ardoise", (66, 66, 72)),
 ("cobblestone", "pave", (112, 110, 108)), ("smooth_stone", "pierre_lisse", (132, 132, 130)), ("stone_brick", "pierre_brique", (118, 118, 116)),
 ("polished_andesite", "andesite", (136, 138, 138)), ("andesite", "andesite", (130, 132, 132)), ("polished_diorite", "diorite", (188, 188, 186)), ("diorite", "diorite", (184, 184, 182)),
 ("polished_granite", "granite", (152, 108, 92)), ("granite", "granite", (148, 104, 88)), ("tuff", "tuf", (106, 108, 100)), ("calcite", "calcite", (222, 222, 216)),
 ("polished_blackstone", "pierre_noire", (44, 40, 46)), ("blackstone", "pierre_noire", (38, 34, 40)), ("basalt", "basalte", (62, 64, 68)),
 ("smooth_sandstone", "gres", (206, 190, 140)), ("cut_sandstone", "gres", (206, 190, 140)), ("sandstone", "gres", (204, 188, 138)),
 ("end_stone_brick", "pierre_pale", (206, 202, 146)), ("end_stone", "pierre_pale", (210, 206, 150)),
 ("nether_brick", "brique_sombre", (54, 28, 32)), ("red_nether_brick", "brique_rouge_sombre", (84, 20, 24)),
 ("mud_brick", "brique_boue", (132, 100, 80)),
 ("brick", "brique", (150, 84, 70)),
 ("stone", "pierre", (122, 122, 120)),
 ("obsidian", "obsidienne", (24, 18, 36)), ("bedrock", "socle", (40, 40, 42)),
 ("dripstone", "dripstone", (120, 96, 80)),
]
DIVERS = [
 ("packed_mud", "boue_sechee", (120, 90, 68)), ("muddy", "boue", (72, 58, 50)), ("mud", "boue", (76, 60, 52)),
 ("coarse_dirt", "terre_grossiere", (108, 84, 60)), ("rooted_dirt", "terre", (110, 84, 62)), ("podzol", "podzol", (96, 72, 42)), ("dirt_path", "chemin", (158, 132, 92)),
 ("grass_block", "herbe", (84, 112, 62)), ("dirt", "terre", (114, 86, 62)), ("farmland", "terre", (100, 72, 50)), ("mycelium", "mycelium", (110, 96, 110)),
 ("moss", "mousse", (66, 98, 48)), ("sand", "sable", (198, 182, 132)), ("gravel", "gravier", (130, 126, 122)),
 ("snow", "neige", (236, 240, 244)), ("powder_snow", "neige", (236, 240, 244)), ("ice", "glace", (150, 186, 226)),
 ("hay_block", "foin", (180, 150, 52)), ("bone_block", "os", (222, 216, 196)), ("honey_block", "miel", (214, 150, 40)),
 ("gold_block", "or", (226, 186, 58)), ("iron_block", "fer", (196, 196, 198)), ("netherite_block", "netherite", (60, 54, 60)),
 ("waxed_exposed_cut_copper", "cuivre", (160, 112, 92)), ("exposed_copper", "cuivre", (160, 112, 92)), ("copper", "cuivre", (176, 108, 80)),
 ("coal_block", "charbon", (28, 28, 30)), ("terracotta", "terre_cuite", None),
 ("brown_mushroom_block", "champignon", (150, 112, 82)), ("red_mushroom_block", "champignon_rouge", (170, 52, 48)), ("mushroom_stem", "os", (210, 204, 188)),
 ("nether_wart_block", "verrue", (120, 20, 24)), ("netherrack", "netherrack", (96, 40, 40)), ("soul_sand", "sable_ame", (82, 66, 54)),
 ("sponge", "eponge", (190, 180, 70)), ("glowstone", "lumiere", (200, 170, 100)), ("sea_lantern", "lumiere", (190, 210, 200)),
 ("bookshelf", "bois_chene", (140, 108, 64)), ("barrel", "bois_epicea", (108, 80, 50)), ("note_block", "bois_chene", (150, 118, 72)),
 ("crafting_table", "bois_chene", (150, 118, 72)), ("smoker", "pave", (112, 110, 108)), ("blast_furnace", "pave", (100, 100, 100)), ("furnace", "pave", (112, 110, 108)),
 ("loom", "bois_chene", (150, 118, 72)), ("chest", "bois_chene", (140, 100, 50)), ("piston", "pave", (120, 112, 100)), ("target", "foin", (200, 190, 170)),
 ("beehive", "bois_chene", (170, 136, 80)), ("bee_nest", "foin", (200, 170, 70)), ("cobweb", None, None),
 ("smithing_table", "bois_chene", (110, 90, 70)), ("fletching_table", "bois_chene", (170, 140, 90)), ("clay", "argile", (150, 156, 170)), ("pumpkin", "citrouille", (200, 120, 30)),
 ("honeycomb_block", "miel", (214, 150, 40)), ("melon", "pasteque", (110, 150, 40)), ("ancient_debris", "debris", (92, 66, 58)), ("diamond_block", "diamant", (90, 200, 190)),
 ("emerald_block", "emeraude", (50, 180, 90)), ("shroomlight", "lumiere", (220, 150, 80)), ("amethyst", "amethyste", (130, 90, 190)), ("magma_block", "magma", (120, 50, 20)),
 ("spawner", "pave", (40, 44, 52)),
 ("sculk", "sculk", (14, 28, 36)), ("dried_kelp_block", "algue_sechee", (56, 62, 40)),
 ("ore", "pierre", (122, 122, 120)),  # minerais : la couleur de la roche, sans les points de minerai
 ("infested", "pierre_moussue", (96, 112, 90)),
 ("coral_block", "corail_mort", (128, 124, 120)),
]
# ---------- noms sans géométrie utile : ignorés ----------
IGNORE_EXACT = {"light", "barrier", "structure_void", "air", "cave_air", "void_air", "lever", "tripwire", "tripwire_hook", "bell", "cake", "fire", "soul_fire", "lantern", "soul_lantern",
 "campfire", "soul_campfire", "hopper", "anvil", "chipped_anvil", "damaged_anvil", "grindstone", "lectern", "composter", "cauldron", "water_cauldron", "decorated_pot", "flower_pot",
 "scaffolding", "chain", "ladder", "vine", "glow_lichen", "sea_pickle", "turtle_egg", "small_dripleaf", "big_dripleaf", "big_dripleaf_stem", "pointed_dripstone", "player_head", "player_wall_head",
 "piston_head", "moving_piston", "end_rod", "torch", "wall_torch", "soul_torch", "redstone_torch", "redstone_wire", "snow", "string", "iron_bars", "weeping_vines", "twisting_vines", "kelp", "kelp_plant",
 "seagrass", "tall_seagrass", "lily_pad", "short_grass", "tall_grass", "grass", "fern", "large_fern", "dead_bush", "sugar_cane", "bamboo", "cocoa", "wheat", "carrots", "potatoes", "beetroots",
 "melon_stem", "attached_melon_stem", "pumpkin_stem", "attached_pumpkin_stem", "pitcher_crop", "pitcher_plant", "sweet_berry_bush", "torchflower_crop", "torchflower", "azalea", "flowering_azalea",
 "dandelion", "poppy", "blue_orchid", "allium", "azure_bluet", "red_tulip", "orange_tulip", "white_tulip", "pink_tulip", "oxeye_daisy", "cornflower", "lily_of_the_valley", "wither_rose",
 "sunflower", "lilac", "rose_bush", "peony", "hanging_roots", "spore_blossom", "sniffer_egg", "frogspawn", "lightning_rod", "bubble_column", "end_portal", "nether_portal", "item_frame", "glow_item_frame",
 "brewing_stand", "candle", "small_amethyst_bud", "medium_amethyst_bud", "large_amethyst_bud", "amethyst_cluster", "cave_vines", "cave_vines_plant", "brown_mushroom", "red_mushroom", "enchanting_table", "conduit", "beacon", "daylight_detector", "repeater", "comparator", "observer", "dispenser", "dropper", "jukebox", "tnt", "chain_command_block"}
IGNORE_SUFFIX = ("_sign", "_wall_sign", "_hanging_sign", "_wall_hanging_sign", "_banner", "_wall_banner", "_carpet", "_pressure_plate", "_button", "_trapdoor", "_door", "_fence_gate",
 "_pane", "_candle", "_candle_cake", "_coral_fan", "_coral_wall_fan", "_coral", "_wall_head", "_head", "_skull", "_bed", "_sapling", "_propagule", "_roots", "_bush", "_rail", "rail", "_potted", "_wall_skull")
IGNORE_PREFIX = ("potted_", "infested_")  # infested_* est repris en cube par la règle « infested »
THIN = {"fence": 0.25, "wall": 0.5}   # largeur du poteau en blocs

def _couleur_nom(n):
    for c in sorted(COUL, key=lambda k: -len(k)):
        if n.startswith(c + "_") or ("_" + c + "_") in n: return c
    return None

def classer(cle):
    """cle = nom[propriétés] -> (kind, famille, (r,g,b), alpha). kind 0 = ignoré."""
    n = cle.split("[")[0].replace("minecraft:", "")
    # géométrie
    if n == "projet:feuillage_plante": return 1, "feuillage_plante", (62, 96, 48), 1.0
    if n == "water": return 5, "eau", (44, 78, 112), 0.62
    if n == "lava": return 1, "lave", (220, 100, 30), 1.0
    if n in IGNORE_EXACT: return 0, None, None, 1.0
    if n.endswith("_wall") and not n.endswith(("_wall_sign", "_wall_banner", "_wall_hanging_sign", "_wall_head", "_wall_torch", "_wall_skull")) :
        k = 4
    elif n.endswith("_fence") or n == "nether_brick_fence": k = 4
    elif n.endswith("_slab"): k = 2
    elif n.endswith("_stairs"): k = 3
    elif n.endswith(IGNORE_SUFFIX) and not n.endswith("_glass_pane"): return 0, None, None, 1.0
    elif n.startswith(IGNORE_PREFIX) and not n.startswith("infested_"): return 0, None, None, 1.0
    elif "glass" in n and not n.endswith("_pane"): k = 6
    elif n.endswith("_pane"): return 0, None, None, 1.0
    else: k = 1
    base = re.sub(r"_(slab|stairs|wall|fence)$", "", n)
    # verre
    if k == 6:
        c = _couleur_nom(n)
        rgb = COUL[c] if c else (190, 220, 228)
        return 6, "verre_" + (c or "clair"), rgb, 0.35
    # bois (planches, troncs, écorcé...)
    for w, rgb in BOIS.items():
        b_ = base + "_"
        if b_.startswith(w + "_") or b_.startswith("stripped_" + w + "_"):
            fam = "bois_" + w
            if "log" in base or "wood" in base or "stem" in base or "hyphae" in base: return k, fam + "_tronc", tuple(int(v * 0.82) for v in rgb), 1.0
            return k, fam, rgb, 1.0
    if base.startswith("bamboo"): return k, "bois_bamboo", BOIS["bamboo"], 1.0
    # feuillage
    if "leaves" in n: return 1, "feuillage", (58, 90, 46), 1.0
    # couleurs (laine, béton, poudre de béton, terre cuite émaillée, tapis, verre teinté)
    c = _couleur_nom(base)
    if c and any(t in base for t in ("wool", "concrete", "terracotta", "glazed")):
        rgb = COUL[c]
        if "terracotta" in base or "glazed" in base: rgb = tuple(int(v * 0.8 + 18) for v in rgb)
        return k, "couleur_" + c + ("_terre_cuite" if "terracotta" in base else ""), rgb, 1.0
    for kw, fam, rgb in PIERRES:
        if kw in base:
            return k, fam, rgb, 1.0
    for kw, fam, rgb in DIVERS:
        if kw in base:
            if fam is None: return 0, None, None, 1.0
            if kw == "terracotta": return k, "terre_cuite", (150, 92, 68), 1.0
            return k, fam, rgb, 1.0
    return k, "inconnu", (128, 128, 128), 1.0

if __name__ == "__main__":
    import sys, json
    inv = json.load(open(sys.argv[1]))
    g = {}
    for cle, nb in inv.items():
        n = cle.split("[")[0]; g[n] = g.get(n, 0) + nb
    inconnus = [(n, c) for n, c in g.items() if classer(n)[1] == "inconnu"]
    ign = sorted(((c, n) for n, c in g.items() if classer(n)[0] == 0 and n != "air"), reverse=True)
    print("noms:", len(g), "| inconnus:", len(inconnus)); print("INCONNUS:", sorted(inconnus, key=lambda t: -t[1]))
    print("IGNORÉS (n blocs):", sum(c for c, _ in ign)); print([(n.replace("minecraft:", ""), c) for c, n in ign][:70])


FERME_SUFFIX = ("_door", "_trapdoor", "_pane", "_fence_gate")
def bloque_air(cle):
    """Blocs sans géométrie conservée mais qui ferment une pièce (portes, volets, vitres fines, grilles) : barrière pour le calcul de l'extérieur."""
    n = cle.split("[")[0].replace("minecraft:", "")
    return n.endswith(FERME_SUFFIX) or n in ("iron_bars", "glass_pane")
