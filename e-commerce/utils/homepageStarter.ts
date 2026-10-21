import { HOME_SECTIONS, type HomeContent, type HomeSlide } from "@/types/homepageContent";

const collectionDefaults = [
  {
    id: "phones", category: "Phone", eyebrow: "YOUR EVERYDAY CONNECTION",
    title: ["Big ideas.", "Pocket size.", "All yours."],
    description: ["Keep your world within reach.", "Find a phone that fits your day."],
    cta: "Explore phones", caption: "CONNECT. CAPTURE. DISCOVER.",
    main: { src: "/home/banner-samsung-galaxy-a55-black.png", alt: "Samsung Galaxy A55 smartphone" },
    companion: { src: "/home/banner-iphone14-white.png", alt: "White iPhone 14 smartphone" },
    surface: "#f6edf0", glow: "#efd5e0", ring: "#d9b3c3", halo: "#e9c8d333",
  },
  {
    id: "laptops", category: "Laptop", eyebrow: "ROOM FOR YOUR NEXT BIG IDEA",
    title: ["More ideas.", "More room.", "To create."],
    description: ["From first draft to big ideas.", "Find your everyday laptop."],
    cta: "Explore laptops", caption: "THINK. MAKE. CREATE.",
    main: { src: "/home/banner-macbook-air-silver.png", alt: "Silver MacBook Air laptop" },
    companion: { src: "/home/banner-asus-vivobook15-silver.png", alt: "Silver ASUS Vivobook laptop" },
    surface: "#edf1f8", glow: "#d4def4", ring: "#b0bfdc", halo: "#cbd7ee33",
  },
  {
    id: "audio", category: "Headphone", eyebrow: "A SOUNDTRACK THAT IS ALL YOURS",
    title: ["Your world.", "Better", "with sound."],
    description: ["A little music. A moment for you.", "Find your next pair of headphones."],
    cta: "Explore headphones", caption: "LISTEN. FOCUS. UNWIND.",
    main: { src: "/products/sony-wh1000xm5-black.webp", alt: "Sony WH-1000XM5 wireless headphones" },
    companion: { src: "/home/banner-bose-quietcomfort-black.png", alt: "Bose QuietComfort wireless headphones" },
    surface: "#f0edf7", glow: "#e2d6f1", ring: "#c7b4db", halo: "#d9c7eb33",
  },
  {
    id: "watches", category: "Watch", eyebrow: "MAKE TIME FOR WHAT YOU LOVE",
    title: ["Your day.", "Your way.", "Your pace."],
    description: ["Meet your everyday companion.", "Find a watch that fits your style."],
    cta: "Explore watches", caption: "MOVE. EXPLORE. REPEAT.",
    main: { src: "/home/banner-samsung-watch6-silver.png", alt: "Silver Samsung Galaxy Watch6" },
    companion: { src: "/home/banner-apple-watch-se-black.png", alt: "Black Apple Watch SE" },
    surface: "#f6f1e8", glow: "#eddfc4", ring: "#d5c29c", halo: "#e8d8b833",
  },
  {
    id: "workspace", category: "Desktop", eyebrow: "A FRESH PERSPECTIVE ON YOUR DESK",
    title: ["Less fuss.", "More focus.", "Your space."],
    description: ["Give your ideas room to grow.", "Build a setup that works for you."],
    cta: "Explore desktops", caption: "YOUR DESK. YOUR POSSIBILITIES.",
    main: { src: "/home/banner-imac24-silver.png", alt: "Silver Apple iMac desktop computer" },
    companion: { src: "/home/accessories-mouse.png", alt: "Graphite wireless computer mouse" },
    surface: "#edf4f3", glow: "#d1e9e3", ring: "#a8cec3", halo: "#beded333",
  },
] as const;

export function starterHomeContent(): HomeContent {
  const intro: HomeSlide = {
    id: "intro", enabled: true, startsAt: null, endsAt: null, art: "intro",
    eyebrow: "A little upgrade. A big difference.", title: ["Your next", "upgrade", "starts here."],
    description: ["Find the tech that fits your day.", "From work mode to your downtime."],
    cta: "Explore products", caption: "WORK. PLAY. CREATE.", target: { kind: "CATALOG", value: "" },
    main: { src: "/home/banner-macbook-air-silver.png", alt: "Silver MacBook Air" },
    companion: { src: "/home/banner-iphone14-white.png", alt: "White iPhone 14" },
    surface: "#edf4f4", glow: "#d0f0ed", ring: "#aacfc7", halo: "#cde7df33",
  };
  return {
    slides: [intro, ...collectionDefaults.map(({ category, ...row }) => ({
      ...row, title: [...row.title] as HomeSlide["title"], description: [...row.description] as HomeSlide["description"],
      enabled: true, startsAt: null, endsAt: null, art: row.id,
      target: { kind: "CATEGORY" as const, value: category },
    }))],
    heroTiles: [
      { id: "audio-tile", enabled: true, eyebrow: "TUNE INTO YOUR WORLD", title: "More sound.\nLess noise.", cta: "Explore headphones", image: { src: "/products/sony-wh1000xm5-black.webp", alt: "Sony wireless over-ear headphones" }, target: { kind: "CATEGORY", value: "Headphone" }, tone: "audio" },
      { id: "laptop-tile", enabled: true, eyebrow: "MADE FOR YOUR EVERYDAY", title: "Work smart.\nPlay more.", cta: "Discover laptops", image: { src: "/products/asus-vivobook15-silver.webp", alt: "ASUS everyday laptop" }, target: { kind: "CATEGORY", value: "Laptop" }, tone: "laptop" },
    ],
    collections: [
      { id: "laptop-collection", enabled: true, eyebrow: "YOUR EVERYDAY, UPGRADED", title: "Big ideas.\nMeet your next laptop.", cta: "Find your laptop", image: { src: "/products/macbook-air-silver.webp", alt: "MacBook Air laptop collection" }, target: { kind: "CATEGORY", value: "Laptop" }, tone: "audio" },
      { id: "accessories-collection", enabled: true, eyebrow: "SMALL DETAILS. BIG DIFFERENCE.", title: "Make your\nsetup your own.", cta: "Explore accessories", image: { src: "/home/accessories-mouse.png", alt: "Wireless mouse for your desk setup" }, target: { kind: "CATEGORY", value: "Accessories" }, tone: "neutral" },
    ],
    featuredProductIds: [], sections: HOME_SECTIONS.map(id => ({ id, enabled: true })), categoryMedia: [], brandMedia: [],
  };
}
