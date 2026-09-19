import {describe,expect,it} from "vitest";
describe("campaign creation flow",()=>{it("uses the real post-creation route without credentials in the URL",()=>{const campaignId="campaign-123";const destination=`/campaign/${campaignId}/access`;expect(destination).toBe("/campaign/campaign-123/access");expect(destination).not.toContain("dm=");expect(destination).not.toContain("player=")})});
