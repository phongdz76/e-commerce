import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import NavBar from "./components/nav/NavBar";
import Footer from "./components/footer/Footer";
import CartProvider from "./providers/CartProvider";
import { Toaster } from "react-hot-toast";
import SupportWidget from "./components/support/SupportWidget";
import StoreLayoutWrapper from "./components/layout/StoreLayoutWrapper";
import CustomerServiceProvider from "./providers/CustomerServiceProvider";
import ExtensionCleanup from "./components/ExtensionCleanup";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SGTech",
  description: "ECommerce Application",
  icons: {
    icon: "/Image/sgtech_icon_cube.png",
    shortcut: "/favicon.ico",
    apple: "/Image/sgtech_icon_cube.png",
  },
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ExtensionCleanup />
      </head>
      <body
        className={`${poppins.className} text-slate-700`}
        suppressHydrationWarning
      >
        <Toaster
          toastOptions={{
            style: {
              background: "rgb(51 65 85)",
              color: "#fff",
            },
          }}
        />
        <CustomerServiceProvider><CartProvider>
          <StoreLayoutWrapper
            navbar={<NavBar />}
            footer={<Footer />}
            supportWidget={
              <SupportWidget />
            }
          >
            {children}
          </StoreLayoutWrapper>
        </CartProvider></CustomerServiceProvider>
      </body>
    </html>
  );
}
