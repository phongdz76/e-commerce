import Link from "next/link";
import Container from "../Container";
import FooterList from "./FooterList";
import Image from "next/image";
import { MdFacebook } from "react-icons/md";
import { FaTwitter, FaInstagram, FaYoutube } from "react-icons/fa";

const Footer = () => {
  return (
    <footer
      className="bg-slate-700
    text-slate-200
    text-sm
    mt-10"
    >
      <Container>
        <div className="w-full pt-10 pb-2">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center">
                <span className="text-2xl font-bold text-white">SG</span>
                <span className="text-2xl font-bold text-teal-400">Tech</span>
              </div>
              <span className="text-2xl font-bold text-white">Location</span>
            </div>
            <p className="text-slate-300 flex items-center gap-2">
               <span>387 Bình Thành, Quận Bình Tân, TP. Hồ Chí Minh</span>
            </p>
          </div>
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3919.1239976004895!2d106.58435777451757!3d10.801813958726004!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31752b83ee842e07%3A0x2acdb55560c394d0!2zMzg3LCA1NyBCw6xuaCBUaMOgbmgsIEtodSBQaOG7kSA1LCBCw6xuaCBUw6JuLCBI4buTIENow60gTWluaCwgVmnhu4d0IE5hbQ!5e0!3m2!1svi!2s!4v1780799335446!5m2!1svi!2s"
            width="100%"
            height="300"
            style={{ border: 0, borderRadius: '0.5rem' }}
            allowFullScreen={true}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="SGTech Location Map"
          ></iframe>
        </div>
        <div
          id="footer"
          className="flex flex-col md:flex-row justify-between pt-8 pb-8"
        >
          <FooterList>
            <Link href="/" className={`text-2xl font-bold text-black mb-2`}>
              <span className="text-white">SG</span>
              <span className="text-teal-400">Tech</span>
            </Link>
            <p>Free support hotline</p>
            <p>Call for purchase: 1900 2004</p>
            <p className="whitespace-nowrap">Email: sgtech@gmail.com</p>
          </FooterList>

          <FooterList>
            <div className="font-bold text-lg">Shop Categories</div>
            <Link href="#" className="hover:text-teal-400 transition-colors">
              Phones
            </Link>
            <Link href="#" className="hover:text-teal-400 transition-colors">
              Laptops
            </Link>
            <Link href="#" className="hover:text-teal-400 transition-colors">
              Desktops
            </Link>
            <Link href="#" className="hover:text-teal-400 transition-colors">
              Watches
            </Link>
            <Link href="#" className="hover:text-teal-400 transition-colors">
              TVs
            </Link>
            <Link href="#" className="hover:text-teal-400 transition-colors">
              Accessories
            </Link>
          </FooterList>

          <FooterList>
            <div className="font-bold text-lg">Customer Service</div>
            <Link href="#" className="hover:text-teal-400 transition-colors">
              Contact Us
            </Link>
            <Link href="#" className="hover:text-teal-400 transition-colors">
              Returns & Exchanges
            </Link>
            <Link href="#" className="hover:text-teal-400 transition-colors">
              Shipping Policy
            </Link>
            <Link href="#" className="hover:text-teal-400 transition-colors">
              FAQs
            </Link>
          </FooterList>

          <FooterList>
            <div className="font-bold text-lg">Follow Us</div>
            <div className="flex flex-col items-start space-y-3">
              <Image
                src="/Image/qrcode.png"
                alt="QR Code - Follow Us"
                width={120}
                height={120}
                className="bg-white p-2 rounded"
                priority={true}
              />
              <p className="text-xs">Scan to follow us</p>

              <div className="flex gap-4 items-center">
                <Link
                  href="https://www.facebook.com/profile.php?id=100058767700619&mibextid=LQQJ4d"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-400 hover:text-white transition-colors"
                >
                  <MdFacebook size={24} />
                </Link>
                <Link
                  href="#"
                  className="text-teal-400 hover:text-white transition-colors flex items-center gap-1"
                >
                  <FaTwitter size={24} />
                </Link>
                <Link
                  href="https://www.instagram.com/__tphong7684/"
                  className="text-teal-400 hover:text-white transition-colors flex items-center gap-1"
                >
                  <FaInstagram size={24} />
                </Link>
                <Link
                  href="https://www.youtube.com/@PhongNguyen-ch9hv"
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
