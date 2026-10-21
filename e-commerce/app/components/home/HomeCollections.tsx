import Image from "next/image";
import Link from "next/link";
import { FiArrowUpRight } from "react-icons/fi";
import type { ResolvedHomeTile } from "@/types/homepageContent";

interface HomeCollectionsProps {
  tiles: ResolvedHomeTile[];
}

export default function HomeCollections({ tiles }: HomeCollectionsProps) {
  if (!tiles.length) return null;

  return (
    <div className="home-section home-collections mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
      {tiles.map((tile, index) => (
        <Link
          key={tile.id}
          href={tile.href}
          className={`home-collection group relative isolate flex items-center justify-between overflow-hidden rounded-2xl p-6 sm:p-8 transition duration-200 hover:shadow-md ${
            index % 2 === 0
              ? "bg-slate-100 hover:bg-slate-200/80"
              : "bg-stone-100 hover:bg-stone-200/80"
          }`}
        >
          <div className="relative z-10 max-w-[60%]">
            <span className="home-eyebrow text-[10px] font-semibold tracking-wider uppercase text-slate-500">
              {tile.eyebrow}
            </span>
            <h2 className="mt-2 mb-4 text-xl sm:text-2xl font-bold tracking-tight text-slate-800 leading-snug whitespace-pre-line">
              {tile.title}
            </h2>
            <span className="home-textCta inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 group-hover:text-teal-800">
              {tile.cta}
              <FiArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </span>
          </div>

          <div className="relative h-36 w-36 sm:h-44 sm:w-44 shrink-0 transition-transform duration-200 group-hover:scale-105">
            <Image
              src={tile.image.src}
              alt={tile.image.alt}
              fill
              sizes="(max-width: 540px) 40vw, 260px"
              className="object-contain mix-blend-multiply"
            />
          </div>
        </Link>
      ))}
    </div>
  );
}
