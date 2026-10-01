import {createHmac, randomInt, timingSafeEqual} from "node:crypto";
import {getHitDieMaximum, getEffectiveHpRoll} from "./rules";

export const rollHitDie = (hitDie: string) => randomInt(1, getHitDieMaximum(hitDie) + 1);
export type AutoHpRoll = {campaignId: string; characterId: string; level: number; hitDie: string; rawRoll: number};

// The HttpOnly session ID never leaves the server. Bind previews to that session
// and the character/level, without storing a confirmed roll before confirmation.
export function signAutoHpRoll(roll: AutoHpRoll, sessionId: string) {
 const payload = Buffer.from(JSON.stringify(roll)).toString("base64url");
 return `${payload}.${createHmac("sha256", sessionId).update(payload).digest("hex")}`;
}
export function verifyAutoHpRoll(token: string, expected: Omit<AutoHpRoll, "rawRoll">, sessionId: string) {
 const [payload, signature, extra] = token.split(".");
 if (!payload || !signature || extra || !/^[a-f0-9]{64}$/.test(signature)) throw new Error("Invalid automatic roll confirmation");
 const actual = createHmac("sha256", sessionId).update(payload).digest();
 if (!timingSafeEqual(actual, Buffer.from(signature, "hex"))) throw new Error("Invalid automatic roll confirmation");
 const roll = JSON.parse(Buffer.from(payload, "base64url").toString()) as AutoHpRoll;
 if (Object.entries(expected).some(([key, value]) => roll[key as keyof AutoHpRoll] !== value)) throw new Error("Automatic roll belongs to another character or level");
 getEffectiveHpRoll(roll.hitDie, roll.rawRoll);
 return roll.rawRoll;
}
