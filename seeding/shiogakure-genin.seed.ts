/**
 * Shiogakure: ten fixed NPC Genin.
 * Data-only seed, deliberately independent of Prisma schema.
 * Canon facts preserved; proposed attributes/Hit Dice are NOT confirmed canon.
 * Integrate through seedShiogakureGenin with a schema-specific adapter.
 */
export type Ability = "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";
export type GeninSeed = {
  seedKey: string; name: string; clan: string; age: number;
  gender: "MALE" | "FEMALE"; rank: "GENIN"; level: 1;
  hitDie: 8 | 10; abilities: Record<Ability, number>;
  chakraMultiplier: number; chakraMultiplierProvisional: boolean;
  primaryNature: "FIRE" | "WATER" | "WIND" | "EARTH" | null;
  combatStyle: string; biography: string; notes: string; relationships: string;
  startingJutsuNames: string[];
};

export const SHIOGAKURE_GENIN = [
  {
    "seedKey": "shiogakure:genin:sora-uzumaki",
    "name": "Sora Uzumaki",
    "clan": "Uzumaki",
    "age": 10,
    "gender": "MALE",
    "rank": "GENIN",
    "level": 1,
    "hitDie": 10,
    "abilities": {
      "STR": 8,
      "DEX": 14,
      "CON": 13,
      "INT": 17,
      "WIS": 12,
      "CHA": 10
    },
    "chakraMultiplier": 1.75,
    "chakraMultiplierProvisional": false,
    "primaryNature": null,
    "combatStyle": "Chakra-Ketten, Metallketten-Stil, Fūinjutsu",
    "biography": "Prodigy; enger Freund und Rivale von Akito Kurogawa.",
    "notes": "Besonders grosse Chakrareserve; bestehende Prodigy-Boni im Spielsystem prüfen.",
    "relationships": "Akito Kurogawa: bester Freund und Rivale.",
    "startingJutsuNames": [
      "Chakra-Ketten (frühe Ausprägung)"
    ]
  },
  {
    "seedKey": "shiogakure:genin:yuna-uzumaki",
    "name": "Yuna Uzumaki",
    "clan": "Uzumaki",
    "age": 10,
    "gender": "FEMALE",
    "rank": "GENIN",
    "level": 1,
    "hitDie": 8,
    "abilities": {
      "STR": 8,
      "DEX": 15,
      "CON": 13,
      "INT": 12,
      "WIS": 11,
      "CHA": 14
    },
    "chakraMultiplier": 1.3,
    "chakraMultiplierProvisional": false,
    "primaryNature": "WIND",
    "combatStyle": "Windtechniken und Uzumaki-Fūinjutsu",
    "biography": "Werte sind ein Balancing-Vorschlag; Charakterhintergrund noch weiter ausarbeiten.",
    "notes": "d8-Bonus +1 WIS bereits eingerechnet.",
    "relationships": "Uzumaki-Familie; weitere konkrete Beziehungen offen.",
    "startingJutsuNames": []
  },
  {
    "seedKey": "shiogakure:genin:akito-kurogawa",
    "name": "Akito Kurogawa",
    "clan": "Kurogawa",
    "age": 10,
    "gender": "MALE",
    "rank": "GENIN",
    "level": 1,
    "hitDie": 8,
    "abilities": {
      "STR": 12,
      "DEX": 14,
      "CON": 13,
      "INT": 13,
      "WIS": 16,
      "CHA": 10
    },
    "chakraMultiplier": 1.5,
    "chakraMultiplierProvisional": false,
    "primaryNature": "FIRE",
    "combatStyle": "Katon-Ninjutsu, gutes Taijutsu, latentes Nikkōton",
    "biography": "Fröhlich, frech, ehrgeizig; Vater Renji, Mutter Akari, Schwester Rina.",
    "notes": "d8-Bonus +1 WIS bereits eingerechnet; Nikkōton NICHT freischalten.",
    "relationships": "Sora Uzumaki: bester Freund und Rivale.",
    "startingJutsuNames": []
  },
  {
    "seedKey": "shiogakure:genin:takumi-itohara",
    "name": "Takumi Itohara",
    "clan": "Itohara",
    "age": 10,
    "gender": "MALE",
    "rank": "GENIN",
    "level": 1,
    "hitDie": 8,
    "abilities": {
      "STR": 8,
      "DEX": 14,
      "CON": 12,
      "INT": 16,
      "WIS": 13,
      "CHA": 10
    },
    "chakraMultiplier": 1.0,
    "chakraMultiplierProvisional": false,
    "primaryNature": null,
    "combatStyle": "Chakrafäden, Fallen und präzise Planung",
    "biography": "Ruhig, analytisch, perfektionistisch; beschützt Zwillingsschwester Yui.",
    "notes": "d8-Bonus +1 INT eingerechnet; Chakranatur offen.",
    "relationships": "Yui Itohara: unterstützende Zwillingsschwester.",
    "startingJutsuNames": [
      "Ito no Wana",
      "Ayatsuri no Ito"
    ]
  },
  {
    "seedKey": "shiogakure:genin:yui-itohara",
    "name": "Yui Itohara",
    "clan": "Itohara",
    "age": 10,
    "gender": "FEMALE",
    "rank": "GENIN",
    "level": 1,
    "hitDie": 10,
    "abilities": {
      "STR": 10,
      "DEX": 16,
      "CON": 13,
      "INT": 8,
      "WIS": 12,
      "CHA": 14
    },
    "chakraMultiplier": 1.1,
    "chakraMultiplierProvisional": false,
    "primaryNature": null,
    "combatStyle": "Bewegliches Taijutsu und Chakrafäden",
    "biography": "Selbstbewusst, mutig, direkt; Zwillingsbruder Takumi.",
    "notes": "d10 gewählt; Chakranatur offen.",
    "relationships": "Takumi Itohara: unterstützender Zwillingsbruder.",
    "startingJutsuNames": [
      "Ito no Hikiyose",
      "Mawari Ito"
    ]
  },
  {
    "seedKey": "shiogakure:genin:nagi-shiranami",
    "name": "Nagi Shiranami",
    "clan": "Shiranami",
    "age": 10,
    "gender": "MALE",
    "rank": "GENIN",
    "level": 1,
    "hitDie": 8,
    "abilities": {
      "STR": 8,
      "DEX": 12,
      "CON": 14,
      "INT": 13,
      "WIS": 16,
      "CHA": 10
    },
    "chakraMultiplier": 1.15,
    "chakraMultiplierProvisional": true,
    "primaryNature": "WATER",
    "combatStyle": "Defensive Gezeitenkunst und Unterstützung",
    "biography": "Sanft, empathisch; Vater Masaru, Grossmutter Chiyo, Mutter Mizuki.",
    "notes": "d8-Bonus +1 WIS eingerechnet; Chakrareserve 1.15 VORLÄUFIG.",
    "relationships": "Nanami Shiranami: Cousine und vertraute Trainingspartnerin.",
    "startingJutsuNames": [
      "Nagare no Tate",
      "Hikishio"
    ]
  },
  {
    "seedKey": "shiogakure:genin:nanami-shiranami",
    "name": "Nanami Shiranami",
    "clan": "Shiranami",
    "age": 10,
    "gender": "FEMALE",
    "rank": "GENIN",
    "level": 1,
    "hitDie": 8,
    "abilities": {
      "STR": 8,
      "DEX": 16,
      "CON": 12,
      "INT": 14,
      "WIS": 13,
      "CHA": 10
    },
    "chakraMultiplier": 1.1,
    "chakraMultiplierProvisional": false,
    "primaryNature": "WATER",
    "combatStyle": "Schnelle Gezeitenkunst, wechselnde Strömungsrichtungen",
    "biography": "Ehrgeizig und kreativ; Mutter Natsumi, Vater Takahiro, Grossmutter Chiyo.",
    "notes": "d8-Bonus +1 DEX eingerechnet; Startjutsu noch Entwurf.",
    "relationships": "Nagi Shiranami: Cousin und Trainingspartner.",
    "startingJutsuNames": [
      "Futatsu no Nagare",
      "Shioashi"
    ]
  },
  {
    "seedKey": "shiogakure:genin:mizuki-tsukishiro",
    "name": "Mizuki Tsukishiro",
    "clan": "Tsukishiro",
    "age": 11,
    "gender": "FEMALE",
    "rank": "GENIN",
    "level": 1,
    "hitDie": 8,
    "abilities": {
      "STR": 8,
      "DEX": 13,
      "CON": 10,
      "INT": 14,
      "WIS": 12,
      "CHA": 16
    },
    "chakraMultiplier": 0.9,
    "chakraMultiplierProvisional": false,
    "primaryNature": "WATER",
    "combatStyle": "Genjutsu und Sinnestäuschungen",
    "biography": "Ruhig, aufmerksam, introvertiert; Familie betreibt Buchladen in Reigan.",
    "notes": "Neues Charakterkonzept; d8-Bonus +1 CHA enthalten.",
    "relationships": "Team und Sensei offen.",
    "startingJutsuNames": [
      "Kasumi no Koe",
      "Maboroshi no Kage"
    ]
  },
  {
    "seedKey": "shiogakure:genin:tetsuya-kanemori",
    "name": "Tetsuya Kanemori",
    "clan": "Kanemori",
    "age": 12,
    "gender": "MALE",
    "rank": "GENIN",
    "level": 1,
    "hitDie": 8,
    "abilities": {
      "STR": 12,
      "DEX": 16,
      "CON": 13,
      "INT": 15,
      "WIS": 10,
      "CHA": 8
    },
    "chakraMultiplier": 1.0,
    "chakraMultiplierProvisional": false,
    "primaryNature": "EARTH",
    "combatStyle": "Ninja-Werkzeuge, Drahtfallen, Geländeplanung",
    "biography": "Erfinderisch, impulsiv; Handwerkerfamilie aus Kanezaki.",
    "notes": "Neues Charakterkonzept; d8-Bonus +1 DEX enthalten.",
    "relationships": "Team und Sensei offen.",
    "startingJutsuNames": [
      "Kōsen Wāya",
      "Kemuri no Wana"
    ]
  },
  {
    "seedKey": "shiogakure:genin:nami-shiosaki",
    "name": "Nami Shiosaki",
    "clan": "Shiosaki",
    "age": 11,
    "gender": "FEMALE",
    "rank": "GENIN",
    "level": 1,
    "hitDie": 8,
    "abilities": {
      "STR": 8,
      "DEX": 14,
      "CON": 13,
      "INT": 10,
      "WIS": 16,
      "CHA": 12
    },
    "chakraMultiplier": 1.1,
    "chakraMultiplierProvisional": false,
    "primaryNature": "WIND",
    "combatStyle": "Sensorik, Chakraortung, Aufklärung",
    "biography": "Offen, herzlich, abenteuerlustig; Seefahrerfamilie aus Shioura.",
    "notes": "Neues Charakterkonzept; d8-Bonus +1 WIS enthalten.",
    "relationships": "Team und Sensei offen.",
    "startingJutsuNames": [
      "Chakura Kanchi",
      "Kaze no Shirabe"
    ]
  }
] as const satisfies readonly GeninSeed[];

export const abilityModifier = (score: number) => Math.floor((score - 10) / 2);
export const geninMaxHp = (genin: GeninSeed) => genin.hitDie + abilityModifier(genin.abilities.CON);
export const geninAc = (genin: GeninSeed) => 12 + abilityModifier(genin.abilities.DEX);

/**
 * Supply a Prisma adapter that maps these values onto actual schema fields.
 * Use a unique key (seedKey or stable NPC external ID) and upsert or create-if-missing.
 * DO NOT overwrite progressed player/DM-edited NPCs on later runs.
 * Do not grant latent Nikkōton to Akito or unapproved Jutsu.
 * Resolve Jutsu references by existing IDs, never blindly duplicate the library.
 */
export async function seedShiogakureGenin(
  createIfMissing: (genin: GeninSeed) => Promise<unknown>,
): Promise<void> {
  for (const genin of SHIOGAKURE_GENIN) {
    await createIfMissing(genin);
  }
}
