import { cleanJutsuDescription } from "@/lib/jutsu-content";
export default function JutsuRules({description}: {description: string}) {
  return <div className="jutsu-rules">{cleanJutsuDescription(description).split(/\n\n+/).filter(Boolean).map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div>;
}
