import { Suspense } from "react";
import type { Metadata } from "next";
import { getCurrentUser } from "@/actions/getCurrentUser";
import { getHomepage } from "@/libs/homepage";
import HomeHero from "./components/home/HomeHero";
import HomeView from "./components/home/HomeView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "SGTech | Your next upgrade starts here",
  description: "Discover phones, laptops, headphones and everyday tech at SGTech. Explore products, choose your options and save your favorites.",
};

async function HomepageContent() {
  const user = await getCurrentUser();
  let data;
  try { data = await getHomepage(user?.id ?? null); }
  catch {
    return <div className={`
      home-home max-w-[1280px] m-auto pt-0 px-[24px] pb-[12px] text-[#334155]
      [&_:is(a,_button,_summary):focus-visible]:[outline:2px_solid_#0f766e]
      [&_:is(a,_button,_summary):focus-visible]:[outline-offset:4px] max-[800px]:[padding-inline:16px]
      motion-reduce:[&_*]:[transition:none]!
    `}><HomeHero categories={[]} /><div className={`home-section mt-[46px] max-[540px]:mt-[32px] home-empty [border:1px_dashed_#cbd5e1] rounded-[16px] py-[30px] px-[20px] text-center text-[#64748b] text-[13px]`} role="alert"><h2 className="mb-2 text-lg font-semibold text-slate-700">Products are temporarily unavailable</h2><p>Please try again in a moment.</p><form action="/"><button type="submit" className={`home-detailLink inline-block mt-[18px] text-[12px] text-[#0f766e] underline cursor-pointer`}>Reload homepage</button></form></div></div>;
  }
  return <HomeView data={data} />;
}

function HomeLoading() {
  return (
    <div className={`home-home max-w-[1280px] m-auto pt-0 px-[24px] pb-[12px] text-[#334155] [&_:is(a,_button,_summary):focus-visible]:[outline:2px_solid_#0f766e] [&_:is(a,_button,_summary):focus-visible]:[outline-offset:4px] max-[800px]:[padding-inline:16px] motion-reduce:[&_*]:[transition:none]! min-h-[85vh]`} role="status" aria-label="Loading homepage">
      <div className={`
      home-intro flex justify-between items-center gap-[16px] py-[22px] px-0 text-[10px] font-semibold
      tracking-[.14em] text-[#64748b] [&_a]:flex [&_a]:items-center [&_a]:gap-[7px] [&_a]:tracking-normal
      [&_a]:text-[12px] [&_a]:text-[#0f766e] max-[540px]:py-[16px] max-[540px]:px-0 max-[540px]:text-[8px]
      max-[540px]:tracking-[.07em] max-[540px]:[&_a]:hidden
    `}>GETTING YOUR NEXT UPGRADE READY</div>
      <div className="h-96 w-full animate-pulse rounded-xl bg-slate-100" />
      <span className="sr-only">Loading products…</span>
    </div>
  );
}

export default function Home() {
  return <Suspense fallback={<HomeLoading />}><HomepageContent /></Suspense>;
}
