type Props = {
  label: string;
  current: number;
  maximum: number;
  kind: "hp" | "chakra";
};

export default function CharacterResourceBar({label, current, maximum, kind}: Props) {
  const value = Math.max(0, Math.min(current, maximum));
  const percent = maximum > 0 ? value / maximum * 100 : 0;

  return <div className={`character-resource character-resource--${kind}`}>
    <div className="character-resource-heading"><span>{label}</span><strong>{current} <span>/ {maximum}</span></strong></div>
    <div className="character-resource-track" role="progressbar" aria-label={label}
         aria-valuemin={0} aria-valuemax={Math.max(0, maximum)} aria-valuenow={value}
         aria-valuetext={`${current} von ${maximum}`}>
      <div className="character-resource-fill" style={{width: `${percent}%`}} />
    </div>
  </div>;
}
