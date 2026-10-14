import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import NavBar from "./components/nav/NavBar";
import Footer from "./components/footer/Footer";
import CartProvider from "./providers/CartProvider";
import { Toaster } from "react-hot-toast";
import SupportWidget from "./components/support/SupportWidget";
import StoreLayoutWrapper from "./components/layout/StoreLayoutWrapper";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SGTech",
  description: "ECommerce Application",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${poppins.className} text-slate-700`}>
        <Toaster
          toastOptions={{
            style: {
              background: "rgb(51 65 85)",
              color: "#fff",
            },
          }}
        />
        <CartProvider>
          <StoreLayoutWrapper
            navbar={<NavBar />}
            footer={<Footer />}
            supportWidget={
              <SupportWidget zaloUrl={process.env.NEXT_PUBLIC_ZALO_URL} />
            }
          >
            {children}
          </StoreLayoutWrapper>
        </CartProvider>
      </body>
    </html>
  );
}
