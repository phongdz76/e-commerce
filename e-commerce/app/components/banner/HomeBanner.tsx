import { useState, useEffect, useRef } from "react";
import Image from "next/image";

interface Slide {
  id: number;
  image: string;
  title: string;
  description: string;
  buttonText: string;
  link?: string;
}

const HomeBanner = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchEndX, setTouchEndX] = useState(0);
  
  const bannerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    if (bannerRef.current) {
      observer.observe(bannerRef.current);
    }

    return () => {
      if (bannerRef.current) {
        observer.unobserve(bannerRef.current);
      }
    };
  }, []);

  const slides: Slide[] = [
    {
      id: 1,
      image: "/Image/Banner1.png",
      title: "Latest Products",
      description: "Discover our newest and best products",
      buttonText: "View Now",
      link: "/products",
    },
    {
      id: 2,
      image: "/Image/Banner2.png",
      title: "Special Promotion",
      description: "Up to 50% off on all products",
      buttonText: "Shop Now",
      link: "/products",
    },
    {
      id: 3,
      image: "/Image/Banner3.png",
      title: "Customer Service",
      description: "We are always ready to support you 24/7",
      buttonText: "Contact Us",
      link: "/#footer",
    },
    {
      id: 4,
      image: "/Image/Banner4.jpg",
      title: "Apple Collection",
      description: "Latest and trending Apple products",
      buttonText: "Shop Now",
      link: "/products",
    },
    {
      id: 5,
      image: "/Image/Banner5.png",
      title: "Super Sale",
      description: "Don't miss our biggest sale of the year!",
      buttonText: "Shop Sale",
      link: "/products",
    },
  ];

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  const handleButtonClick = (link?: string) => {
    if (link) {
      window.location.href = link;
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    setIsPaused(false);
    const distance = touchStartX - touchEndX;
    if (distance > 50) {
      nextSlide();
    } else if (distance < -50) {
      prevSlide();
    }
  };

  // Auto-play functionality with reset, pause, and visibility logic
  useEffect(() => {
    if (isPaused || !isVisible) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isPaused, isVisible, currentSlide, slides.length]);

  return (
    <div 
      ref={bannerRef}
      className="group w-full aspect-[16/9] md:aspect-[4/1] relative overflow-hidden rounded-[10px] shadow-[0_8px_20px_rgba(0,0,0,0.2)] my-[10px] mx-auto"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="flex transition-transform duration-500 ease-in-out h-full"
        style={{ transform: `translateX(-${currentSlide * 100}%)` }}
      >
        {slides.map((slide, index) => (
          <div key={slide.id} className="min-w-full relative">
            <Image
              src={slide.image}
              alt={`Slide ${slide.id}`}
              fill
              className="object-cover object-center transition-transform duration-300 hover:scale-105"
              priority={index === 0}
              sizes="(max-width: 768px) 100vw, 100vw"
            />
            <div className="absolute bottom-0 left-0 w-full bg-gradient-to-b from-transparent to-black/80 text-white p-[15px]">
              <h2 className="text-lg mb-[3px] text-left">{slide.title}</h2>
              <p className="text-sm mb-[10px] text-left">{slide.description}</p>
              <button
                onClick={() => handleButtonClick(slide.link)}
                className="bg-[#00b7bd] text-white border-none py-[6px] px-5 font-bold rounded cursor-pointer text-xs transition-colors duration-300 hover:bg-[#9cadaf] hover:opacity-90"
              >
                {slide.buttonText}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="absolute top-1/2 w-full flex justify-between px-5 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <button
          onClick={prevSlide}
          className="bg-white/70 w-10 h-10 rounded-full flex justify-center items-center cursor-pointer transition-colors duration-300 text-xl font-bold border-none hover:bg-white/90 pointer-events-auto"
        >
          &#10094;
        </button>
        <button
          onClick={nextSlide}
          className="bg-white/70 w-10 h-10 rounded-full flex justify-center items-center cursor-pointer transition-colors duration-300 text-xl font-bold border-none hover:bg-white/90 pointer-events-auto"
        >
          &#10095;
        </button>
      </div>

      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2 items-center">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className="w-2 h-2 rounded-full overflow-hidden relative cursor-pointer border-none bg-white/30"
          >
            <div
              style={{
                height: index === currentSlide ? '100%' : '0%',
                transition: index === currentSlide && !isPaused && isVisible ? 'height 5000ms linear' : 'none'
              }}
              className="absolute bottom-0 left-0 w-full bg-white"
            />
          </button>
        ))}
      </div>
    </div>
  );
};

export default HomeBanner;