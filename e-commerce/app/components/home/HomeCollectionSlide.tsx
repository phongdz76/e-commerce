import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiArrowRight } from "react-icons/fi";
import type { ResolvedHomeSlide } from "@/types/homepageContent";
import { homeHeroImage } from "@/utils/homeHeroImages";

interface HomeCollectionSlideProps {
  collection: ResolvedHomeSlide;
  first?: boolean;
}

export default function HomeCollectionSlide({
  collection,
  first = false,
}: HomeCollectionSlideProps) {
  const Heading = first ? "h1" : "h2";
  const intro = collection.art === "intro";

  const theme = {
    "--hero-surface": collection.surface,
    "--hero-glow": collection.glow,
    "--hero-ring": collection.ring,
    "--hero-halo": collection.halo,
  } as CSSProperties;

  return (
    <div
      className="home-hero relative isolate min-h-[440px] max-[800px]:min-h-[380px] max-[540px]:min-h-[580px] max-[350px]:min-h-[540px] overflow-hidden rounded-2xl p-6 sm:p-8 lg:p-10 pb-16 max-[540px]:pb-10"
      style={{
        ...theme,
        background: `radial-gradient(ellipse at 85% 45%, var(--hero-glow, #d0f0ed), transparent 65%), var(--hero-surface, #edf4f4)`,
      }}
      data-home-collection={intro ? undefined : collection.id}
    >
      <div className="home-heroCopy relative z-10 w-full sm:w-[55%] lg:w-[48%]">
        <span className="home-eyebrow inline-flex items-center gap-2 text-[10px] font-semibold tracking-wider text-teal-800 uppercase">
          <span className="home-liveDot h-1.5 w-1.5 rounded-full bg-teal-600" />
          {collection.eyebrow}
        </span>

        <Heading
          id={first ? "home-title" : undefined}
          className="home-collectionTitle mt-4 mb-3 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-800 leading-tight [&_em]:text-teal-700 [&_em]:not-italic"
        >
          {collection.title[0]}
          <br />
          {collection.title[1]}
          <br /> <em>{collection.title[2]}</em>
        </Heading>

        <p className="mb-6 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-sm">
          {collection.description[0]}
          <br />
          {collection.description[1]}
        </p>

        <Link
          className="home-primaryButton inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800"
          href={collection.href}
        >
          <span>{collection.cta}</span>
          <FiArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>

      <div
        className="home-heroArt absolute z-0 right-4 top-8 bottom-16 w-[45%] max-[540px]:relative max-[540px]:right-auto max-[540px]:top-auto max-[540px]:bottom-auto max-[540px]:w-full max-[540px]:max-w-[320px] max-[540px]:h-[220px] max-[540px]:mt-6 max-[540px]:mx-auto"
        data-art={collection.art}
        data-paired={Boolean(collection.companion)}
      >
        <span
          className="home-orbit absolute w-[90%] aspect-square top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--hero-ring,#aacfc7)] shadow-[0_0_0_20px_var(--hero-halo,#cde7df33)]"
          aria-hidden="true"
        />

        <div className="home-heroDevices absolute inset-0">
          <div className="home-collectionMain absolute top-0 right-0 w-[82%] h-[92%] -rotate-6">
            <Image
              src={homeHeroImage(collection.main.src)}
              alt={collection.main.alt}
              fill
              loading={first ? "eager" : "lazy"}
              fetchPriority={first ? "high" : "auto"}
              sizes="(max-width: 540px) 260px, (max-width: 800px) 45vw, 390px"
              className="object-contain drop-shadow-md"
            />
          </div>

          {collection.companion && (
            <div className="home-collectionCompanion absolute z-10 left-0 bottom-0 w-[52%] h-[72%] rotate-6">
              <Image
                src={homeHeroImage(collection.companion.src)}
                alt={collection.companion.alt}
                fill
                sizes="(max-width: 540px) 170px, 230px"
                className="object-contain drop-shadow-md"
              />
            </div>
          )}
        </div>

        <span className="home-artCaption absolute bottom-0 left-0 w-full text-center text-[9px] tracking-widest text-teal-800 uppercase">
          {collection.caption}
        </span>
      </div>
    </div>
  );
}
