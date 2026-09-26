export type JutsuSeedOrigin = "CANON" | "SHIO_HOMEBREW" | "FOUNDATION" | "DM_CUSTOM";
export type JutsuSeedPool = "ELEMENTAL" | "CANON" | "FOUNDATION" | "UZUMAKI" | "CHARACTER_SIGNATURE";
export type JutsuSeedRecord = {
  source: JutsuSeedOrigin; pool: JutsuSeedPool; slug: string; name: string;
  germanName?: string | null; englishName?: string | null; japaneseName?: string | null;
  rank?: "E"|"D"|"C"|"B"|"A"|"S"|null; category?: string|null; progressionType?: string|null;
  prerequisiteText?: string|null; chakraCost?: number|null; chakraText?: string|null; actionType?: string|null;
  range?: string|null; duration?: string|null; saveAbility?: string|null; damage?: string|null; attackType?: string|null;
  natures: string[]; requiredNatures?: string[]; traditionProvenance?: string|null; characterOrigin?: string|null;
  rawMarkdown: string; description?: string; role?: string;
};
