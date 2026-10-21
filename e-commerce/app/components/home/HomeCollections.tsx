import Image from "next/image";
import Link from "next/link";
import { FiArrowUpRight } from "react-icons/fi";
import type { ResolvedHomeTile } from "@/types/homepageContent";

export default function HomeCollections({ tiles }: { tiles: ResolvedHomeTile[] }) {
  if (!tiles.length) return null;
  return <div className={`home-section mt-[46px] max-[540px]:mt-[32px] home-collections grid [grid-template-columns:1fr_1fr] gap-[16px] max-[540px]:[grid-template-columns:1fr] max-[540px]:gap-[12px]`}>
    {tiles.map(tile => <Link className={`
      home-collection min-h-[210px] relative overflow-hidden isolate rounded-[20px] p-[28px] [background:#edf1f6]
      [&:nth-child(2)]:[background:#f1f1e9] [&>div]:relative [&>div]:z-[2] [&>div]:w-[60%] [&_h2]:text-[26px]
      [&_h2]:font-semibold [&_h2]:leading-[1.2] [&_h2]:tracking-[-.04em] [&_h2]:mt-[12px] [&_h2]:mx-0
      [&_h2]:mb-[22px] [&_img]:object-contain [&_img]:w-[46%]! [&_img]:left-auto! [&_img]:right-0! [&_img]:p-[20px]
      [&_img]:[mix-blend-mode:multiply] [&_img]:z-[-1] max-[800px]:p-[22px] max-[800px]:min-h-[210px]
      max-[800px]:[&_h2]:text-[22px] max-[800px]:[&>div]:w-[67%] max-[800px]:[&_img]:right-[-8%]!
      max-[800px]:[&_img]:w-[55%]! max-[800px]:[&_img]:p-[12px] max-[540px]:min-h-[180px] max-[540px]:p-[24px]
      max-[540px]:[&_h2]:text-[24px] max-[540px]:[&>div]:w-[58%] max-[540px]:[&_img]:w-[46%]!
      max-[540px]:[&_img]:right-0!
    `} key={tile.id} href={tile.href}>
      <div><span className="home-eyebrow inline-flex items-center gap-[7px] text-[9px] font-semibold tracking-[.12em]">{tile.eyebrow}</span><h2 className="whitespace-pre-line">{tile.title}</h2><span className="home-textCta inline-flex items-center gap-[8px] text-[11px] font-medium">{tile.cta}<FiArrowUpRight aria-hidden="true" /></span></div>
      <Image src={tile.image.src} alt={tile.image.alt} fill sizes="(max-width: 540px) 40vw, 260px" />
    </Link>)}
  </div>;
}
