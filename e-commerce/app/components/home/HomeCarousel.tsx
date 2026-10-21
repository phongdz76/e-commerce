"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

const SLIDE_DURATION_MS = 5000;

export default function HomeCarousel({ slides }: { slides: ReactNode[] }) {
  const slideCount = slides.length;
  const [slide, setSlide] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const [swiping, setSwiping] = useState(false);
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(true);
  const region = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const progress = useRef<HTMLElement>(null);
  const clock = useRef<Animation | null>(null);
  const choose = (index: number) => { setSlide(index); setCycle(previous => previous + 1); };
  const change = (offset: number) => { setSlide(previous => (previous + offset + slideCount) % slideCount); setCycle(previous => previous + 1); };
  const paused = reduced || keyboardFocused || swiping || !visible;

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReduced(motion.matches);
    const observer = new IntersectionObserver(entries => setVisible(entries[0].isIntersecting && !document.hidden));
    const syncVisibility = () => setVisible(!document.hidden && Boolean(region.current && region.current.getBoundingClientRect().bottom > 0 && region.current.getBoundingClientRect().top < innerHeight));
    const initialize = async () => { syncMotion(); syncVisibility(); };
    void initialize();
    if (region.current) observer.observe(region.current);
    motion.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncVisibility);
    return () => { observer.disconnect(); motion.removeEventListener("change", syncMotion); document.removeEventListener("visibilitychange", syncVisibility); };
  }, []);

  useEffect(() => {
    if (reduced || slideCount < 2 || !progress.current) return;
    // The progress animation is the clock: no separate timer can drift or remain paused.
    const animation = progress.current.animate(
      [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }],
      { duration: SLIDE_DURATION_MS, fill: "forwards" },
    );
    animation.pause();
    clock.current = animation;
    animation.onfinish = () => setSlide(previous => (previous + 1) % slideCount);
    return () => { animation.onfinish = null; animation.cancel(); if (clock.current === animation) clock.current = null; };
  }, [slide, cycle, slideCount, reduced]);

  useEffect(() => {
    if (paused) clock.current?.pause(); else clock.current?.play();
  }, [paused, slide, cycle, slideCount, reduced]);

  return <div ref={region} className={`
      home-carousel relative min-w-0 min-h-[420px] rounded-[24px] overflow-hidden [touch-action:pan-y]
      [background:#edf4f4] [&_.home-hero]:pb-[62px] [&:hover_.home-carouselArrows>button]:opacity-[1]
      [&:focus-within_.home-carouselArrows>button]:opacity-[1] max-[800px]:min-h-[380px] max-[540px]:min-h-[580px]
      max-[540px]:[&_.home-heroArt]:relative max-[540px]:[&_.home-heroArt]:top-auto
      max-[540px]:[&_.home-heroArt]:bottom-auto max-[540px]:[&_.home-heroArt]:right-auto
      max-[540px]:[&_.home-heroArt]:w-full max-[540px]:[&_.home-heroArt]:max-w-[340px]
      max-[540px]:[&_.home-heroArt]:h-[220px] max-[540px]:[&_.home-heroArt]:mt-[28px]
      max-[540px]:[&_.home-heroArt]:[margin-inline:auto] max-[540px]:[&_.home-hero]:pb-[42px]
      max-[350px]:min-h-[540px]
    `} role="region" aria-roledescription="carousel" aria-label="Featured collections"
    onPointerDownCapture={() => setKeyboardFocused(false)}
    onFocusCapture={event => setKeyboardFocused(event.target.matches(":focus-visible"))}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setKeyboardFocused(false); }}
    onKeyDown={event => {
      if (["Tab", "ArrowLeft", "ArrowRight", "Enter", " "].includes(event.key)) setKeyboardFocused(true);
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); change(event.key === "ArrowLeft" ? -1 : 1); }
    }}
    onTouchStart={event => { touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; setSwiping(true); }}
    onTouchEnd={event => {
      const start = touch.current; touch.current = null; setSwiping(false);
      if (!start) return;
      const dx = start.x - event.changedTouches[0].clientX, dy = start.y - event.changedTouches[0].clientY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) change(dx > 0 ? 1 : -1);
    }} onTouchCancel={() => { touch.current = null; setSwiping(false); }}>
    <div className={`
      home-slideTrack flex h-full min-h-[inherit] [transition:transform_420ms_cubic-bezier(.22,_1,_.36,_1)]
      will-change-transform motion-reduce:[transition:none] motion-reduce:will-change-auto
    `} style={{ transform: `translateX(-${slide * 100}%)` }}>
      {slides.map((content, index) => <div key={index} className={`home-slide [flex:0_0_100%] min-w-0 relative min-h-[inherit] home-firstSlide [&>div]:h-full`} inert={slide !== index} aria-hidden={slide !== index} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${slideCount}`}>{content}</div>)}
    </div>
    <div className={`
      home-carouselArrows absolute top-[50%] left-[16px] right-[16px] [transform:translateY(-50%)] flex items-center
      justify-between z-[3] pointer-events-none [&>button]:w-[36px] [&>button]:h-[36px] [&>button]:grid
      [&>button]:place-items-center [&>button]:rounded-[50%] [&>button]:[background:#ffffffdf]
      [&>button]:[border:1px_solid_#cbd5e1] [&>button]:text-[#334155] [&>button]:cursor-pointer
      [&>button]:pointer-events-auto [&>button]:shadow-[0_2px_8px_#0f172a10] [&>button]:opacity-0
      [&>button]:[transition:opacity_.18s,_background_.18s] [&>button:hover]:[background:white]
      max-[540px]:left-[10px] max-[540px]:right-[10px] max-[540px]:[&>button]:w-[32px]
      max-[540px]:[&>button]:h-[32px] max-[540px]:[&>button]:opacity-[1]
    `}>
      <button type="button" aria-label="Previous banner" onClick={() => change(-1)}><FiChevronLeft aria-hidden="true" /></button>
      <button type="button" aria-label="Next banner" onClick={() => change(1)}><FiChevronRight aria-hidden="true" /></button>
    </div>
    <div className={`
      home-carouselDots absolute bottom-[15px] left-[50%] [transform:translateX(-50%)] flex items-center
      [background:#ffffffd9] py-0 px-[7px] rounded-[30px] z-[3] [&_button]:grid [&_button]:place-items-center
      [&_button]:w-[27px] [&_button]:h-[30px] [&_button]:cursor-pointer [&_span]:relative [&_span]:overflow-hidden
      [&_span]:w-[8px] [&_span]:h-[8px] [&_span]:rounded-[50%] [&_span]:[background:#94a3b8]
      [&_button[aria-current]_span]:[background:#b2d8d0] [&_button[aria-current]_span]:shadow-[0_0_0_2px_#0f766e33]
    `}>{Array.from({ length: slideCount }, (_, index) => <button key={index} type="button" aria-label={`Show banner ${index + 1}`} aria-current={slide === index ? "true" : undefined} onClick={() => choose(index)}><span>{slide === index && <i ref={progress} key={slide} className="home-dotProgress absolute [inset:0] [background:#0f766e] [transform:scaleY(0)] origin-bottom motion-reduce:[transform:scaleY(1)]" />}</span></button>)}</div>
    <span className="sr-only" aria-live={keyboardFocused ? "polite" : "off"}>Banner {slide + 1} of {slideCount}</span>
  </div>;
}
