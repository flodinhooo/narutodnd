"use client";
import { useActionState, useEffect } from "react";
import { toast } from "react-toastify";
type State={error?:string;success?:boolean};
export default function ActionForm({action,children,className}:{action:(state:State,formData:FormData)=>Promise<unknown>;children:React.ReactNode;className?:string}){const[state,formAction]=useActionState<State,FormData>(async(previous:State,fd:FormData)=>{try{await action(previous,fd);return{success:true}}catch(error){return{error:error instanceof Error?error.message:"Die Aktion ist fehlgeschlagen."}}},{ });useEffect(()=>{if(state.error)toast.error(state.error);if(state.success)toast.success("Gespeichert.")},[state]);return <form action={formAction} className={className}>{children}</form>}
