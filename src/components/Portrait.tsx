"use client";
/* eslint-disable @next/next/no-img-element -- authenticated, private image endpoint */
import { useState } from "react";
export default function Portrait({ campaignId, kind, entityId, name, revision = 0 }: { campaignId: string; kind: string; entityId: string; name: string; revision?: number }) {
  const src = `/api/campaign/${encodeURIComponent(campaignId)}/portraits/${encodeURIComponent(kind)}/${encodeURIComponent(entityId)}?default=1&v=${revision}`;
  const [failed, setFailed] = useState("");
  return <span className="portrait" role="img" aria-label={`Portrait: ${name}`}>{failed === src ? <span aria-hidden="true">{name.trim().slice(0, 2).toUpperCase() || "?"}</span> : <img key={src} src={src} alt="" loading="lazy" onError={() => setFailed(src)} />}</span>;
}
