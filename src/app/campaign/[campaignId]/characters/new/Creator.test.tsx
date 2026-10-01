// @vitest-environment jsdom
import {StrictMode} from "react";
import {act, cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {toast} from "react-toastify";
import Creator from "./Creator";
import ToastProvider from "@/components/ToastProvider";
import {creationFailureMessage, natureUnavailableMessage, type CharacterCreationResult} from "@/lib/character-creation";
import {basicNatureKeys, chakraNatureSeed} from "../../../../../../seeding/chakra-natures";

const {createCharacter,push}=vi.hoisted(()=>({createCharacter:vi.fn(),push:vi.fn()}));
vi.mock("@/app/actions",()=>({createCharacter}));
vi.mock("next/navigation",()=>({useRouter:()=>({push})}));
const props={campaignId:"campaign",natures:basicNatureKeys.map(chakraNatureSeed),jutsu:[{id:"fire-jutsu",name:"Fire Strike",germanName:"Feuerstoß",rank:"D",chakraCost:10,range:"Self",actionType:"Action",campaignId:null,requiredNatureKeys:null,natures:[{nature:{key:"FIRE",playerSelectable:true}}]}]};
const next=()=>fireEvent.click(screen.getByRole("button",{name:/^Weiter/}));
const renderFilledCreator=()=>{
 const rendered=render(<StrictMode><Creator {...props}/><ToastProvider/></StrictMode>);
 fireEvent.click(screen.getByRole("button",{name:/D8 - Talentiert/}));next();
 fireEvent.change(screen.getByLabelText("Name"),{target:{value:"Mein Shinobi"}});
 fireEvent.change(screen.getByLabelText("Hintergrund"),{target:{value:"Mein Dorf"}});
 fireEvent.change(screen.getByLabelText("Beschreibung"),{target:{value:"Bleibt erhalten"}});next();
 fireEvent.click(screen.getByRole("button",{name:"CON – Konstitution als Talentbonus"}));
 fireEvent.change(screen.getByLabelText(/CON.*Konstitution/),{target:{value:"13"}});next();
 fireEvent.click(screen.getByRole("checkbox",{name:/^Stärke/}));fireEvent.click(screen.getByRole("checkbox",{name:/Heimlichkeit/}));next();
 fireEvent.change(screen.getByLabelText("Primäre Chakra-Natur"),{target:{value:"FIRE"}});
 fireEvent.change(screen.getByLabelText("Reservoir"),{target:{value:"LOW"}});
 fireEvent.change(screen.getByLabelText("Chakra-Regeneration"),{target:{value:"EXPERT"}});next();
 fireEvent.click(screen.getByRole("checkbox",{name:/Feuerstoß/}));next();
 fireEvent.change(screen.getByLabelText("Bewegung"),{target:{value:"35"}});next();
 return rendered;
};
beforeEach(()=>{vi.clearAllMocks();createCharacter.mockResolvedValue({ok:false,code:"NATURE",message:natureUnavailableMessage});});
afterEach(()=>{toast.dismiss();cleanup();});

it("shows one safe toast after a rejected creation and retains every configured step",async()=>{
 renderFilledCreator();fireEvent.click(screen.getByRole("button",{name:"Charakter erstellen"}));
 await waitFor(()=>expect(screen.getByRole("alert").textContent).toContain(natureUnavailableMessage));
 expect(screen.getAllByRole("alert")).toHaveLength(1);expect(push).not.toHaveBeenCalled();expect(createCharacter).toHaveBeenCalledOnce();
 const fd=createCharacter.mock.calls[0][1] as FormData;
 expect(fd.get("name")).toBe("Mein Shinobi");expect(fd.get("con")).toBe("13");expect(fd.get("hitDieAbilityBonus")).toBe("CON");expect(fd.get("reservoir")).toBe("LOW");expect(fd.get("regen")).toBe("EXPERT");expect(fd.getAll("jutsu")).toEqual(["fire-jutsu"]);
 fireEvent.click(screen.getByRole("button",{name:"2. Grundlagen"}));expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Mein Shinobi");expect((screen.getByLabelText("Beschreibung") as HTMLInputElement).value).toBe("Bleibt erhalten");next();
 expect((screen.getByLabelText(/CON.*Konstitution/) as HTMLInputElement).value).toBe("13");expect(screen.getByRole("button",{name:"CON – Konstitution als Talentbonus"}).getAttribute("aria-pressed")).toBe("true");next();
 expect((screen.getByRole("checkbox",{name:/Heimlichkeit/}) as HTMLInputElement).checked).toBe(true);expect((screen.getByRole("checkbox",{name:/^Stärke/}) as HTMLInputElement).checked).toBe(true);next();
 expect((screen.getByLabelText("Reservoir") as HTMLSelectElement).value).toBe("LOW");expect((screen.getByLabelText("Primäre Chakra-Natur") as HTMLSelectElement).value).toBe("FIRE");next();
 expect((screen.getByRole("checkbox",{name:/Feuerstoß/}) as HTMLInputElement).checked).toBe(true);next();expect((screen.getByLabelText("Bewegung") as HTMLInputElement).value).toBe("35");
});
it("prevents duplicate submissions while the same action is pending",async()=>{
 let finish:(result:CharacterCreationResult)=>void=()=>{};
 createCharacter.mockReturnValueOnce(new Promise<CharacterCreationResult>(resolve=>{finish=resolve;}));
 const {container}=renderFilledCreator();const form=container.querySelector("form")!;fireEvent.submit(form);fireEvent.submit(form);expect(createCharacter).toHaveBeenCalledOnce();
 await act(async()=>{finish({ok:false,code:"NATURE",message:natureUnavailableMessage});});
 await waitFor(()=>expect(screen.getAllByRole("alert")).toHaveLength(1));expect(push).not.toHaveBeenCalled();
});
it("uses a generic German toast for a network failure without losing state",async()=>{
 createCharacter.mockRejectedValueOnce(new Error("Prisma internals must stay hidden"));renderFilledCreator();fireEvent.click(screen.getByRole("button",{name:"Charakter erstellen"}));
 await waitFor(()=>expect(screen.getByRole("alert").textContent).toContain(creationFailureMessage));expect(document.body.textContent).not.toContain("Prisma internals");expect(push).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("button",{name:"2. Grundlagen"}));expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Mein Shinobi");
});
it("navigates only after confirmed successful creation",async()=>{
 createCharacter.mockResolvedValueOnce({ok:true,destination:"/campaign/campaign"});renderFilledCreator();fireEvent.click(screen.getByRole("button",{name:"Charakter erstellen"}));await waitFor(()=>expect(push).toHaveBeenCalledWith("/campaign/campaign"));expect(screen.queryByRole("alert")).toBeNull();
});
it("localizes the required D8 choice and gives point-buy cards working decrement buttons",()=>{
 render(<Creator {...props}/>);fireEvent.click(screen.getByRole("button",{name:/D8 - Talentiert/}));next();next();
 expect(screen.getAllByText("Wähle ein Attribut für deinen +1-Talentbonus.").length).toBeGreaterThan(0);expect(document.body.textContent).not.toContain("D8 requires");
 fireEvent.click(screen.getByRole("button",{name:"STR – Stärke als Talentbonus"}));expect(screen.getByText("Gewählt: STR +1")).not.toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"Punktekauf"}));const increase=screen.getByRole("button",{name:"Stärke erhöhen"}),decrease=screen.getByRole("button",{name:"Stärke senken"});
 expect(decrease.textContent).toBe("−");fireEvent.click(increase);fireEvent.click(decrease);expect(screen.getAllByText("Basis 10 + Talentbonus 1 = 11")).toHaveLength(1);
});
