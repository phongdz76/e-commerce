import Image from "next/image";
import Link from "next/link";
import {
  FiArrowUpRight,
  FiTruck,
  FiRefreshCw,
  FiCreditCard,
  FiMessageCircle,
} from "react-icons/fi";
import type { CatalogGroup } from "@/types/catalog";
import { resolveHomeContent } from "@/utils/homepageContent";
import { starterHomeContent } from "@/utils/homepageStarter";
import type { ResolvedHomeContent } from "@/types/homepageContent";
import HomeCarousel from "./HomeCarousel";
import HomeCollectionSlide from "./HomeCollectionSlide";

interface HomeHeroProps {
  categories: CatalogGroup[];
  content?: ResolvedHomeContent;
}

export default function HomeHero({ categories, content }: HomeHeroProps) {
  const settings =
    content ?? resolveHomeContent(starterHomeContent(), { categories, brands: [] });

  return (
    <>
      <div className="home-intro flex items-center justify-between gap-4 py-4 text-xs font-semibold tracking-wider text-slate-500">
        <span>EVERYDAY TECH. EXTRAORDINARY POSSIBILITIES.</span>
        <Link
          href="/products"
          className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800 hover:underline"
        >
          <span>Discover SGTech</span>
          <FiArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
        </Link>
      </div>

      <section
        className={`home-bento grid gap-4 ${
          settings.heroTiles.length > 0
            ? "grid-cols-1 lg:grid-cols-[1.85fr_1fr]"
            : "grid-cols-1"
        }`}
        aria-labelledby="home-title"
      >
        <HomeCarousel
          slides={settings.slides.map((collection, index) => (
            <HomeCollectionSlide
              key={collection.id}
              collection={collection}
              first={index === 0}
            />
          ))}
        />

        {settings.heroTiles.length > 0 && (
          <div className="home-sideStack grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 min-w-0">
            {settings.heroTiles.map((tile) => (
              <Link
                key={tile.id}
                href={tile.href}
                className={`home-sideCard group relative isolate flex items-center justify-between overflow-hidden rounded-2xl p-6 transition duration-200 hover:shadow-md ${
                  tile.tone === "audio"
                    ? "home-audioCard bg-slate-100/90 hover:bg-slate-200/80"
                    : "home-laptopCard bg-stone-100 hover:bg-stone-200/80"
                }`}
              >
                <div className="relative z-10 max-w-[55%]">
                  <span className="home-eyebrow text-[10px] font-semibold tracking-wider uppercase text-slate-500">
                    {tile.eyebrow}
                  </span>
                  <h2 className="mt-1.5 mb-3 text-lg font-bold tracking-tight text-slate-800 leading-snug whitespace-pre-line">
                    {tile.title}
                  </h2>
                  <span className="home-textCta inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 group-hover:text-teal-800">
                    {tile.cta}
                    <FiArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                  </span>
                </div>

                <div className="relative h-28 w-28 shrink-0 transition-transform duration-200 group-hover:scale-105">
                  <Image
                    src={tile.image.src}
                    alt={tile.image.alt}
                    fill
                    sizes="(max-width: 600px) 40vw, 210px"
                    className="object-contain mix-blend-multiply"
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <nav
        aria-label="Shopping help"
        className="home-services mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        {[
          {
            Icon: FiTruck,
            title: "Shipping & delivery",
            text: "Explore delivery information",
            href: "/help/shipping",
          },
          {
            Icon: FiRefreshCw,
            title: "Returns & exchanges",
            text: "Find the right next step",
            href: "/help/returns",
          },
          {
            Icon: FiCreditCard,
            title: "Payment information",
            text: "Your checkout questions, answered",
            href: "/help/faq",
          },
          {
            Icon: FiMessageCircle,
            title: "Here to help",
            text: "Contact our support team",
            href: "/help/contact",
          },
        ].map(({ Icon, title, text, href }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 p-2 transition hover:bg-slate-50 rounded-lg group"
          >
            <Icon
              aria-hidden="true"
              className="h-6 w-6 text-teal-700 shrink-0 group-hover:scale-110 transition-transform"
            />
            <div>
              <strong className="block text-xs font-semibold text-slate-800">
                {title}
              </strong>
              <small className="block text-[11px] text-slate-500 mt-0.5">
                {text}
              </small>
            </div>
            <FiArrowUpRight
              className="home-serviceArrow ml-auto hidden text-slate-400 group-hover:text-teal-700"
              aria-hidden="true"
            />
          </Link>
        ))}
      </nav>
    </>
  );
}
