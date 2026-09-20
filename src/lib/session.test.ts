import { describe, expect, it } from "vitest";
import { accessCodeLookup, hashCode, resolveCampaignAccess } from "./session";

const dmCode = "DM-ABC123";
const playerCode = "P-DEF456";
const campaign = { dmCodeLookup: accessCodeLookup(dmCode), playerCodeLookup: accessCodeLookup(playerCode), dmCodeHash: hashCode(dmCode), playerCodeHash: hashCode(playerCode) };

describe("campaign access credentials", () => {
  it("resolves a DM code to the DM role", () => expect(resolveCampaignAccess(dmCode, campaign)).toBe("DM"));
  it("resolves a player code to the PLAYER role", () => expect(resolveCampaignAccess(playerCode, campaign)).toBe("PLAYER"));
  it("rejects unknown, malformed, and campaign ID credentials", () => {
    expect(resolveCampaignAccess("unknown", campaign)).toBeNull();
    expect(resolveCampaignAccess("DM-", campaign)).toBeNull();
    expect(resolveCampaignAccess("campaign-id", campaign)).toBeNull();
  });
  it("does not permit a lookup fingerprint to bypass hash verification", () => {
    expect(resolveCampaignAccess(dmCode, { ...campaign, dmCodeHash: hashCode("DM-WRONG") })).toBeNull();
  });
  it("normalizes surrounding whitespace without storing plaintext", () => {
    expect(resolveCampaignAccess(` ${dmCode} `, campaign)).toBe("DM");
    expect(JSON.stringify(campaign)).not.toContain(dmCode);
    expect(JSON.stringify(campaign)).not.toContain(playerCode);
  });
  it("keeps DM and player lookup values distinct", () => expect(campaign.dmCodeLookup).not.toBe(campaign.playerCodeLookup));
});
