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
        <div className="flex flex-col md:flex-row justify-between pt-16 pb-8">
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
            <Link href="#" className="hover:text-teal-400 transition-colors">Phones</Link>
            <Link href="#" className="hover:text-teal-400 transition-colors">Laptops</Link>
            <Link href="#" className="hover:text-teal-400 transition-colors">Desktops</Link>
            <Link href="#" className="hover:text-teal-400 transition-colors">Watches</Link>
            <Link href="#" className="hover:text-teal-400 transition-colors">TVs</Link>
            <Link href="#" className="hover:text-teal-400 transition-colors">Accessories</Link>
          </FooterList>

          <FooterList>
            <div className="font-bold text-lg">Customer Service</div>
            <Link href="#" className="hover:text-teal-400 transition-colors">Contact Us</Link>
            <Link href="#" className="hover:text-teal-400 transition-colors">Returns & Exchanges</Link>
            <Link href="#" className="hover:text-teal-400 transition-colors">Shipping Policy</Link>
            <Link href="#" className="hover:text-teal-400 transition-colors">FAQs</Link>
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
                  <FaTwitter size={20} />
                </Link>
                <Link 
                  href="https://www.instagram.com/__tphong7684/" 
                  className="text-teal-400 hover:text-white transition-colors flex items-center gap-1"
                >
                  <FaInstagram size={20} />
                </Link>
                <Link 
                  href="https://www.youtube.com/@PhongNguyen-ch9hv" 
                  className="text-teal-400 hover:text-white transition-colors flex items-center gap-1"
                >
                  <FaYoutube size={20} />
                </Link>
              </div>
            </div>
          </FooterList>
        </div>
        
        <div className="border-t border-slate-600 pt-4 text-center">
          <p>
            &copy; {new Date().getFullYear()} SGTech. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  );
};

export default Footer;