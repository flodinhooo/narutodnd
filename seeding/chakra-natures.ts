export const basicNatureKeys = ["FIRE", "WATER", "WIND", "LIGHTNING", "EARTH"] as const;
export const chakraNatureNames: Record<string, string> = {
 FIRE: "Feuer", WATER: "Wasser", WIND: "Wind", LIGHTNING: "Blitz", EARTH: "Erde",
 NIKKOTON: "Nikkōton", IRON_RELEASE: "Eisenversteck",
};
export function chakraNatureSeed(key: string) {
 return {key, displayName: chakraNatureNames[key] ?? key, description: `${key.toLowerCase()} chakra nature`, playerSelectable: basicNatureKeys.some(basic => basic === key)};
}
