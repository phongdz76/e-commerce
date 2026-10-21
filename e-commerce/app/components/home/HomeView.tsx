import { Fragment, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiArrowRight, FiArrowUpRight, FiCheckCircle, FiGrid, FiStar } from "react-icons/fi";
import type { HomepageData } from "@/types/homepage";
import type { HomeSection } from "@/types/homepageContent";
import { categoryImage } from "@/utils/homepage";
import HomeHero from "./HomeHero";
import HomeShopping from "./HomeShopping";
import HomeProducts from "./HomeProducts";
import HomeBrands from "./HomeBrands";
import HomeCollections from "./HomeCollections";

export default function HomeView({ data }: { data: HomepageData }) {
  const { catalog, affordable, featured, reviews, savedIds, signedIn, publication: { content } } = data;
  const categories = catalog.categories.filter(category => category.count > 0);
  const sections: Record<HomeSection, ReactNode> = {
    categories: categories.length > 0 && <section aria-labelledby="categories-heading" className="home-section mt-[46px] max-[540px]:mt-[32px]">
      <div className={`
      home-sectionHeader flex justify-between items-end gap-[16px] mb-[22px] [&_h2]:text-[24px] [&_h2]:font-semibold
      [&_h2]:tracking-[-.04em] [&_h2]:text-[#1e293b] [&_h2]:leading-[1.3] [&_p]:text-[12px] [&_p]:mt-[6px]
      [&_p]:text-[#64748b] [&>a]:text-[12px] [&>a]:font-medium [&>a]:text-[#0f766e] [&>a]:flex [&>a]:items-center
      [&>a]:gap-[7px] [&>a]:shrink-0 [&>a]:min-h-[36px] max-[540px]:gap-[12px] max-[540px]:mb-[16px]
      max-[540px]:[&_h2]:text-[21px] max-[540px]:[&_p]:text-[10px] max-[540px]:[&_p]:max-w-[240px]
      max-[540px]:[&>a]:text-[10px] max-[540px]:[&>a]:gap-[3px] max-[350px]:[&_h2]:text-[19px]
      max-[350px]:[&>a]:text-[9px]
    `}><div><h2 id="categories-heading">What are you looking for?</h2><p>Big ideas start with the right tech.</p></div><Link href="/products">All categories <FiArrowRight aria-hidden="true" /></Link></div>
      <nav className={`
      home-categories grid [grid-auto-flow:column] [grid-auto-columns:minmax(130px,_1fr)] gap-[12px] overflow-x-auto
      pt-[4px] px-[3px] pb-[12px] [scroll-snap-type:x_proximity] [scrollbar-width:thin]
      [scrollbar-color:#cbd5e1_transparent] max-[540px]:[grid-auto-columns:110px] max-[540px]:gap-[10px]
    `} aria-label="Product categories" tabIndex={0}>
        {categories.map(category => {
          const image = categoryImage(category, catalog.products);
          return <Link key={category.value} className={`
      home-category flex flex-col items-center [border:1px_solid_#e7ecef] [background:#f8fafc] rounded-[16px]
      pt-[12px] px-[10px] pb-[15px] [scroll-snap-align:start] [transition:background_.18s,_border-color_.18s]
      [&:hover]:[background:#effaf8] [&:hover]:[border-color:#93c9c0] [&_strong]:text-[12px] [&_strong]:font-medium
      [&_small]:mt-[4px] [&_small]:text-[10px] [&_small]:text-[#64748b] max-[540px]:rounded-[12px]
      max-[540px]:p-[10px] max-[540px]:[&_strong]:text-[11px] max-[540px]:[&_small]:text-[9px]
    `} href={`/products?category=${encodeURIComponent(category.value)}`}>
            <span className={`
      home-categoryImage relative w-full h-[86px] mb-[12px] [&_img]:object-contain [&_img]:p-[6px]
      [&_img]:[mix-blend-mode:multiply] [&>svg]:my-[22px] [&>svg]:mx-auto [&>svg]:w-[40px] [&>svg]:h-[40px]
      [&>svg]:text-[#94a3b8] max-[540px]:h-[70px] max-[540px]:mb-[8px]
    `}>{image ? <Image src={image} alt={category.homeImage?.alt ?? ""} fill sizes="110px" /> : <FiGrid aria-hidden="true" />}</span><strong>{category.label}</strong><small>{category.count} {category.count === 1 ? "product" : "products"}</small>
          </Link>;
        })}
      </nav>
    </section>,
    featured: <HomeProducts newest={featured} total={catalog.total} featured />,
    collections: catalog.total > 0 && <HomeCollections tiles={content.collections} />,
    products: <HomeProducts newest={catalog.products} affordable={affordable} total={catalog.total} />,
    brands: <HomeBrands brands={catalog.brands.filter(brand => brand.count > 0)} />,
    reviews: reviews.length > 0 && <section aria-labelledby="reviews-heading" className="home-section mt-[46px] max-[540px]:mt-[32px]">
      <div className={`
      home-sectionHeader flex justify-between items-end gap-[16px] mb-[22px] [&_h2]:text-[24px] [&_h2]:font-semibold
      [&_h2]:tracking-[-.04em] [&_h2]:text-[#1e293b] [&_h2]:leading-[1.3] [&_p]:text-[12px] [&_p]:mt-[6px]
      [&_p]:text-[#64748b] [&>a]:text-[12px] [&>a]:font-medium [&>a]:text-[#0f766e] [&>a]:flex [&>a]:items-center
      [&>a]:gap-[7px] [&>a]:shrink-0 [&>a]:min-h-[36px] max-[540px]:gap-[12px] max-[540px]:mb-[16px]
      max-[540px]:[&_h2]:text-[21px] max-[540px]:[&_p]:text-[10px] max-[540px]:[&_p]:max-w-[240px]
      max-[540px]:[&>a]:text-[10px] max-[540px]:[&>a]:gap-[3px] max-[350px]:[&_h2]:text-[19px]
      max-[350px]:[&>a]:text-[9px]
    `}><div><h2 id="reviews-heading">From people who use it.</h2><p>Product reviews from verified purchases.</p></div></div>
      <div className="home-reviewGrid grid [grid-template-columns:repeat(3,_minmax(0,_1fr))] gap-[16px] max-[800px]:[grid-template-columns:1fr]">{reviews.map(review => <article className={`
      home-review flex flex-col [border:1px_solid_#e2e8f0] rounded-[16px] p-[22px] [&_blockquote]:text-[12px]
      [&_blockquote]:leading-[1.8] [&_blockquote]:[overflow-wrap:anywhere] [&_blockquote]:whitespace-pre-wrap
      [&_footer]:flex [&_footer]:gap-[10px] [&_footer]:items-center [&_footer]:mt-auto [&_footer]:pt-[20px]
      [&_footer_strong]:text-[11px] [&_footer_strong]:font-medium
    `} key={review.id}>
        <div className="home-reviewStars text-[#a86806] flex gap-[3px] mb-[14px] [&_svg[data-filled=true]]:[fill:currentColor]" aria-label={`${review.rating} out of 5 stars`}>{[1, 2, 3, 4, 5].map(star => <FiStar key={star} aria-hidden="true" data-filled={star <= review.rating} />)}</div>
        <blockquote>{review.comment}</blockquote>
        <footer><span className="home-avatar grid place-items-center h-[36px] w-[36px] rounded-[50%] [background:#e6f4f0] text-[#0f766e] text-[14px] font-semibold shrink-0" aria-hidden="true">{review.authorName.trim().slice(0, 1).toUpperCase() || "C"}</span><div><strong>{review.authorName}</strong><span className="home-verified text-[9px] flex gap-[4px] items-center text-[#0f766e] mt-[4px]"><FiCheckCircle aria-hidden="true" />Verified purchase</span></div></footer>
        <div className={`
      home-reviewProduct text-[10px] text-[#64748b] mt-[14px] flex items-center gap-[6px] [&_a]:overflow-hidden
      [&_a]:[text-overflow:ellipsis] [&_a]:whitespace-nowrap
    `}><Link href={`/product/${review.productId}`}>{review.productName}</Link><FiArrowUpRight aria-hidden="true" /></div>
        <time className="mt-2 text-[9px] text-slate-500" dateTime={review.createdAt}>{new Date(review.createdAt).toLocaleDateString("en-GB", { timeZone: "Asia/Ho_Chi_Minh" })}</time>
      </article>)}</div>
    </section>,
    member: <section className={`home-section mt-[46px] max-[540px]:mt-[32px] home-member flex justify-between items-center gap-[24px] [background:#ecf6f3] py-[30px] px-[34px] rounded-[20px] [&_h2]:text-[26px] [&_h2]:font-semibold [&_h2]:tracking-[-.04em] [&_h2]:my-[8px] [&_h2]:mx-0 [&_p]:text-[#64748b] [&_p]:text-[12px] [&_p]:leading-[1.7] max-[800px]:p-[28px] max-[540px]:flex-col max-[540px]:items-start max-[540px]:gap-[20px] max-[540px]:p-[24px] max-[540px]:[&_h2]:text-[25px] max-[540px]:[&_p]:text-[11px]`} aria-labelledby="member-heading">
      <div><span className="home-eyebrow inline-flex items-center gap-[7px] text-[9px] font-semibold tracking-[.12em]">YOUR SGTECH, ALL IN ONE PLACE</span><h2 id="member-heading">{signedIn ? "Your next favorite is waiting." : "Good tech. Even better together."}</h2><p>{signedIn ? "Keep your favorites close and follow every order." : "Save your favorites, track your orders and make yourself at home."}</p></div>
      <div className={`
      home-memberActions flex items-center shrink-0 gap-[20px] [&>a:last-child]:text-[12px]
      [&>a:last-child]:underline [&>a:last-child]:[text-underline-offset:4px] max-[800px]:flex-col
      max-[800px]:gap-[14px] max-[540px]:flex-row max-[540px]:[flex-wrap:wrap] max-[540px]:gap-[20px]
      max-[540px]:[&>a:last-child]:text-[11px]
    `}><Link className={`
      home-primaryButton min-h-[44px] inline-flex justify-center items-center gap-[16px] py-[12px] px-[18px]
      rounded-[10px] [background:#0f766e] text-[white] text-[12px] font-medium [transition:background_.18s]
      [&:hover]:[background:#115e59]
    `} href={signedIn ? "/wishlist" : "/register"}>{signedIn ? "Your wishlist" : "Create an account"}<FiArrowRight aria-hidden="true" /></Link><Link href={signedIn ? "/orders" : "/login"}>{signedIn ? "Your orders" : "Already a member? Sign in"}</Link></div>
    </section>,
  };
  return <div className={`
      home-home max-w-[1280px] m-auto pt-0 px-[24px] pb-[12px] text-[#334155]
      [&_:is(a,_button,_summary):focus-visible]:[outline:2px_solid_#0f766e]
      [&_:is(a,_button,_summary):focus-visible]:[outline-offset:4px] max-[800px]:[padding-inline:16px]
      motion-reduce:[&_*]:[transition:none]!
    `}>
    <HomeHero categories={categories} content={content} />
    <HomeShopping signedIn={signedIn} savedIds={savedIds}>
      {content.sections.filter(section => section.enabled).map(section => <Fragment key={section.id}>{sections[section.id]}</Fragment>)}
    </HomeShopping>
  </div>;
}
