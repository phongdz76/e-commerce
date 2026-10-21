import { Suspense } from "react";
import type { Metadata } from "next";
import { getCurrentUser } from "@/actions/getCurrentUser";
import { getHomepage } from "@/libs/homepage";
import Container from "./components/Container";
import HomeHero from "./components/home/HomeHero";
import HomeView from "./components/home/HomeView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SGTech | Your next upgrade starts here",
  description:
    "Discover phones, laptops, headphones and everyday tech at SGTech. Explore products, choose your options and save your favorites.",
};

async function HomepageContent() {
  const user = await getCurrentUser();
  let data;

  try {
    data = await getHomepage(user?.id ?? null);
  } catch {
    return (
      <Container>
        <div className="home-home w-full py-4 text-slate-700">
          <HomeHero categories={[]} />
          <div
            className="home-section home-empty mt-10 rounded-2xl border border-dashed border-slate-300 py-8 px-5 text-center text-slate-500 text-sm"
            role="alert"
          >
            <h2 className="mb-2 text-lg font-semibold text-slate-700">
              Products are temporarily unavailable
            </h2>
            <p>Please try again in a moment.</p>
            <form action="/">
              <button
                type="submit"
                className="home-detailLink mt-4 inline-block text-sm font-medium text-teal-700 underline hover:text-teal-800"
              >
                Reload homepage
              </button>
            </form>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <HomeView data={data} />
    </Container>
  );
}

function HomeLoading() {
  return (
    <Container>
      <div
        className="home-home min-h-[85vh] w-full py-4 text-slate-700"
        role="status"
        aria-label="Loading homepage"
      >
        <div className="home-intro flex items-center justify-between gap-4 py-4 text-xs font-semibold tracking-wider text-slate-500">
          <span>GETTING YOUR NEXT UPGRADE READY</span>
        </div>
        <div className="h-96 w-full animate-pulse rounded-2xl bg-slate-100" />
        <span className="sr-only">Loading products…</span>
      </div>
    </Container>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <HomepageContent />
    </Suspense>
  );
}
