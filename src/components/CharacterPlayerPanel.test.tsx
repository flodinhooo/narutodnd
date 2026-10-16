// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
const {action,claim,createClaim,refresh}=vi.hoisted(()=>({action:vi.fn(),claim:vi.fn(),createClaim:vi.fn(),refresh:vi.fn()}));
vi.mock("@/app/character-actions",()=>({characterAction:action,claimCharacter:claim,createCharacterClaim:createClaim}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh})}));
vi.mock("react-toastify",()=>({toast:{success:vi.fn(),error:vi.fn()}}));
import Panel from "./CharacterPlayerPanel";
import JutsuList from "@/app/campaign/[campaignId]/characters/[characterId]/JutsuList";
const props={campaignId:"campaign",characterId:"character",canControl:true,isDm:false,character:{level:1,str:14,dex:16,con:10,int:10,wis:10,cha:10,currentHp:20,shortRestsSinceLongRest:0},items:[],activities:[]};
beforeEach(()=>{vi.clearAllMocks();sessionStorage.clear();action.mockResolvedValue({ok:true,message:"Gespeichert"});vi.spyOn(window,"confirm").mockReturnValue(true);});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it("saves a player's own custom inventory item",async()=>{
 render(<Panel {...props}/>);fireEvent.click(screen.getByRole("button",{name:"Eigener Gegenstand"}));
 fireEvent.change(screen.getByLabelText("Name"),{target:{value:"Mein Glücksbringer"}});
 fireEvent.change(screen.getByLabelText("Beschreibung / Notizen"),{target:{value:"Ein eigener Gegenstand"}});
 fireEvent.click(screen.getByRole("button",{name:"Speichern"}));
 await waitFor(()=>expect(action).toHaveBeenCalledWith("campaign","character",expect.any(String),expect.objectContaining({kind:"SAVE_ITEM",item:expect.objectContaining({name:"Mein Glücksbringer",quantity:1})})));
 expect(refresh).toHaveBeenCalled();
});
it("offers rest actions with confirmation and disables exhausted short rests",async()=>{
 const view=render(<Panel {...props}/>);fireEvent.click(screen.getByRole("button",{name:"Lange Rast"}));
 await waitFor(()=>expect(action).toHaveBeenCalledWith("campaign","character",expect.any(String),{kind:"REST",rest:"LONG"}));
 view.rerender(<Panel {...props} character={{...props.character,shortRestsSinceLongRest:2}}/>);
 expect((screen.getByRole("button",{name:"Kurze Rast"}) as HTMLButtonElement).disabled).toBe(true);
});
it("offers ownership claim without exposing controls on another player's sheet",()=>{
 render(<Panel {...props} canControl={false}/>);
 expect(screen.queryByRole("button",{name:"Lange Rast"})).toBeNull();
 expect(screen.queryByRole("button",{name:"Eigener Gegenstand"})).toBeNull();
 expect(screen.getByLabelText("Übernahmecode der Spielleitung")).toBeTruthy();
});
it("offers Jutsu detail and use, sending only the learned ID rather than client costs",async()=>{
 const j={id:"jutsu",slug:"blitz",name:"Blitz",germanName:"Blitzschritt",rank:"D",chakraCost:8,range:"Self",duration:"Instantaneous",actionType:"Action",attackType:null,damageDice:null,damageType:null,saveAbility:null,description:"Du bewegst dich schnell.",natures:[]};
 render(<JutsuList campaignId="campaign" characterId="character" canControl currentChakra={20} items={[j]}/>);
 expect(screen.getByRole("link",{name:"Detailseite"}).getAttribute("href")).toBe("/campaign/campaign/jutsu-library/blitz");
 fireEvent.click(screen.getByRole("button",{name:"Einsetzen (8 Chakra)"}));
 await waitFor(()=>expect(action).toHaveBeenCalledWith("campaign","character",expect.any(String),{kind:"CAST",jutsuId:"jutsu"}));
});
