import {describe, expect, it} from "vitest";
import {isStartingJutsuAllowed, type StartingJutsu} from "./character-creation";
const jutsu: StartingJutsu={rank:"D",campaignId:null,requiredNatureKeys:null,natures:[{nature:{key:"FIRE",playerSelectable:true}}]};
describe("starting jutsu eligibility",()=>{
 it("allows matching global or current-campaign jutsu",()=>{expect(isStartingJutsuAllowed(jutsu,"a","FIRE")).toBe(true);expect(isStartingJutsuAllowed({...jutsu,campaignId:"a"},"a","FIRE")).toBe(true);});
 it("rejects foreign-campaign, S-rank and incompatible nature",()=>{expect(isStartingJutsuAllowed({...jutsu,campaignId:"b"},"a","FIRE")).toBe(false);expect(isStartingJutsuAllowed({...jutsu,rank:"S"},"a","FIRE")).toBe(false);expect(isStartingJutsuAllowed(jutsu,"a","WATER")).toBe(false);});
 it("rejects indirect special-nature access even with a matching basic nature",()=>{expect(isStartingJutsuAllowed({...jutsu,natures:[...jutsu.natures,{nature:{key:"IRON_RELEASE",playerSelectable:false}}]},"a","FIRE")).toBe(false);});
 it("rejects hidden, unknown or malformed required nature metadata",()=>{for(const requiredNatureKeys of ['["NIKKOTON"]','["UNKNOWN"]','{"FIRE":true}','invalid'])expect(isStartingJutsuAllowed({...jutsu,requiredNatureKeys},"a","FIRE")).toBe(false);});
 it("retains matching-basic-nature selection with multiple basic links",()=>{expect(isStartingJutsuAllowed({...jutsu,requiredNatureKeys:'["FIRE","WATER"]',natures:[...jutsu.natures,{nature:{key:"WATER",playerSelectable:true}}]},"a","FIRE")).toBe(true);});
});
