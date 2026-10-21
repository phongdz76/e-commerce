import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiArrowRight } from "react-icons/fi";
import type { ResolvedHomeSlide } from "@/types/homepageContent";
import { homeHeroImage } from "@/utils/homeHeroImages";


export default function HomeCollectionSlide({ collection, first = false }: {
  collection: ResolvedHomeSlide; first?: boolean;
}) {
  const Heading = first ? "h1" : "h2";
  const intro = collection.art === "intro";
  const theme = {
    "--hero-surface": collection.surface, "--hero-glow": collection.glow,
    "--hero-ring": collection.ring, "--hero-halo": collection.halo,
  } as CSSProperties;
  return <div className={`
      home-hero relative isolate overflow-hidden min-h-[420px] p-[38px] rounded-[24px]
      [background:radial-gradient(ellipse_at_85%_45%,_var(--hero-glow,_#d0f0ed),_transparent_65%),_var(--hero-surface,_#edf4f4)]
      [&_h1]:mt-[22px] [&_h1]:mx-0 [&_h1]:mb-[18px] [&_h1]:text-[clamp(36px,_3.6vw,_53px)] [&_h1]:font-semibold
      [&_h1]:leading-[1.12] [&_h1]:tracking-[-.055em] [&_h1]:text-[#1e293b] [&_h1_em]:text-[#0f766e]
      [&_h1_em]:not-italic [&_p]:text-[12px] [&_p]:leading-[1.8] [&_p]:text-[#475569] [&_p]:mb-[24px]
      max-[1100px]:p-[28px] max-[1100px]:[&_.home-eyebrow]:text-[8px] max-[1100px]:[&_.home-eyebrow]:tracking-[.04em]
      max-[800px]:min-h-[380px] max-[800px]:p-[32px] max-[800px]:[&_h1]:text-[48px] max-[540px]:min-h-[580px]
      max-[540px]:p-[26px] max-[540px]:rounded-[20px] max-[540px]:[&_h1]:text-[43px] max-[540px]:[&_h1]:mt-[20px]
      max-[540px]:[&_h1]:mx-0 max-[540px]:[&_h1]:mb-[14px] max-[540px]:[&_p]:text-[11px] max-[540px]:[&_p]:mb-[18px]
      max-[350px]:p-[22px] max-[350px]:min-h-[540px] max-[350px]:[&_h1]:text-[38px]
      max-[350px]:[&_.home-eyebrow]:text-[7px]
    `} style={theme} data-home-collection={intro ? undefined : collection.id}>
    <div className="home-heroCopy relative z-[2] w-[48%] max-[1100px]:w-[60%] max-[800px]:w-[52%] max-[540px]:w-full max-[540px]:pl-[18px] max-[350px]:pl-[22px]">
      <span className="home-eyebrow inline-flex items-center gap-[7px] text-[9px] font-semibold tracking-[.12em]"><span className="home-liveDot w-[6px] h-[6px] shrink-0 [background:#0f766e] rounded-[50%]" />{collection.eyebrow}</span>
      <Heading id={first ? "home-title" : undefined} className={`
      home-collectionTitle mt-[22px] mx-0 mb-[18px] text-[clamp(36px,_3.6vw,_53px)] font-semibold leading-[1.12]
      tracking-[-.055em] text-[#1e293b] [&_em]:text-[#0f766e] [&_em]:not-italic max-[800px]:text-[48px]
      max-[540px]:text-[43px] max-[540px]:mt-[20px] max-[540px]:mx-0 max-[540px]:mb-[14px] max-[350px]:text-[38px]
    `}>{collection.title[0]}<br />{collection.title[1]}<br /> <em>{collection.title[2]}</em></Heading>
      <p>{collection.description[0]}<br />{collection.description[1]}</p>
      <Link className={`
      home-primaryButton min-h-[44px] inline-flex justify-center items-center gap-[16px] py-[12px] px-[18px]
      rounded-[10px] [background:#0f766e] text-[white] text-[12px] font-medium [transition:background_.18s]
      [&:hover]:[background:#115e59]
    `} href={collection.href}>{collection.cta}<FiArrowRight aria-hidden="true" /></Link>
    </div>
    <div className={`
      home-heroArt absolute z-[1] right-[22px] top-[34px] bottom-[64px] w-[48%]
      [&[data-art=phones]_.home-collectionMain]:w-[77%]
      [&[data-art=phones]_.home-collectionMain]:[transform:rotate(5deg)]
      [&[data-art=phones]_.home-collectionCompanion]:w-[54%] [&[data-art=phones]_.home-collectionCompanion]:h-[80%]
      [&[data-art=phones]_.home-collectionCompanion]:[transform:rotate(-5deg)]
      [&:is([data-art=intro],_[data-art=laptops])_.home-collectionMain]:w-full
      [&:is([data-art=intro],_[data-art=laptops])_.home-collectionMain]:h-[92%]
      [&:is([data-art=intro],_[data-art=laptops])_.home-collectionMain]:[transform:rotate(-5deg)_translateY(-8%)]
      [&[data-art=intro]_.home-collectionCompanion]:w-[57%] [&[data-art=intro]_.home-collectionCompanion]:h-[84%]
      [&[data-art=laptops]_.home-collectionCompanion]:w-[72%] [&[data-art=laptops]_.home-collectionCompanion]:h-[63%]
      [&[data-art=laptops]_.home-collectionCompanion]:[transform:rotate(5deg)_translateY(5%)]
      [&:is([data-art=audio],_[data-art=watches])_.home-collectionMain]:w-[75%]
      [&:is([data-art=audio],_[data-art=watches])_.home-collectionMain]:h-[90%]
      [&:is([data-art=audio],_[data-art=watches])_.home-collectionMain]:[transform:rotate(5deg)]
      [&:is([data-art=audio],_[data-art=watches])_.home-collectionCompanion]:w-[50%]
      [&:is([data-art=audio],_[data-art=watches])_.home-collectionCompanion]:h-[72%]
      [&:is([data-art=audio],_[data-art=watches])_.home-collectionCompanion]:[transform:rotate(-6deg)]
      [&[data-art=workspace]_.home-collectionMain]:w-full [&[data-art=workspace]_.home-collectionMain]:h-[96%]
      [&[data-art=workspace]_.home-collectionMain]:[transform:rotate(-4deg)]
      [&[data-art=workspace]_.home-collectionCompanion]:w-[38%]
      [&[data-art=workspace]_.home-collectionCompanion]:h-[40%]
      [&[data-paired=false]_.home-collectionMain]:[inset:0_0_8%] [&[data-paired=false]_.home-collectionMain]:w-full
      [&[data-paired=false]_.home-collectionMain]:h-[92%]
      [&[data-paired=false]_.home-collectionMain]:[transform:none] max-[800px]:w-[46%] max-[800px]:right-[24px]
    `} data-art={collection.art} data-paired={Boolean(collection.companion)}>
      <span className={`
      home-orbit absolute w-[96%] [aspect-ratio:1] top-[46%] left-[50%] [transform:translate(-50%,_-50%)]
      rounded-[50%] [border:1px_solid_var(--hero-ring,_#aacfc7)]
      shadow-[0_0_0_20px_var(--hero-halo,_#cde7df33),_0_0_0_40px_var(--hero-halo,_#cde7df33)] max-[540px]:w-[85%]
    `} aria-hidden="true" />
      <div className="home-heroDevices absolute [inset:0_0_24px] [&_img]:object-contain [&_img]:[filter:drop-shadow(0_10px_12px_#1e293b12)]">
        <div className="home-collectionMain absolute top-0 right-0 w-[82%] h-[92%] [transform:rotate(-5deg)]"><Image src={homeHeroImage(collection.main.src)} alt={collection.main.alt} fill loading={first ? "eager" : "lazy"} fetchPriority={first ? "high" : "auto"} sizes="(max-width: 540px) 260px, (max-width: 800px) 45vw, 390px" /></div>
        {collection.companion && <div className="home-collectionCompanion absolute z-[2] left-0 bottom-0 w-[53%] h-[73%] [transform:rotate(5deg)]"><Image src={homeHeroImage(collection.companion.src)} alt={collection.companion.alt} fill sizes="(max-width: 540px) 170px, 230px" /></div>}
      </div>
      <span className="home-artCaption absolute bottom-0 left-0 w-full text-center text-[8px] tracking-[.25em] text-[#426963] max-[540px]:text-[6px]">{collection.caption}</span>
    </div>
  </div>;
}
