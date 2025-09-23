import Link from "next/link";
import Container from "../Container";
import { Redressed } from "next/font/google";

const redressed = Redressed({ subsets: ["latin"], weight: "400" });

const NavBar = () => {
  return (
    <div
      className="
    sticky
    top-0
    w-full
    bg-slate-200
    z-30
    shadow-sm"
    >
      <div
        className="
        py-4
        border-b-[1px]
        border-slate-200
        "
      >
        <Container>
          <div
            className="
          flex 
          items-center 
          justify-between 
          gap-3
          md:gap-0    
          "
          >
            <Link href="/" className={`${redressed.className} text-2xl font-bold text-black`}>
              <span className="text-black">SG</span>
              <span className="text-teal-400">Tech</span>
            </Link>
            <div>Search</div>
            <div className="flex items-center gap-8 md:gap-12">
              <div>CartCount</div>
              <div>UserMenu</div>
            </div>
          </div>
        </Container>
      </div>
    </div>
  );
};

export default NavBar;
