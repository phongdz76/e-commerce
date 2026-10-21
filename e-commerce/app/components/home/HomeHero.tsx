import Image from "next/image";
import Link from "next/link";
import { FiArrowUpRight, FiTruck, FiRefreshCw, FiCreditCard, FiMessageCircle } from "react-icons/fi";
import type { CatalogGroup } from "@/types/catalog";
import { resolveHomeContent } from "@/utils/homepageContent";
import { starterHomeContent } from "@/utils/homepageStarter";
import type { ResolvedHomeContent } from "@/types/homepageContent";
import HomeCarousel from "./HomeCarousel";
import HomeCollectionSlide from "./HomeCollectionSlide";

export default function HomeHero({ categories, content }: { categories: CatalogGroup[]; content?: ResolvedHomeContent }) {
  const settings = content ?? resolveHomeContent(starterHomeContent(), { categories, brands: [] });
  return <>
    <div className={`
      home-intro flex justify-between items-center gap-[16px] py-[22px] px-0 text-[10px] font-semibold
      tracking-[.14em] text-[#64748b] [&_a]:flex [&_a]:items-center [&_a]:gap-[7px] [&_a]:tracking-normal
      [&_a]:text-[12px] [&_a]:text-[#0f766e] max-[540px]:py-[16px] max-[540px]:px-0 max-[540px]:text-[8px]
      max-[540px]:tracking-[.07em] max-[540px]:[&_a]:hidden
    `}><span>EVERYDAY TECH. EXTRAORDINARY POSSIBILITIES.</span><Link href="/products">Discover SGTech <FiArrowUpRight aria-hidden="true" /></Link></div>
    <section className="home-bento grid [grid-template-columns:1.85fr_1fr] gap-[16px] max-[800px]:[grid-template-columns:1fr] max-[540px]:gap-[12px]" aria-labelledby="home-title" style={!settings.heroTiles.length ? { gridTemplateColumns: "1fr" } : undefined}>
      <HomeCarousel slides={settings.slides.map((collection, index) => <HomeCollectionSlide key={collection.id} collection={collection} first={index === 0} />)} />
      {settings.heroTiles.length > 0 && <div className={`
      home-sideStack grid [grid-template-rows:1fr_1fr] gap-[16px] min-w-0 max-[800px]:[grid-template-columns:1fr_1fr]
      max-[800px]:[grid-template-rows:1fr] max-[540px]:gap-[12px]
    `}>
        {settings.heroTiles.map(tile => <Link key={tile.id} href={tile.href} className={"home-sideCard relative isolate overflow-hidden rounded-[20px] p-[26px] flex items-center [transition:box-shadow_.18s] [&:hover]:shadow-[0_6px_22px_#33415516] [&>div]:relative [&>div]:z-[2] [&_.home-eyebrow]:text-[8px] [&_.home-eyebrow]:tracking-[.1em] [&_h2]:text-[24px] [&_h2]:font-semibold [&_h2]:leading-[1.25] [&_h2]:tracking-[-.035em] [&_h2]:mt-[10px] [&_h2]:mx-0 [&_h2]:mb-[18px] [&>img]:left-auto! [&>img]:right-[-5%]! [&>img]:w-[52%]! [&>img]:object-contain [&>img]:py-[16px] [&>img]:px-0 [&>img]:[mix-blend-mode:multiply] [&>img]:z-[-1] [&>img]:[transition:transform_.2s] [&:hover>img]:[transform:translateY(-3px)] max-[1100px]:p-[22px] max-[1100px]:[&_h2]:text-[22px] max-[1100px]:[&_.home-eyebrow]:max-w-[130px] max-[1100px]:[&_.home-eyebrow]:leading-[1.6] max-[1100px]:[&>img]:right-[-10%]! max-[1100px]:[&>img]:w-[55%]! max-[800px]:min-h-[190px] max-[800px]:[&>img]:right-[-7%]! max-[540px]:min-h-[210px] max-[540px]:py-[18px] max-[540px]:px-[14px] max-[540px]:items-start max-[540px]:rounded-[16px] max-[540px]:[&_h2]:text-[20px] max-[540px]:[&_h2]:mt-[8px] max-[540px]:[&_h2]:mx-0 max-[540px]:[&_h2]:mb-[10px] max-[540px]:[&_.home-eyebrow]:text-[6px] max-[540px]:[&_.home-eyebrow]:tracking-[.08em] max-[540px]:[&_.home-textCta]:text-[9px] max-[540px]:[&_.home-textCta]:gap-[3px] max-[540px]:[&>img]:top-auto! max-[540px]:[&>img]:bottom-[8px]! max-[540px]:[&>img]:right-[-4%]! max-[540px]:[&>img]:h-[40%]! max-[540px]:[&>img]:w-[80%]! max-[540px]:[&>img]:p-0 max-[540px]:[&>img]:opacity-[.95] max-[350px]:[&_h2]:text-[18px] max-[350px]:[&_.home-textCta]:text-[8px]" + " " + (tile.tone === "audio" ? "home-audioCard [background:#e9eef6]" : "home-laptopCard [background:#f3eee6]")}>
          <div><span className="home-eyebrow inline-flex items-center gap-[7px] text-[9px] font-semibold tracking-[.12em]">{tile.eyebrow}</span><h2 className="whitespace-pre-line">{tile.title}</h2><span className="home-textCta inline-flex items-center gap-[8px] text-[11px] font-medium">{tile.cta}<FiArrowUpRight aria-hidden="true" /></span></div>
          <Image src={tile.image.src} alt={tile.image.alt} fill sizes="(max-width: 600px) 40vw, 210px" />
        </Link>)}
      </div>}
    </section>
    <nav aria-label="Shopping help" className={`
      home-services grid [grid-template-columns:repeat(4,_minmax(0,_1fr))] mt-[18px] py-[22px] px-[8px]
      [border:1px_solid_#e2e8f0] rounded-[14px] [background:#fff] [&_a]:flex [&_a]:items-center [&_a]:gap-[12px]
      [&_a]:py-0 [&_a]:px-[18px] [&_a]:[border-right:1px_solid_#e2e8f0] [&_a:last-child]:[border:0]
      [&_a>svg:first-child]:w-[23px] [&_a>svg:first-child]:h-[23px] [&_a>svg:first-child]:shrink-0
      [&_a>svg:first-child]:text-[#0f766e] [&_strong]:block [&_strong]:text-[11px] [&_strong]:font-semibold
      [&_small]:block [&_small]:text-[9px] [&_small]:text-[#64748b] [&_small]:mt-[4px] [&_small]:leading-[1.6]
      max-[1100px]:[&_a]:py-0 max-[1100px]:[&_a]:px-[10px] max-[1100px]:[&_a]:gap-[8px]
      max-[1100px]:[&_small]:text-[8px] max-[800px]:[grid-template-columns:1fr_1fr] max-[800px]:gap-[20px_0]
      max-[800px]:py-[18px] max-[800px]:px-[8px] max-[800px]:[&_a:nth-child(2)]:[border:0]
      max-[800px]:[&_small]:text-[9px] max-[540px]:mt-[12px] max-[540px]:gap-[18px_0] max-[540px]:rounded-[12px]
      max-[540px]:[&_a]:py-0 max-[540px]:[&_a]:px-[9px] max-[540px]:[&_a]:gap-[8px]
      max-[540px]:[&_a>svg:first-child]:w-[18px] max-[540px]:[&_a>svg:first-child]:h-[18px]
      max-[540px]:[&_strong]:text-[9px] max-[540px]:[&_small]:text-[8px] max-[540px]:[&_small]:leading-[1.5]
      max-[350px]:[&_a]:py-0 max-[350px]:[&_a]:px-[6px] max-[350px]:[&_a]:gap-[6px] max-[350px]:[&_strong]:text-[8px]
      max-[350px]:[&_small]:text-[7px]
    `}>
      {[
        { Icon: FiTruck, title: "Shipping & delivery", text: "Explore delivery information", href: "/help/shipping" },
        { Icon: FiRefreshCw, title: "Returns & exchanges", text: "Find the right next step", href: "/help/returns" },
        { Icon: FiCreditCard, title: "Payment information", text: "Your checkout questions, answered", href: "/help/faq" },
        { Icon: FiMessageCircle, title: "Here to help", text: "Contact our support team", href: "/help/contact" },
      ].map(({ Icon, title, text, href }) => <Link key={href} href={href}><Icon aria-hidden="true" /><span><strong>{title}</strong><small>{text}</small></span><FiArrowUpRight className="home-serviceArrow hidden" aria-hidden="true" /></Link>)}
    </nav>
  </>;
}
