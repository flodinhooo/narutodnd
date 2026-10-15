import { z } from "zod";
export const loreSelectionSchema = z.object({
  npcs: z.array(z.string()).max(1000), organizations: z.array(z.string()).max(1000), relationships: z.array(z.string()).max(5000), combat: z.array(z.string()).max(1000), missions: z.array(z.string()).max(100),
  approveDrafts: z.boolean(), approveCombat: z.boolean(), includeJutsu: z.boolean(),
}).strict().superRefine((s, ctx) => { for (const list of [s.npcs, s.organizations, s.relationships, s.combat, s.missions]) if (new Set(list).size !== list.length) ctx.addIssue({ code: "custom", message: "Doppelte Auswahl." }); });
export type LoreSelection = z.infer<typeof loreSelectionSchema>;
