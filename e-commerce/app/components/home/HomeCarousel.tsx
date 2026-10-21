"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

const SLIDE_DURATION_MS = 5000;

interface HomeCarouselProps {
  slides: ReactNode[];
}

export default function HomeCarousel({ slides }: HomeCarouselProps) {
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

  const choose = (index: number) => {
    setSlide(index);
    setCycle((previous) => previous + 1);
  };

  const change = (offset: number) => {
    setSlide((previous) => (previous + offset + slideCount) % slideCount);
    setCycle((previous) => previous + 1);
  };

  const paused = reduced || keyboardFocused || swiping || !visible;

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReduced(motion.matches);

    const observer = new IntersectionObserver((entries) => {
      setVisible(entries[0].isIntersecting && !document.hidden);
    });

    const syncVisibility = () => {
      setVisible(
        !document.hidden &&
          Boolean(
            region.current &&
              region.current.getBoundingClientRect().bottom > 0 &&
              region.current.getBoundingClientRect().top < innerHeight
          )
      );
    };

    syncMotion();
    syncVisibility();

    if (region.current) observer.observe(region.current);
    motion.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncVisibility);

    return () => {
      observer.disconnect();
      motion.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, []);

  useEffect(() => {
    if (reduced || slideCount < 2 || !progress.current) return;

    const animation = progress.current.animate(
      [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }],
      { duration: SLIDE_DURATION_MS, fill: "forwards" }
    );
    animation.pause();
    clock.current = animation;

    animation.onfinish = () => {
      setSlide((previous) => (previous + 1) % slideCount);
    };

    return () => {
      animation.onfinish = null;
      animation.cancel();
      if (clock.current === animation) clock.current = null;
    };
  }, [slide, cycle, slideCount, reduced]);

  useEffect(() => {
    if (paused) {
      clock.current?.pause();
    } else {
      clock.current?.play();
    }
  }, [paused, slide, cycle, slideCount, reduced]);

  return (
    <div
      ref={region}
      className="home-carousel group/carousel relative min-w-0 min-h-[440px] max-[800px]:min-h-[380px] max-[540px]:min-h-[580px] max-[350px]:min-h-[540px] overflow-hidden rounded-2xl bg-teal-50/50 touch-pan-y"
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured collections"
      onPointerDownCapture={() => setKeyboardFocused(false)}
      onFocusCapture={(event) =>
        setKeyboardFocused(event.target.matches(":focus-visible"))
      }
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setKeyboardFocused(false);
        }
      }}
      onKeyDown={(event) => {
        if (["Tab", "ArrowLeft", "ArrowRight", "Enter", " "].includes(event.key)) {
          setKeyboardFocused(true);
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          change(event.key === "ArrowLeft" ? -1 : 1);
        }
      }}
      onTouchStart={(event) => {
        touch.current = {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY,
        };
        setSwiping(true);
      }}
      onTouchEnd={(event) => {
        const start = touch.current;
        touch.current = null;
        setSwiping(false);
        if (!start) return;
        const dx = start.x - event.changedTouches[0].clientX;
        const dy = start.y - event.changedTouches[0].clientY;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
          change(dx > 0 ? 1 : -1);
        }
      }}
      onTouchCancel={() => {
        touch.current = null;
        setSwiping(false);
      }}
    >
      <div
        className="home-slideTrack flex h-full min-h-[inherit] transition-transform duration-500 ease-out will-change-transform motion-reduce:transition-none motion-reduce:will-change-auto"
        style={{ transform: `translateX(-${slide * 100}%)` }}
      >
        {slides.map((content, index) => (
          <div
            key={index}
            className="home-slide flex-[0_0_100%] min-w-0 relative min-h-[inherit] home-firstSlide [&>div]:h-full"
            inert={slide !== index}
            aria-hidden={slide !== index}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${slideCount}`}
          >
            {content}
          </div>
        ))}
      </div>

      <div className="home-carouselArrows pointer-events-none absolute top-1/2 left-3 right-3 -translate-y-1/2 flex items-center justify-between z-20">
        <button
          type="button"
          aria-label="Previous banner"
          onClick={() => change(-1)}
          className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white/90 text-slate-700 shadow-md transition hover:bg-white hover:text-teal-700 opacity-90 sm:opacity-0 group-hover/carousel:opacity-100 cursor-pointer"
        >
          <FiChevronLeft aria-hidden="true" className="h-5 w-5" />
        </button>

        <button
          type="button"
          aria-label="Next banner"
          onClick={() => change(1)}
          className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white/90 text-slate-700 shadow-md transition hover:bg-white hover:text-teal-700 opacity-90 sm:opacity-0 group-hover/carousel:opacity-100 cursor-pointer"
        >
          <FiChevronRight aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>

      <div className="home-carouselDots absolute bottom-3.5 left-1/2 -translate-x-1/2 flex items-center rounded-full bg-white/90 px-2 py-0.5 shadow-sm backdrop-blur-sm z-20">
        {Array.from({ length: slideCount }, (_, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Show banner ${index + 1}`}
            aria-current={slide === index ? "true" : undefined}
            onClick={() => choose(index)}
            className="flex h-7 w-7 items-center justify-center cursor-pointer"
          >
            <span
              className={`relative h-2 w-2 overflow-hidden rounded-full transition ${
                slide === index
                  ? "bg-teal-200 ring-2 ring-teal-600/20"
                  : "bg-slate-300 hover:bg-slate-400"
              }`}
            >
              {slide === index && (
                <i
                  ref={progress}
                  key={slide}
                  className="home-dotProgress absolute inset-0 bg-teal-700 origin-bottom scale-y-0 motion-reduce:scale-y-100"
                />
              )}
            </span>
          </button>
        ))}
      </div>

      <span className="sr-only" aria-live={keyboardFocused ? "polite" : "off"}>
        Banner {slide + 1} of {slideCount}
      </span>
    </div>
  );
}
