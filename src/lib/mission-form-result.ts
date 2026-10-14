import { Prisma } from "@prisma/client";
import { EncounterError } from "./encounters";
import type { FormResult } from "@/components/PeopleForm";
export async function missionFormResult(work: () => Promise<string | void>): Promise<FormResult> {
  try { return await work(); } catch (error) {
    if (error instanceof EncounterError) return { error: error.message };
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2003", "P2014", "P2025", "P2034", "P2028"].includes(error.code)) return { error: "Datensatz ist noch verknüpft oder wurde inzwischen geändert. Bitte neu laden und Verweise prüfen." };
    throw error;
  }
}
