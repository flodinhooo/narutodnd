import {afterAll, beforeAll, beforeEach, expect, it, vi} from "vitest";
import {PrismaClient} from "@prisma/client";
import {mkdtemp, readdir, readFile, rm} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {renderToStaticMarkup} from "react-dom/server";
const {db, actor} = vi.hoisted(()=>({db:{client:null as unknown as PrismaClient},actor:{role:"DM"}}));
vi.mock("@/lib/prisma",()=>({get prisma(){return db.client;}}));
vi.mock("@/lib/session",()=>({getSession:vi.fn(async()=>({campaignId:"a",role:actor.role})),requireCampaign:vi.fn(async(id:string,dm:boolean)=>{if(id!=="a"||(dm&&actor.role!=="DM"))throw Error("Unauthorized");})}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("next/navigation",()=>({notFound:()=>{throw Error("NOT_FOUND");}}));
import {setJutsuRelease} from "./jutsu-library-actions";
import {playerJutsuScope,creatorJutsuScope} from "@/lib/jutsu-access";
import Detail from "./[campaignId]/jutsu-library/[slug]/page";
let directory:string;
const releaseForm=(yes=true)=>{const f=new FormData();f.set("release",yes?"yes":"no");return f;};
beforeAll(async()=>{
 directory=await mkdtemp(join(tmpdir(),"jutsu-access-"));
 db.client=new PrismaClient({datasourceUrl:`file:${join(directory,"test.sqlite").replaceAll("\\","/")}`});
 for(const dir of (await readdir("prisma/migrations")).filter(x=>/^\d/.test(x)).sort())for(const sql of (await readFile(join("prisma/migrations",dir,"migration.sql"),"utf8")).replace(/^\s*--.*$/gm,"").split(";").map(x=>x.trim()).filter(Boolean))await db.client.$executeRawUnsafe(sql);
 for(const id of ["a","b"])await db.client.campaign.create({data:{id,name:id,dmCodeHash:id,playerCodeHash:id,jutsuLibraryAccess:"OPEN"}});
 for(const [id,extra] of [["released",{}],["learned",{}],["hidden",{}],["npc-only",{}],["secret",{dmOnly:true}],["review",{reviewNeeded:true}],["foreign",{campaignId:"b"}]] as const)await db.client.jutsu.create({data:{id,slug:id,name:id,germanName:`DE-${id}`,description:"Du bewegst dich drei Meter.",rank:"D",chakraCost:8,range:"Self",duration:"Instantaneous",actionType:"Bonus Action",sourceMarkdown:"PRIVATE_SOURCE_SENTINEL",...extra}});
 await db.client.character.create({data:{id:"student",campaignId:"a",name:"Student",jutsuLinks:{create:{jutsuId:"learned"}}}});
 await db.client.character.create({data:{id:"hidden-npc",campaignId:"a",name:"Hidden NPC",jutsuLinks:{create:{jutsuId:"npc-only"}}}});
 await db.client.npc.create({data:{name:"Hidden NPC",campaignId:"a",characterId:"hidden-npc",playerVisible:false}});
 await setJutsuRelease("a","released",releaseForm());
},60000);
beforeEach(()=>{actor.role="DM";});
afterAll(async()=>{await db.client.$disconnect();await rm(directory,{recursive:true,force:true});});
it("returns only released or learned techniques for players and the creator",async()=>{
 const visible=await db.client.jutsu.findMany({where:playerJutsuScope("a")});
 expect(visible.map(j=>j.id).sort()).toEqual(["learned","released"]);
 const choices=await db.client.jutsu.findMany({where:creatorJutsuScope("a",false)});
 expect(choices.map(j=>j.id).sort()).toEqual(["learned","released"]);
});
it("blocks direct hidden URLs and does not render original sources for players",async()=>{
 actor.role="PLAYER";
 for(const slug of ["hidden","npc-only","secret","review","foreign"])await expect(Detail({params:Promise.resolve({campaignId:"a",slug})})).rejects.toThrow("NOT_FOUND");
 const html=renderToStaticMarkup(await Detail({params:Promise.resolve({campaignId:"a",slug:"released"})}));
 expect(html).toContain("DE-released");expect(html).not.toContain("PRIVATE_SOURCE_SENTINEL");
});
it("prevents player mutations, cross-campaign releases and unsafe imports",async()=>{
 actor.role="PLAYER";await expect(setJutsuRelease("a","hidden",releaseForm())).rejects.toThrow("Unauthorized");actor.role="DM";
 for(const id of ["secret","review","foreign"])await expect(setJutsuRelease("a",id,releaseForm())).rejects.toThrow();
});
it("keeps learned techniques known when their library release is withdrawn",async()=>{
 await setJutsuRelease("a","learned",releaseForm());await setJutsuRelease("a","learned",releaseForm(false));
 expect(await db.client.jutsu.count({where:{AND:[playerJutsuScope("a"),{id:"learned"}]}})).toBe(1);
 await setJutsuRelease("a","hidden",releaseForm());await setJutsuRelease("a","hidden",releaseForm(false));
 expect(await db.client.jutsu.count({where:{AND:[playerJutsuScope("a"),{id:"hidden"}]}})).toBe(0);
});
