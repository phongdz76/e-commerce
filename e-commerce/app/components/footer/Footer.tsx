import Link from "next/link";
import Container from "../Container";
import FooterList from "./FooterList";
import Image from "next/image";
import { MdFacebook } from "react-icons/md";
import { FaInstagram, FaYoutube } from "react-icons/fa";
import { getCatalogGroups } from "@/libs/storefrontCatalog";
import SupportHours from "@/app/components/support/SupportHours";
import ServiceContact from "@/app/components/support/ServiceContact";

const Footer = async () => {
  let categories;
  try {
    categories = (await getCatalogGroups()).categories;
  } catch {
    categories = null;
  }

  return (
    <footer
      className="bg-slate-700
    text-slate-200
    text-sm
    mt-10"
    >
      <Container>
        <div className="w-full pt-10 pb-2">
          <ServiceContact map />
        </div>
        <div
          className="flex flex-col md:flex-row justify-between pt-8 pb-8"
        >
          <FooterList>
            <Link href="/" className="text-2xl font-bold text-black mb-2">
              <span className="text-white">SG</span>
              <span className="text-teal-400">Tech</span>
            </Link>
            <ServiceContact dark />
          </FooterList>

          <FooterList>
            <div className="font-bold text-lg">Shop Categories</div>
            {categories === null && (
              <p className="text-slate-300">
                Categories are temporarily unavailable.
              </p>
            )}
            {categories?.map((category) => (
              <Link
                key={category.value}
                href={`/products?category=${encodeURIComponent(category.value)}`}
                className="hover:text-teal-400 transition-colors"
              >
                {category.label}
              </Link>
            ))}
          </FooterList>

          <FooterList>
            <div className="font-bold text-lg">Customer Service</div>
            <Link
              href="/support/requests/new"
              className="hover:text-teal-400 transition-colors"
            >
              Create support request
            </Link>
            <Link
              href="/support/requests"
              className="hover:text-teal-400 transition-colors"
            >
              Track your requests
            </Link>
            <SupportHours />
            <Link
              href="/help/contact"
              className="hover:text-teal-400 transition-colors"
            >
              Contact Us
            </Link>
            <Link
              href="/help/returns"
              className="hover:text-teal-400 transition-colors"
            >
              Returns & Exchanges
            </Link>
            <Link
              href="/help/shipping"
              className="hover:text-teal-400 transition-colors"
            >
              Shipping & Delivery
            </Link>
            <Link
              href="/help/faq"
              className="hover:text-teal-400 transition-colors"
            >
              FAQs
            </Link>
          </FooterList>

          <FooterList>
            <div className="font-bold text-lg">Follow Us</div>
            <div className="flex flex-col items-start space-y-3">
              <Image
                src="/Image/qr_code_v2.png"
                alt="QR Code - Follow Us"
                width={120}
                height={120}
                className="bg-white p-2 rounded"
              />
              <p className="text-sm">Scan to follow us</p>

              <div className="flex gap-4 items-center">
                <Link
                  href="https://www.facebook.com/profile.php?id=100058767700619&mibextid=LQQJ4d"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow SGTech on Facebook"
                  className="text-teal-400 hover:text-white transition-colors"
                >
                  <MdFacebook size={24} />
                </Link>
                <Link
                  href="https://www.instagram.com/__tphong7684/"
                  aria-label="Follow SGTech on Instagram"
                  className="text-teal-400 hover:text-white transition-colors flex items-center gap-1"
                >
                  <FaInstagram size={24} />
                </Link>
                <Link
                  href="https://www.youtube.com/@PhongNguyen-ch9hv"
                  aria-label="Follow SGTech on YouTube"
                  className="text-teal-400 hover:text-white transition-colors flex items-center gap-1"
                >
                  <FaYoutube size={24} />
                </Link>
              </div>
            </div>
          </FooterList>
        </div>

        <div className="border-t border-slate-600 pt-4 text-center">
          <p>&copy; {new Date().getFullYear()} SGTech. All rights reserved.</p>
        </div>
      </Container>
    </footer>
  );
};

export default Footer;
