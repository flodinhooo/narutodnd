import {isStartingJutsuAllowed} from "@/lib/character-creation";
import {creatorJutsuScope} from "@/lib/jutsu-access";
import {cleanJutsuDescription} from "@/lib/jutsu-content";
import {prisma} from "@/lib/prisma";
import {getSession} from "@/lib/session";
import Creator from "./Creator";
export default async function NewCharacter({params}:{params:Promise<{campaignId:string}>}){
 const {campaignId}=await params;const session=await getSession();if(!session||session.campaignId!==campaignId)return <main className="shell"><h1>Unbefugt</h1></main>;
 const [natures,jutsu]=await Promise.all([prisma.chakraNature.findMany({where:{playerSelectable:true},select:{key:true,displayName:true}}),prisma.jutsu.findMany({where:creatorJutsuScope(campaignId,session.role==="DM"),select:{id:true,name:true,germanName:true,rank:true,chakraCost:true,range:true,actionType:true,description:true,category:true,campaignId:true,requiredNatureKeys:true,dmOnly:true,reviewNeeded:true,natures:{select:{nature:{select:{key:true,displayName:true,playerSelectable:true}}}}}})]);
 return <Creator campaignId={campaignId} natures={natures} jutsu={jutsu.filter(j=>isStartingJutsuAllowed(j,campaignId)).map(j=>({...j,description:cleanJutsuDescription(j.description)}))}/>;
}
