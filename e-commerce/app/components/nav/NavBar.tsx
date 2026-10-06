import Container from "../Container";
import { Redressed } from "next/font/google";
import { getCurrentUser } from "@/actions/getCurrentUser";
import NavBarClient from "./NavBarClient";

const redressed = Redressed({ subsets: ["latin"], weight: "400" });

const NavBar = async () => {
  const currentUser = await getCurrentUser();

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
          <NavBarClient currentUser={currentUser} logoClassName={redressed.className} />
        </Container>
      </div>
    </div>
  );
};

export default NavBar;
