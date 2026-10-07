// Local catalog photograph sources are recorded in scripts/product-image-sources.json.

export const products = [
  {
    id: "64a654593e91b8e73a351e9b",
    name: "iphone 14",
    description: "Short description",
    price: 7197600, 
    brand: "apple",
    category: "Phone",
    inStock: true,
    images: [
      {
        "color": "White",
        "colorCode": "#FFFFFF",
        "image": "/products/iphone14-white.webp"
      }
    ],
    reviews: [],
  },
  {
    id: "64a4ebe300900d44bb50628a",
    name: "Logitech MX Keys Advanced Wireless Illuminated Keyboard, Tactile Responsive Typing, Backlighting, Bluetooth, USB-C, Apple macOS, Microsoft Windows, Linux, iOS, Android, Metal Build (Black)",
    description:
      "PERFECT STROKE KEYS - Spherically-dished keys match the shape of your fingertips, offering satisfying feedback with every tap\nCOMFORT AND STABILITY - Type with confidence on a keyboard crafted for comfort, stability, and precision",
    price: 2471760, 
    brand: "logitech",
    category: "Accesories",
    inStock: true,
    images: [
      {
        color: "Black",
        colorCode: "#000000",
        image:
          "https://m.media-amazon.com/images/I/71gOLg2-kqL.__AC_SX300_SY300_QL70_FMwebp_.jpg",
      },
    ],
    reviews: [
      {
        id: "64a65a6158b470c6e06959ee",
        userId: "6475af156bad4917456e6e1e",
        productId: "64a4ebe300900d44bb50628a",
        rating: 5,
        comment: "good",
        createdDate: "2023-07-06T06:08:33.067Z",
        user: {
          id: "6475af156bad4917456e6e1e",
          name: "Charles",
          email: "example@gmail.com",
          emailVerified: null,
          image:
            "https://lh3.googleusercontent.com/a/AAcHTteOiCtILLBWiAoolIW9PJH-r5825pBDl824_8LD=s96-c",
          hashedPassword: null,
          createdAt: "2023-05-30T08:08:53.979Z",
          updatedAt: "2023-05-30T08:08:53.979Z",
          role: "ADMIN",
        },
      },
    ],
  },
  {
    id: "648437b38c44d52b9542e340",
    name: "Apple iPhone 13, 64GB",
    description:
      'The product is refurbished, fully functional, and in excellent condition. Backed by the 90-day E~Shop Renewed Guarantee.\n- This pre-owned product has been professionally inspected, tested and cleaned by Amazon qualified vendors. It is not certified by Apple.\n- This product is in "Excellent condition". The screen and body show no signs of cosmetic damage visible from 12 inches away.\n- This product will have a battery that exceeds 80% capacity relative to new.\n- Accessories may not be original, but will be compatible and fully functional. Product may come in generic box.\n- Product will come with a SIM removal tool, a charger and a charging cable. Headphone and SIM card are not included.\n- This product is eligible for a replacement or refund within 90-day of receipt if it does not work as expected.\n- Refurbished phones are not guaranteed to be waterproof.',
    price: 960000, 
    brand: "Apple",
    category: "Phone",
    inStock: true,
    images: [
      {
        color: "Black",
        colorCode: "#000000",
        image:
          "https://m.media-amazon.com/images/I/61g+McQpg7L._AC_SX679_.jpg",
      },
      {
        color: "Blue",
        colorCode: " #0000FF",
        image:
          "https://m.media-amazon.com/images/I/713Om9vCHUL._AC_SX679_.jpg",
      },
      {
        color: "Red",
        colorCode: "#FF0000",
        image:
          "https://m.media-amazon.com/images/I/61thdjmfHcL.__AC_SX300_SY300_QL70_FMwebp_.jpg",
      },
    ],
    reviews: [
      {
        id: "6499b4887402b0efd394d8f3",
        userId: "6499b184b0e9a8c8709821d3",
        productId: "648437b38c44d52b9542e340",
        rating: 4,
        comment:
          "good enough. I like the camera and casing. the delivery was fast too.",
        createdDate: "2023-06-26T15:53:44.483Z",
        user: {
          id: "6499b184b0e9a8c8709821d3",
          name: "Chaoo",
          email: "example1@gmail.com",
          emailVerified: null,
          image:
            "https://lh3.googleusercontent.com/a/AAcHTtcuRLwWi1vPKaQOcJlUurlhRAIIq2LgYccE8p32=s96-c",
          hashedPassword: null,
          createdAt: "2023-06-26T15:40:52.558Z",
          updatedAt: "2023-06-26T15:40:52.558Z",
          role: "USER",
        },
      },
      {
        id: "6499a110efe4e4de451c7edc",
        userId: "6475af156bad4917456e6e1e",
        productId: "648437b38c44d52b9542e340",
        rating: 5,
        comment: "I really liked it!!",
        createdDate: "2023-06-26T14:30:40.998Z",
        user: {
          id: "6475af156bad4917456e6e1e",
          name: "Charles",
          email: "example@gmail.com",
          emailVerified: null,
          image:
            "https://lh3.googleusercontent.com/a/AAcHTteOiCtILLBWiAoolIW9PJH-r5825pBDl824_8LD=s96-c",
          hashedPassword: null,
          createdAt: "2023-05-30T08:08:53.979Z",
          updatedAt: "2023-05-30T08:08:53.979Z",
          role: "ADMIN",
        },
      },
    ],
  },
  {
    id: "64a4e9e77e7299078334019f",
    name: "Logitech MX Master 2S Wireless Mouse – Use on Any Surface, Hyper-Fast Scrolling, Ergonomic Shape, Rechargeable, Control Upto 3 Apple Mac and Windows Computers, Graphite",
    description:
      "Cross computer control: Game changing capacity to navigate seamlessly on 3 computers, and copy paste text, images, and files from 1 to the other using Logitech flow\nDual connectivity: Use with upto 3 Windows or Mac computers via included Unifying receiver or Bluetooth Smart wireless technology. Gesture button- Yes",
    price: 1680000, 
    brand: "logitech",
    category: "Accesories",
    inStock: true,
    images: [
      {
        color: "Graphite",
        colorCode: " #383838",
        image:
          "https://m.media-amazon.com/images/I/61ni3t1ryQL.__AC_SX300_SY300_QL70_FMwebp_.jpg",
      },
    ],
    reviews: [],
  },
  {
    id: "649d775128b6744f0f497040",
    name: 'Smart Watch(Answer/Make Call), 1.85" Smartwatch for Men Women IP68 Waterproof, 100+ Sport Modes, Fitness Activity Tracker, Heart Rate Sleep Monitor, Pedometer, Smart Watches for Android iOS, 2023',
    description:
      'Bluetooth Call and Message Reminder: The smart watch is equipped with HD speaker, after connecting to your phone via Bluetooth, you can directly use the smartwatches to answer or make calls, read messages, store contacts, view call history. The smartwatch can set up more message notifications in "GloryFit" APP. You will never miss any calls and messages during meetings, workout and riding.',
    price: 1200000, 
    brand: "Nerunsa",
    category: "Watch",
    inStock: true,
    images: [
      {
        color: "Black",
        colorCode: "#000000",
        image:
          "https://m.media-amazon.com/images/I/71s4mjiit3L.__AC_SX300_SY300_QL70_FMwebp_.jpg",
      },
      {
        color: "Silver",
        colorCode: "#C0C0C0",
        image:
          "https://m.media-amazon.com/images/I/71zbWSRMaYL.__AC_SX300_SY300_QL70_FMwebp_.jpg",
      },
    ],
    reviews: [],
  },
  // Sample catalog entries. Prices and configurations are illustrative; photograph sources are in scripts/product-image-sources.json.
  {
    "id": "670000000000000000000001",
    "name": "Apple iPhone 14, 128GB, White",
    "description": "An everyday iPhone for calls, photos, messaging and your favorite apps.",
    "price": 13990000,
    "brand": "Apple",
    "category": "Phone",
    "inStock": true,
    "images": [
      {
        "color": "White",
        "colorCode": "#FFFFFF",
        "image": "/products/iphone14-white.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "670000000000000000000002",
    "name": "Apple MacBook Air 13-inch, 8GB RAM, 256GB SSD",
    "description": "A portable MacBook for documents, browsing, video calls and everyday productivity.",
    "price": 16990000,
    "brand": "Apple",
    "category": "Laptop",
    "inStock": true,
    "images": [
      {
        "color": "Silver",
        "colorCode": "#C0C0C0",
        "image": "/products/macbook-air-silver.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "670000000000000000000003",
    "name": "Apple iMac 24-inch, 8GB RAM, 256GB SSD",
    "description": "An all-in-one Mac workspace for everyday documents, media and creative projects.",
    "price": 269900000,
    "brand": "Apple",
    "category": "Desktop",
    "inStock": true,
    "images": [
      {
        "color": "Silver",
        "colorCode": "#C0C0C0",
        "image": "/products/imac24-silver.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "670000000000000000000004",
    "name": "Apple Watch SE, 44mm, Black",
    "description": "An everyday Apple Watch for notifications and keeping track of daily activity.",
    "price": 5990000,
    "brand": "Apple",
    "category": "Watch",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#171717",
        "image": "/products/apple-watch-se-black.webp"
      },
      {
        "color": "Silver",
        "colorCode": "#C0C0C0",
        "image": "/products/apple-watch-se-silver.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "670000000000000000000005",
    "name": "Samsung Smart TV 32-inch, HD",
    "description": "A compact Samsung television for a bedroom or smaller home entertainment space.",
    "price": 4990000,
    "brand": "Samsung",
    "category": "TV",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#000000",
        "image": "/products/samsung-tv32.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "670000000000000000000006",
    "name": "Logitech MX Keys Wireless Keyboard, Black",
    "description": "Comfortable wireless typing for daily work, documents and your desktop setup.",
    "price": 2471760,
    "brand": "Logitech",
    "category": "Accesories",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#000000",
        "image": "https://m.media-amazon.com/images/I/71gOLg2-kqL.__AC_SX300_SY300_QL70_FMwebp_.jpg"
      }
    ],
    "reviews": []
  },
  {
    "id": "670000000000000000000007",
    "name": "Samsung Galaxy A15, 128GB, Black",
    "description": "A Galaxy smartphone for staying connected, browsing and everyday entertainment.",
    "price": 4990000,
    "brand": "Samsung",
    "category": "Phone",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#171717",
        "image": "/products/samsung-galaxy-a15-black.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "670000000000000000000008",
    "name": "Dell Inspiron 15, 8GB RAM, 512GB SSD",
    "description": "An Inspiron laptop for online classes, office applications and everyday tasks.",
    "price": 11990000,
    "brand": "Dell",
    "category": "Laptop",
    "inStock": true,
    "images": [
      {
        "color": "Silver",
        "colorCode": "#C0C0C0",
        "image": "/products/dell-inspiron15-silver.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "670000000000000000000009",
    "name": "Dell OptiPlex Desktop, 8GB RAM, 512GB SSD",
    "description": "An OptiPlex desktop configuration for everyday office applications and browsing.",
    "price": 11990000,
    "brand": "Dell",
    "category": "Desktop",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#000000",
        "image": "/products/dell-optiplex-black.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "67000000000000000000000a",
    "name": "Samsung Galaxy Watch6, 44mm, Black",
    "description": "A Galaxy smartwatch for useful notifications and staying connected throughout your day.",
    "price": 4990000,
    "brand": "Samsung",
    "category": "Watch",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#171717",
        "image": "/products/samsung-watch6-black.webp"
      },
      {
        "color": "Silver",
        "colorCode": "#C0C0C0",
        "image": "/products/samsung-watch6-silver.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "67000000000000000000000b",
    "name": "LG Smart TV 43-inch, Full HD",
    "description": "An LG television for movies, shows and everyday family viewing.",
    "price": 6490000,
    "brand": "LG",
    "category": "TV",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#000000",
        "image": "/products/lg-tv43.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "67000000000000000000000c",
    "name": "Razer BlackWidow V3 Keyboard, Black",
    "description": "A Razer keyboard for a gaming setup, everyday typing and desktop navigation.",
    "price": 2990000,
    "brand": "Razer",
    "category": "Accesories",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#000000",
        "image": "/products/razer-blackwidow-v3.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "67000000000000000000000d",
    "name": "Xiaomi Redmi Note 13, 256GB, Black",
    "description": "A Redmi smartphone with space for your daily apps, photos and videos.",
    "price": 5990000,
    "brand": "Xiaomi",
    "category": "Phone",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#171717",
        "image": "/products/redmi-note13-black.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "67000000000000000000000e",
    "name": "HP Pavilion 15, 16GB RAM, 512GB SSD",
    "description": "A Pavilion laptop for work, study and keeping multiple applications organized.",
    "price": 15990000,
    "brand": "HP",
    "category": "Laptop",
    "inStock": true,
    "images": [
      {
        "color": "Silver",
        "colorCode": "#C0C0C0",
        "image": "/products/hp-pavilion15-silver.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "67000000000000000000000f",
    "name": "HP ProDesk Desktop, 8GB RAM, 512GB SSD",
    "description": "A ProDesk configuration for documents, spreadsheets and daily office work.",
    "price": 10990000,
    "brand": "HP",
    "category": "Desktop",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#000000",
        "image": "/products/hp-prodesk-black.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "670000000000000000000010",
    "name": "Garmin Venu Sq 2, Black",
    "description": "A Garmin smartwatch for keeping an eye on an active routine and daily activity.",
    "price": 5990000,
    "brand": "Garmin",
    "category": "Watch",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#171717",
        "image": "/products/garmin-venu-sq2-black.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "670000000000000000000011",
    "name": "Sony BRAVIA Smart TV 43-inch, 4K",
    "description": "A BRAVIA television for watching favorite movies and shows in your living space.",
    "price": 10990000,
    "brand": "Sony",
    "category": "TV",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#000000",
        "image": "/products/sony-tv43.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "670000000000000000000012",
    "name": "Corsair K55 RGB Keyboard, Black",
    "description": "A Corsair keyboard for gaming, coursework and an organized desktop workspace.",
    "price": 1490000,
    "brand": "Corsair",
    "category": "Accesories",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#000000",
        "image": "/products/corsair-k55-rgb.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "670000000000000000000013",
    "name": "OPPO Reno11, 256GB, Black",
    "description": "A Reno smartphone for everyday photography, messages and entertainment on the go.",
    "price": 9990000,
    "brand": "OPPO",
    "category": "Phone",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#171717",
        "image": "/products/oppo-reno11-black.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "670000000000000000000014",
    "name": "ASUS Vivobook 15, 16GB RAM, 512GB SSD",
    "description": "A Vivobook for everyday documents, presentations and personal projects.",
    "price": 14990000,
    "brand": "ASUS",
    "category": "Laptop",
    "inStock": true,
    "images": [
      {
        "color": "Silver",
        "colorCode": "#C0C0C0",
        "image": "/products/asus-vivobook15-silver.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "670000000000000000000015",
    "name": "Lenovo ThinkCentre Desktop, 16GB RAM, 512GB SSD",
    "description": "A ThinkCentre desktop workspace for study, research and everyday productivity.",
    "price": 13990000,
    "brand": "Lenovo",
    "category": "Desktop",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#000000",
        "image": "/products/lenovo-thinkcentre-black.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "670000000000000000000016",
    "name": "Huawei Watch Fit 3, Black",
    "description": "A smartwatch for everyday reminders, activity tracking and an organized daily routine.",
    "price": 2990000,
    "brand": "Huawei",
    "category": "Watch",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#171717",
        "image": "/products/huawei-watch-fit3-black.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "670000000000000000000017",
    "name": "TCL Smart TV 50-inch, 4K",
    "description": "A larger TCL television for movie nights and shared home entertainment.",
    "price": 8990000,
    "brand": "TCL",
    "category": "TV",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#000000",
        "image": "/products/tcl-tv50.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "670000000000000000000018",
    "name": "Anker Wireless Vertical Ergonomic Mouse, Black",
    "description": "A vertical wireless mouse for comfortable everyday navigation and office tasks.",
    "price": 790000,
    "brand": "Anker",
    "category": "Accesories",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#000000",
        "image": "/products/anker-vertical-mouse.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "670000000000000000000019",
    "name": "Vivo V30, 256GB, Black",
    "description": "A versatile smartphone for photos, video calls and your everyday routine.",
    "price": 11990000,
    "brand": "Vivo",
    "category": "Phone",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#171717",
        "image": "/products/vivo-v30-black.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "67000000000000000000001a",
    "name": "Lenovo IdeaPad Slim 3, 16GB RAM, 512GB SSD",
    "description": "An IdeaPad laptop for coursework, browsing and daily productivity.",
    "price": 13990000,
    "brand": "Lenovo",
    "category": "Laptop",
    "inStock": true,
    "images": [
      {
        "color": "Silver",
        "colorCode": "#C0C0C0",
        "image": "/products/lenovo-ideapad-slim3-silver.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "67000000000000000000001b",
    "name": "ASUS ExpertCenter Desktop, 16GB RAM, 1TB SSD",
    "description": "An ExpertCenter configuration for office applications and an expanding file library.",
    "price": 15990000,
    "brand": "ASUS",
    "category": "Desktop",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#000000",
        "image": "/products/asus-expertcenter-black.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "67000000000000000000001c",
    "name": "Xiaomi Redmi Watch 4, Black",
    "description": "A Redmi smartwatch for daily activity and convenient notifications.",
    "price": 2490000,
    "brand": "Xiaomi",
    "category": "Watch",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#171717",
        "image": "/products/redmi-watch4-black.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "67000000000000000000001d",
    "name": "Hisense Smart TV 55-inch, 4K",
    "description": "A Hisense television for a comfortable living-room viewing setup.",
    "price": 10990000,
    "brand": "Hisense",
    "category": "TV",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#000000",
        "image": "/products/hisense-tv55.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "67000000000000000000001e",
    "name": "Baseus F02 Ergonomic Wireless Mouse, Black",
    "description": "A Baseus wireless mouse for daily browsing, studying and desktop productivity.",
    "price": 590000,
    "brand": "Baseus",
    "category": "Accesories",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#000000",
        "image": "/products/baseus-f02-mouse.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "67000000000000000000001f",
    "name": "Samsung Galaxy A55, 256GB, Black",
    "description": "A Galaxy smartphone for work, photography and keeping your everyday media close.",
    "price": 10990000,
    "brand": "Samsung",
    "category": "Phone",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#171717",
        "image": "/products/samsung-galaxy-a55-black.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "670000000000000000000020",
    "name": "Acer Aspire 5, 16GB RAM, 512GB SSD",
    "description": "An Aspire laptop for a flexible everyday workspace at home or on the go.",
    "price": 12990000,
    "brand": "Acer",
    "category": "Laptop",
    "inStock": true,
    "images": [
      {
        "color": "Silver",
        "colorCode": "#C0C0C0",
        "image": "/products/acer-aspire5-silver.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "670000000000000000000021",
    "name": "Acer Aspire Desktop, 16GB RAM, 512GB SSD",
    "description": "An everyday Aspire desktop for home tasks, documents and entertainment.",
    "price": 12990000,
    "brand": "Acer",
    "category": "Desktop",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#000000",
        "image": "/products/acer-aspire-desktop-black.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "670000000000000000000022",
    "name": "Amazfit Bip 5, Black",
    "description": "An everyday Amazfit smartwatch for staying on top of reminders and activity.",
    "price": 2190000,
    "brand": "Amazfit",
    "category": "Watch",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#171717",
        "image": "/products/amazfit-bip5-black.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "670000000000000000000023",
    "name": "Panasonic Smart TV 55-inch, 4K",
    "description": "A Panasonic television for everyday shows, movies and family entertainment.",
    "price": 13990000,
    "brand": "Panasonic",
    "category": "TV",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#000000",
        "image": "/products/panasonic-tv55.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "670000000000000000000024",
    "name": "Belkin Wired USB Ergonomic Mouse, Black",
    "description": "A wired USB mouse for a straightforward everyday desktop or laptop setup.",
    "price": 390000,
    "brand": "Belkin",
    "category": "Accesories",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#000000",
        "image": "/products/belkin-wired-mouse.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "670000000000000000000025",
    "name": "Xiaomi 14, 256GB, Black",
    "description": "A compact everyday smartphone for photography, productivity and mobile entertainment.",
    "price": 19990000,
    "brand": "Xiaomi",
    "category": "Phone",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#171717",
        "image": "/products/xiaomi14-black.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "670000000000000000000026",
    "name": "MSI Thin 15, 16GB RAM, 512GB SSD",
    "description": "A laptop configuration for entertainment, personal projects and multitasking.",
    "price": 18990000,
    "brand": "MSI",
    "category": "Laptop",
    "inStock": true,
    "images": [
      {
        "color": "Gray",
        "colorCode": "#808080",
        "image": "/products/msi-thin15-gray.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "670000000000000000000027",
    "name": "Dell OptiPlex Desktop, 16GB RAM, 1TB SSD",
    "description": "An OptiPlex configuration with additional memory and storage for larger projects.",
    "price": 16990000,
    "brand": "Dell",
    "category": "Desktop",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#000000",
        "image": "/products/dell-optiplex-black.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "670000000000000000000028",
    "name": "Samsung Galaxy Watch6 Classic, 47mm, Black",
    "description": "A Galaxy smartwatch for your everyday schedule, notifications and active routine.",
    "price": 6990000,
    "brand": "Samsung",
    "category": "Watch",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#171717",
        "image": "/products/samsung-watch6-classic-black.webp"
      },
      {
        "color": "Silver",
        "colorCode": "#C0C0C0",
        "image": "/products/samsung-watch6-classic-silver.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "670000000000000000000029",
    "name": "Samsung Smart TV 65-inch, 4K",
    "description": "A spacious Samsung television for a larger room and shared viewing.",
    "price": 16990000,
    "brand": "Samsung",
    "category": "TV",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#000000",
        "image": "/products/samsung-tv65.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "67000000000000000000002a",
    "name": "Apple iPhone 13, 256GB, Black",
    "description": "An everyday iPhone with room for a larger photo library and your favorite apps.",
    "price": 12990000,
    "brand": "Apple",
    "category": "Phone",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#000000",
        "image": "https://m.media-amazon.com/images/I/61g+McQpg7L._AC_SX679_.jpg"
      },
      {
        "color": "Blue",
        "colorCode": " #0000FF",
        "image": "https://m.media-amazon.com/images/I/713Om9vCHUL._AC_SX679_.jpg"
      },
      {
        "color": "Red",
        "colorCode": "#FF0000",
        "image": "https://m.media-amazon.com/images/I/61thdjmfHcL.__AC_SX300_SY300_QL70_FMwebp_.jpg"
      }
    ],
    "reviews": []
  },
  {
    "id": "67000000000000000000002b",
    "name": "Apple MacBook Air 13-inch, 16GB RAM, 512GB SSD",
    "description": "A portable MacBook configuration with extra memory and storage for a busy workflow.",
    "price": 24990000,
    "brand": "Apple",
    "category": "Laptop",
    "inStock": true,
    "images": [
      {
        "color": "Silver",
        "colorCode": "#C0C0C0",
        "image": "/products/macbook-air-silver.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "67000000000000000000002c",
    "name": "HP ProDesk Desktop, 32GB RAM, 1TB SSD",
    "description": "A ProDesk configuration with extra memory for multiple applications and office projects.",
    "price": 19990000,
    "brand": "HP",
    "category": "Desktop",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#000000",
        "image": "/products/hp-prodesk-black.webp"
      }
    ],
    "reviews": []
  },
  {
    "id": "67000000000000000000002d",
    "name": "LG Smart TV 75-inch, 4K",
    "description": "A large LG television for movie nights and group viewing at home.",
    "price": 22990000,
    "brand": "LG",
    "category": "TV",
    "inStock": true,
    "images": [
      {
        "color": "Black",
        "colorCode": "#000000",
        "image": "/products/lg-tv75.webp"
      }
    ],
    "reviews": []
  },
  {
    id: "67000000000000000000002e",
    name: "Sony WH-1000XM5 Wireless Headphones",
    description: "Sample Sony over-ear headphones for music, calls and everyday listening. Product image is illustrative.",
    price: 6990000,
    brand: "Sony",
    category: "Headphone",
    inStock: true,
    images: [
      {
        "color": "Black",
        "colorCode": "#000000",
        "image": "/products/sony-wh1000xm5-black.webp"
      }
    ],
    reviews: [],
  },
  {
    id: "67000000000000000000002f",
    name: "Bose QuietComfort Wireless Headphones",
    description: "Sample Bose over-ear headphones for a personal listening setup. Product image is illustrative.",
    price: 5990000,
    brand: "Bose",
    category: "Headphone",
    inStock: true,
    images: [
      {
        "color": "Black",
        "colorCode": "#000000",
        "image": "/products/bose-quietcomfort-black.webp"
      }
    ],
    reviews: [],
  },
  {
    id: "670000000000000000000030",
    name: "JBL Tune 720BT Wireless Headphones",
    description: "Sample JBL headphones for playlists and calls throughout the day. Product image is illustrative.",
    price: 1490000,
    brand: "JBL",
    category: "Headphone",
    inStock: true,
    images: [
      {
        "color": "Black",
        "colorCode": "#000000",
        "image": "/products/jbl-tune720bt-black.webp"
      }
    ],
    reviews: [],
  },
  {
    id: "670000000000000000000031",
    name: "Sennheiser Accentum Wireless Headphones",
    description: "Sample Sennheiser headphones for your desk and daily commute. Product image is illustrative.",
    price: 3990000,
    brand: "Sennheiser",
    category: "Headphone",
    inStock: true,
    images: [
      {
        "color": "Black",
        "colorCode": "#000000",
        "image": "/products/sennheiser-accentum-black.webp"
      }
    ],
    reviews: [],
  },
];
