import { Fragment, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  FiArrowRight,
  FiArrowUpRight,
  FiCheckCircle,
  FiGrid,
  FiStar,
} from "react-icons/fi";
import type { HomepageData } from "@/types/homepage";
import type { HomeSection } from "@/types/homepageContent";
import { categoryImage } from "@/utils/homepage";
import HomeHero from "./HomeHero";
import HomeShopping from "./HomeShopping";
import HomeProducts from "./HomeProducts";
import HomeBrands from "./HomeBrands";
import HomeCollections from "./HomeCollections";

interface HomeViewProps {
  data: HomepageData;
}

export default function HomeView({ data }: HomeViewProps) {
  const {
    catalog,
    affordable,
    featured,
    reviews,
    savedIds,
    signedIn,
    publication: { content },
  } = data;

  const categories = catalog.categories.filter((category) => category.count > 0);

  const sections: Record<HomeSection, ReactNode> = {
    categories: categories.length > 0 && (
      <section aria-labelledby="categories-heading" className="home-section mt-12">
        <div className="home-sectionHeader mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2
              id="categories-heading"
              className="text-2xl font-bold tracking-tight text-slate-800"
            >
              What are you looking for?
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Big ideas start with the right tech.
            </p>
          </div>
          <Link
            href="/products"
            className="flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-800 hover:underline"
          >
            <span>All categories</span>
            <FiArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>

        <nav
          className="home-categories grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4 w-full"
          aria-label="Product categories"
          tabIndex={0}
        >
          {categories.map((category) => {
            const image = categoryImage(category, catalog.products);
            return (
              <Link
                key={category.value}
                className="home-category group flex flex-col items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center transition-all duration-200 hover:-translate-y-1 hover:border-teal-300 hover:bg-teal-50/50 hover:shadow-md w-full"
                href={`/products?category=${encodeURIComponent(category.value)}`}
              >
                <span className="home-categoryImage relative mb-2 flex h-20 sm:h-24 w-full items-center justify-center overflow-hidden">
                  {image ? (
                    <Image
                      src={image}
                      alt={category.homeImage?.alt ?? ""}
                      fill
                      sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 180px"
                      className="object-contain p-1 mix-blend-multiply transition-transform duration-200 group-hover:scale-105"
                    />
                  ) : (
                    <FiGrid
                      aria-hidden="true"
                      className="h-10 w-10 text-slate-400"
                    />
                  )}
                </span>
                <div className="w-full">
                  <strong className="block text-xs sm:text-sm font-semibold text-slate-800 group-hover:text-teal-700 truncate">
                    {category.label}
                  </strong>
                  <small className="mt-0.5 block text-[11px] text-slate-500">
                    {category.count} {category.count === 1 ? "product" : "products"}
                  </small>
                </div>
              </Link>
            );
          })}
        </nav>
      </section>
    ),

    featured: (
      <HomeProducts
        newest={featured}
        total={catalog.total}
        featured
      />
    ),

    collections: catalog.total > 0 && (
      <HomeCollections tiles={content.collections} />
    ),

    products: (
      <HomeProducts
        newest={catalog.products}
        affordable={affordable}
        total={catalog.total}
      />
    ),

    brands: (
      <HomeBrands
        brands={catalog.brands.filter((brand) => brand.count > 0)}
      />
    ),

    reviews: reviews.length > 0 && (
      <section aria-labelledby="reviews-heading" className="home-section mt-12">
        <div className="home-sectionHeader mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2
              id="reviews-heading"
              className="text-2xl font-bold tracking-tight text-slate-800"
            >
              From people who use it.
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Product reviews from verified purchases.
            </p>
          </div>
        </div>

        <div className="home-reviewGrid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reviews.map((review) => (
            <article
              className="home-review flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
              key={review.id}
            >
              <div>
                <div
                  className="home-reviewStars mb-3 flex gap-1 text-amber-500"
                  aria-label={`${review.rating} out of 5 stars`}
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <FiStar
                      key={star}
                      aria-hidden="true"
                      data-filled={star <= review.rating}
                      className={
                        star <= review.rating
                          ? "fill-amber-400 text-amber-500"
                          : "text-slate-300"
                      }
                    />
                  ))}
                </div>

                <blockquote className="text-xs leading-relaxed text-slate-600 line-clamp-4">
                  &ldquo;{review.comment}&rdquo;
                </blockquote>
              </div>

              <div className="mt-5 border-t border-slate-100 pt-4">
                <footer className="flex items-center gap-3">
                  <span
                    className="home-avatar flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-800"
                    aria-hidden="true"
                  >
                    {review.authorName.trim().slice(0, 1).toUpperCase() || "C"}
                  </span>
                  <div>
                    <strong className="block text-xs font-semibold text-slate-800">
                      {review.authorName}
                    </strong>
                    <span className="home-verified flex items-center gap-1 text-[11px] text-teal-700">
                      <FiCheckCircle aria-hidden="true" className="h-3 w-3" />
                      Verified purchase
                    </span>
                  </div>
                </footer>

                <div className="home-reviewProduct mt-3 flex items-center gap-1 text-xs text-slate-500">
                  <Link
                    href={`/product/${review.productId}`}
                    className="truncate hover:text-teal-700 hover:underline"
                  >
                    {review.productName}
                  </Link>
                  <FiArrowUpRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                </div>

                <time
                  className="mt-1 block text-[10px] text-slate-400"
                  dateTime={review.createdAt}
                >
                  {new Date(review.createdAt).toLocaleDateString("en-GB", {
                    timeZone: "Asia/Ho_Chi_Minh",
                  })}
                </time>
              </div>
            </article>
          ))}
        </div>
      </section>
    ),

    member: (
      <section
        className="home-section home-member mt-12 flex flex-col md:flex-row items-center justify-between gap-6 rounded-2xl border border-teal-100 bg-teal-50/60 p-6 sm:p-8"
        aria-labelledby="member-heading"
      >
        <div>
          <span className="home-eyebrow inline-flex items-center gap-2 text-xs font-semibold tracking-wider text-teal-800 uppercase">
            YOUR SGTECH, ALL IN ONE PLACE
          </span>
          <h2
            id="member-heading"
            className="mt-1 text-2xl font-bold tracking-tight text-slate-800"
          >
            {signedIn
              ? "Your next favorite is waiting."
              : "Good tech. Even better together."}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {signedIn
              ? "Keep your favorites close and follow every order."
              : "Save your favorites, track your orders and make yourself at home."}
          </p>
        </div>

        <div className="home-memberActions flex shrink-0 flex-wrap items-center gap-4">
          <Link
            className="home-primaryButton inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-teal-800 shadow-sm"
            href={signedIn ? "/wishlist" : "/register"}
          >
            <span>{signedIn ? "Your wishlist" : "Create an account"}</span>
            <FiArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
          <Link
            href={signedIn ? "/orders" : "/login"}
            className="text-xs font-semibold text-slate-700 hover:text-teal-700 underline underline-offset-4"
          >
            {signedIn ? "Your orders" : "Already a member? Sign in"}
          </Link>
        </div>
      </section>
    ),
  };

  return (
    <div className="home-home w-full space-y-2 text-slate-700">
      <HomeHero categories={categories} content={content} />
      <HomeShopping signedIn={signedIn} savedIds={savedIds}>
        {content.sections
          .filter((section) => section.enabled)
          .map((section) => (
            <Fragment key={section.id}>{sections[section.id]}</Fragment>
          ))}
      </HomeShopping>
    </div>
  );
}
