"use client";
import {useState} from "react";
export default function CopyCode({value}:{value:string}){const [copied,setCopied]=useState(false);return <button type="button" className="button ghost" onClick={async()=>{await navigator.clipboard.writeText(value);setCopied(true)}}>{copied?"Copied":"Copy"}</button>}
