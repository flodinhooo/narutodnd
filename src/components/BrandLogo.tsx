import Image from "next/image";
import Link from "next/link";
export default function BrandLogo() {
  return <Link className="brand-logo" href="/" aria-label="Shio no Kuni – Naruto D&D, Startseite"><Image src="/branding/logo-dark.png" alt="Sonne-Berg-Emblem von Shiogakure" width={56} height={56} priority /><span><strong>Shio no Kuni</strong><small>Shiogakure · Naruto D&amp;D</small></span></Link>;
}
