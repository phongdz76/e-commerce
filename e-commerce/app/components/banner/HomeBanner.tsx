import { useState, useEffect } from "react";
import styles from "./HomeBanner.module.css";
import Image from "next/image";

interface Slide {
  id: number;
  image: string;
  title: string;
  description: string;
  buttonText: string;
}

const HomeBanner = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides: Slide[] = [
    {
      id: 1,
      image: "/Image/banner1.jpg",
      title: "Latest Products",
      description: "Discover our newest and best products",
      buttonText: "View Now",
    },
    {
      id: 2,
      image: "/Image/banner2.jpg",
      title: "Special Promotion",
      description: "Up to 50% off on all products",
      buttonText: "Shop Now",
    },
    {
      id: 3,
      image: "/Image/banner3.jpg",
      title: "Customer Service",
      description: "We are always ready to support you 24/7",
      buttonText: "Contact Us",
    },
     {
      id: 4,
      image: "/Image/banner3.jpg",
      title: "Customer Service",
      description: "We are always ready to support you 24/7",
      buttonText: "Contact Us",
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

  // Auto-play functionality
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000); // Change slide every 5 seconds

    return () => clearInterval(interval);
  }, [slides.length]);

  return (
    <div className={styles.sliderContainer}>
      <div
        className={styles.slider}
        style={{ transform: `translateX(-${currentSlide * 100}%)` }}
      >
        {slides.map((slide, index) => (
          <div key={slide.id} className={styles.slide}>
            <img
              src={slide.image}
              alt={`Slide ${slide.id}`}
              className={styles.slideImg}
            />
            <div className={styles.slideContent}>
              <h2>{slide.title}</h2>
              <p>{slide.description}</p>
              <button>{slide.buttonText}</button>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.arrows}>
        <button onClick={prevSlide} className={styles.arrow}>
          &#10094;
        </button>
        <button onClick={nextSlide} className={styles.arrow}>
          &#10095;
        </button>
      </div>

      <div className={styles.dots}>
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`${styles.dot} ${
              index === currentSlide ? styles.active : ""
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default HomeBanner;
