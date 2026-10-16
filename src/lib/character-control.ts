import {cookies} from "next/headers";
import {createHash, randomBytes} from "node:crypto";

const cookieName = "character_controller";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export async function controllerKey(create = false) {
  const jar = await cookies();
  const existing = jar.get(cookieName)?.value;
  if (existing && /^[a-f0-9]{64}$/.test(existing)) return hash(existing);
  if (!create) return null;
  const token = randomBytes(32).toString("hex");
  jar.set(cookieName, token, {httpOnly:true, secure:process.env.NODE_ENV === "production", sameSite:"lax", path:"/", maxAge:60*60*24*365});
  return hash(token);
}
export function controlsCharacter(character: {portraitOwnerKey: string | null; npc: unknown}, actor: {id:string; role:string}, key: string | null) {
  return actor.role === "DM" || (!character.npc && !!character.portraitOwnerKey && (character.portraitOwnerKey === key || character.portraitOwnerKey === hash(actor.id)));
}
