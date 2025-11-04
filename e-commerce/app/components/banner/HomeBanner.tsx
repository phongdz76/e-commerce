// import { useState, useEffect } from "react";
// import styles from "./HomeBanner.module.css";
// import Image from "next/image";

// interface Slide {
//   id: number;
//   image: string;
//   title: string;
//   description: string;
//   buttonText: string;
//   link?: string;
// }

// const HomeBanner = () => {
//   const [currentSlide, setCurrentSlide] = useState(0);

//   const slides: Slide[] = [
//     {
//       id: 1,
//       image: "/Image/banner1.jpg",
//       title: "Latest Products",
//       description: "Discover our newest and best products",
//       buttonText: "View Now",
//       link: "/products",
//     },
//     {
//       id: 2,
//       image: "/Image/banner2.jpg",
//       title: "Special Promotion",
//       description: "Up to 50% off on all products",
//       buttonText: "Shop Now",
//       link: "/products",
//     },
//     {
//       id: 3,
//       image: "/Image/banner3.jpg",
//       title: "Customer Service",
//       description: "We are always ready to support you 24/7",
//       buttonText: "Contact Us",
//       link: "/#footer",
//     },
//     {
//       id: 4,
//       image: "/Image/banner4.jpg",
//       title: "Customer Service",
//       description: "We are always ready to support you 24/7",
//       buttonText: "Contact Us",
//     },
//   ];

//   const nextSlide = () => {
//     setCurrentSlide((prev) => (prev + 1) % slides.length);
//   };

//   const prevSlide = () => {
//     setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
//   };

//   const goToSlide = (index: number) => {
//     setCurrentSlide(index);
//   };

//   const handleButtonClick = (link?: string) => {
//     if (link) {
//       window.location.href = link;
//     }
//   };

//   // Auto-play functionality
//   useEffect(() => {
//     const interval = setInterval(() => {
//       setCurrentSlide((prev) => (prev + 1) % slides.length);
//     }, 5000); // Change slide every 5 seconds

//     return () => clearInterval(interval);
//   }, [slides.length]);

//   return (
//     <div className={styles.sliderContainer}>
//       <div
//         className={styles.slider}
//         style={{ transform: `translateX(-${currentSlide * 100}%)` }}
//       >
//         {slides.map((slide, index) => (
//           <div key={slide.id} className={styles.slide}>
//             <img
//               src={slide.image}
//               alt={`Slide ${slide.id}`}
//               className={styles.slideImg}
//             />
//             <div className={styles.slideContent}>
//               <h2>{slide.title}</h2>
//               <p>{slide.description}</p>
//               <button onClick={() => handleButtonClick(slide.link)}>
//                 {slide.buttonText}
//               </button>
//             </div>
//           </div>
//         ))}
//       </div>

//       <div className={styles.arrows}>
//         <button onClick={prevSlide} className={styles.arrow}>
//           &#10094;
//         </button>
//         <button onClick={nextSlide} className={styles.arrow}>
//           &#10095;
//         </button>
//       </div>

//       <div className={styles.dots}>
//         {slides.map((_, index) => (
//           <button
//             key={index}
//             onClick={() => goToSlide(index)}
//             className={`${styles.dot} ${
//               index === currentSlide ? styles.active : ""
//             }`}
//           />
//         ))}
//       </div>
//     </div>
//   );
// };

// export default HomeBanner;

import { useState, useEffect } from "react";
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

  const slides: Slide[] = [
    {
      id: 1,
      image: "/Image/banner1.jpg",
      title: "Latest Products",
      description: "Discover our newest and best products",
      buttonText: "View Now",
      link: "/products",
    },
    {
      id: 2,
      image: "/Image/banner2.jpg",
      title: "Special Promotion",
      description: "Up to 50% off on all products",
      buttonText: "Shop Now",
      link: "/products",
    },
    {
      id: 3,
      image: "/Image/banner3.jpg",
      title: "Customer Service",
      description: "We are always ready to support you 24/7",
      buttonText: "Contact Us",
      link: "/#footer",
    },
    {
      id: 4,
      image: "/Image/banner4.jpg",
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

  const handleButtonClick = (link?: string) => {
    if (link) {
      window.location.href = link;
    }
  };

  // Auto-play functionality
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000); // Change slide every 5 seconds

    return () => clearInterval(interval);
  }, [slides.length]);

  return (
    <div className="w-full max-w-[100vw] max-h-[400px] relative overflow-hidden rounded-[10px] shadow-[0_8px_20px_rgba(0,0,0,0.2)] my-[10px] mx-auto">
      <div
        className="flex transition-transform duration-500 ease-in-out h-[300px]"
        style={{ transform: `translateX(-${currentSlide * 100}%)` }}
      >
        {slides.map((slide) => (
          <div key={slide.id} className="min-w-full relative">
            <img
              src={slide.image}
              alt={`Slide ${slide.id}`}
              className="w-full h-full object-fill object-center transition-transform duration-300 hover:scale-105"
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

      <div className="absolute top-1/2 w-full flex justify-between px-5 -translate-y-1/2">
        <button
          onClick={prevSlide}
          className="bg-white/70 w-10 h-10 rounded-full flex justify-center items-center cursor-pointer transition-colors duration-300 text-xl font-bold border-none hover:bg-white/90"
        >
          &#10094;
        </button>
        <button
          onClick={nextSlide}
          className="bg-white/70 w-10 h-10 rounded-full flex justify-center items-center cursor-pointer transition-colors duration-300 text-xl font-bold border-none hover:bg-white/90"
        >
          &#10095;
        </button>
      </div>

      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-2 h-2 rounded-full cursor-pointer transition-colors duration-300 border-none ${
              index === currentSlide ? "bg-white" : "bg-white/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default HomeBanner;