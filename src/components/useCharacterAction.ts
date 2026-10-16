"use client";
import {useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {toast} from "react-toastify";
import type {PlayerResponse} from "@/lib/player-character";

export function useCharacterAction(scope:string){
 const router=useRouter();const busy=useRef(false);const ids=useRef(new Map<string,string>());const [pending,setPending]=useState(false);
 async function run(key:string,action:(requestId:string)=>Promise<PlayerResponse>){
  if(busy.current)return null;
  busy.current=true;setPending(true);
  const storageKey=`character-action:${scope}:${key}`;
  let id=ids.current.get(key);
  try{if(!id)id=sessionStorage.getItem(storageKey)||undefined;}catch{}
  id ||= crypto.randomUUID();ids.current.set(key,id);
  try{sessionStorage.setItem(storageKey,id);}catch{}
  try{
   const result=await action(id);
   if(result.ok||!result.retryable){ids.current.delete(key);try{sessionStorage.removeItem(storageKey);}catch{}}
   if(result.ok)toast.success(result.message);else toast.error(result.message);
   router.refresh();
   return result;
  }catch{toast.error("Keine Bestätigung erhalten. Erneut klicken, um dieselbe Aktion zu prüfen.");return null;}
  finally{busy.current=false;setPending(false);}
 }
 return {pending,run};
}
