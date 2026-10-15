import type { AtlasMapType, LocationType } from "@prisma/client";
export const SHIO_ATLAS_KEY = "shio-atlas:v1";
type SeedLocation = { key: string; name: string; parent: string | null; type: LocationType; description: string; secret: boolean };
type SeedMap = { key: string; name: string; type: AtlasMapType; parent: string | null; location: string | null; asset: string; width: number; height: number };
type SeedMarker = { key: string; map: string; location: string; x: number; y: number; category: string; icon: string; child: string | null };
export const shioLocations: SeedLocation[] = [];
export const shioMarkers: SeedMarker[] = [];
export const shioMaps: SeedMap[] = [
  { key: "world", name: "Naruto-Weltkarte", type: "WORLD", parent: null, location: null, asset: "naruto-world.png", width: 1807, height: 2048 },
  { key: "island", name: "Shio no Kuni – Inselkarte", type: "ISLAND", parent: "world", location: "shio", asset: "shio-island.png", width: 1363, height: 1154 },
  { key: "cutout", name: "Shio no Kuni – freigestellte Ansicht", type: "CUSTOM", parent: "island", location: "shio", asset: "island-cutout.png", width: 1362, height: 1155 },
  { key: "reigan", name: "Reigan / Shiogakure", type: "CITY", parent: "island", location: "reigan", asset: "reigan.png", width: 1536, height: 1024 },
  { key: "kanezaki", name: "Kanezaki", type: "VILLAGE", parent: "island", location: "kanezaki", asset: "kanezaki.png", width: 1536, height: 1024 },
  { key: "shioura", name: "Shioura", type: "VILLAGE", parent: "island", location: "shioura", asset: "shioura.png", width: 1536, height: 1024 },
];
function location(key: string, name: string, parent: string | null, type: LocationType, description = "", secret = false) { shioLocations.push({ key, name, parent, type, description: description || `Auf der kanonischen Karte benannter Ort: ${name}.`, secret }); }
function marker(map: string, location: string, x: number, y: number, category: string, icon: string, child: string | null = null) {
  const m = shioMaps.find(m => m.key === map)!;
  shioMarkers.push({ key: `${map}:${location}`, map, location, x: x / m.width, y: y / m.height, category, icon, child });
}
location("shio", "Shio no Kuni", null, "COUNTRY", "Eigenständiger Pufferstaat östlich von Konoha / Hi no Kuni, südlich des Blitzreichs und nordwestlich des Wasserreichs. Die Nutzerangabe ist gegenüber widersprüchlichen Bildpfeilen massgeblich.");
location("nagishima", "Nagishima", "shio", "LANDMARK", "Insel der ruhigen See; Standort von Shioura.");
location("reigan", "Reigan / Shiogakure", "shio", "CITY", "Hauptstadt von Shio no Kuni und verborgenes Shinobi-Dorf Shiogakure.");
location("kanezaki", "Kanezaki", "shio", "VILLAGE", "Dorf der Schmieden im rauen Norden, geprägt von Handwerk, Bergbau und dem Kurogane-Gebirge.");
location("shioura", "Shioura", "nagishima", "VILLAGE", "Maritime Siedlung auf Nagishima; Fischerei, Schiffbau, Seefahrt und Traditionen prägen den Alltag.");
marker("world", "shio", 1807 * .65, 2048 * .272, "SETTLEMENT", "home", "island");
marker("island", "reigan", 690, 550, "SETTLEMENT", "home", "reigan");
marker("island", "kanezaki", 786, 134, "SETTLEMENT", "home", "kanezaki");
marker("island", "shioura", 322, 956, "SETTLEMENT", "home", "shioura");
marker("island", "nagishima", 175, 887, "NATURE", "tree");
const geography: [string, string, number, number, string, string][] = [
  ["arashiyama", "Arashiyama", 610, 170, "NATURE", "mountain"], ["kurogane", "Kurogane-Gebirge", 470, 390, "NATURE", "mountain"], ["hisuiyama", "Hisuiyama", 1045, 445, "NATURE", "mountain"],
  ["kazemori", "Kazemori / Windwald", 826, 305, "NATURE", "tree"], ["kurogane-forest", "Kurogane-Wald", 540, 505, "NATURE", "tree"], ["aokiri", "Aokiri-Wald", 1050, 572, "NATURE", "tree"],
  ["kazehama", "Kazehama", 225, 512, "NATURE", "pin"], ["shirohama", "Shirohama", 498, 723, "NATURE", "pin"], ["tsukihama", "Tsukihama", 1090, 753, "NATURE", "pin"], ["kurohama", "Kurohama", 1299, 556, "NATURE", "pin"],
  ["reigan-bay", "Reigan-Bucht", 778, 771, "HARBOR", "harbor"], ["kanezaki-bay", "Kanezaki-Bucht", 971, 187, "HARBOR", "harbor"], ["shioura-bay", "Shioura-Bucht", 409, 1040, "HARBOR", "harbor"],
  ["shionomichi", "Shionomichi / Pfad der Gezeiten", 432, 796, "NATURE", "pin"], ["kagewan", "Alter Nordhafen / Kagewan", 871, 62, "HARBOR", "harbor"],
];
for (const [key, name, x, y, category, icon] of geography) { location(key, name, "shio", "LANDMARK"); marker("island", key, x, y, category, icon); }
const districts: [string, string, number, number][] = [["upper", "Oberstadt", 864, 161], ["east", "Ostviertel", 1410, 419], ["west", "Westviertel", 291, 591], ["south", "Südviertel", 1347, 640], ["harbor", "Hafenviertel", 661, 826]];
for (const [key, name, x, y] of districts) { location(`reigan-${key}`, name, "reigan", "DISTRICT"); marker("reigan", `reigan-${key}`, x, y, "SETTLEMENT", "home"); }
type CityPlace = [string, string, number, number, string, string, string?];
const reigan: CityPlace[] = [
  ["shiokage", "Shiokage-Büro", 628, 76, "SHINOBI", "tower", "reigan-upper"], ["academy", "Ninja-Akademie", 456, 215, "SHINOBI", "tower", "reigan-upper"], ["library", "Bibliothek", 837, 218, "BUILDING", "home", "reigan-upper"],
  ["hospital", "Krankenhaus", 1044, 272, "MEDICAL", "medical"], ["lab", "Forschungslabor", 1202, 175, "MEDICAL", "medical"], ["uzumaki", "Uzumaki-Anwesen", 1339, 279, "BUILDING", "home", "reigan-east"],
  ["anbu", "ANBU-Quartier", 351, 360, "SECRET", "secret", "reigan-west"], ["ren", "Rens Aufnahmehaus", 559, 392, "BUILDING", "home"], ["market", "Marktplatz", 720, 458, "TRADE", "trade"],
  ["forge", "Schmiede", 938, 434, "TRADE", "trade"], ["guild", "Gildenviertel", 848, 512, "TRADE", "trade"], ["nobles", "Adelsviertel", 311, 519, "SETTLEMENT", "home", "reigan-west"],
  ["temple", "Tempel", 1189, 548, "RELIGION", "shrine", "reigan-south"], ["westport", "Westhafen", 359, 721, "HARBOR", "harbor", "reigan-harbor"], ["southport", "Südhafen", 1166, 766, "HARBOR", "harbor", "reigan-harbor"], ["fishery", "Fischerei", 864, 751, "TRADE", "trade", "reigan-harbor"],
];
const kanezaki: CityPlace[] = [
  ["mine-entry", "Kurogane-Gebirge / Minenzugang", 360, 100, "NATURE", "mountain"], ["mines", "Erzminen", 661, 174, "TRADE", "trade"], ["forest-camp", "Waldlager", 985, 88, "NATURE", "tree"],
  ["training", "Trainingsgebiet", 1190, 203, "TRAINING", "training"], ["forges", "Schmiedeviertel", 285, 317, "TRADE", "trade"], ["homes", "Wohnviertel", 883, 304, "SETTLEMENT", "home"],
  ["square", "Dorfplatz", 626, 380, "TRADE", "trade"], ["clinic", "Kleine Krankenstation", 1045, 400, "MEDICAL", "medical"], ["wood", "Holzlager", 210, 500, "TRADE", "tree"],
  ["falls", "Wasserfälle", 1254, 462, "NATURE", "pin"], ["lookout", "Aussichtspfad", 980, 607, "NATURE", "pin"], ["port", "Hafen von Kanezaki", 514, 671, "HARBOR", "harbor"],
  ["north-path", "Nordpfad nach Arashiyama", 744, 62, "NATURE", "pin"],
];
const shioura: CityPlace[] = [
  ["shrine", "Seigai-Schrein", 449, 99, "RELIGION", "shrine"], ["tree", "Ältester Baum", 750, 109, "NATURE", "tree"], ["lookout", "Aussichtspunkt", 1044, 179, "NATURE", "pin"],
  ["council", "Dorfrat-Haus", 614, 270, "BUILDING", "home"], ["homes", "Wohnviertel", 961, 297, "SETTLEMENT", "home"], ["lighthouse", "Leuchtturm", 1295, 288, "HARBOR", "tower"],
  ["market", "Marktplatz", 741, 367, "TRADE", "trade"], ["boatyard", "Bootsbaudwerft", 1075, 385, "TRADE", "trade"], ["westport", "Westhafen", 297, 437, "HARBOR", "harbor"],
  ["eastport", "Osthafen", 1316, 479, "HARBOR", "harbor"], ["nets", "Netzviertel", 605, 511, "TRADE", "trade"], ["drying", "Trockengestelle", 917, 508, "TRADE", "trade"], ["tides", "Heiligtum der Gezeiten", 878, 612, "RELIGION", "shrine"],
];
for (const [city, places] of [["reigan", reigan], ["kanezaki", kanezaki], ["shioura", shioura]] as const) for (const [key, name, x, y, category, icon, parent] of places) {
  const id = `${city}-${key}`;
  location(id, name, parent || city, category === "SETTLEMENT" || name.endsWith("viertel") ? "DISTRICT" : category === "NATURE" ? "LANDMARK" : "BUILDING", "", category === "SECRET");
  marker(city, id, x, y, category, icon);
}
export const shioBlueprint = { key: SHIO_ATLAS_KEY, maps: shioMaps, locations: shioLocations, markers: shioMarkers };
