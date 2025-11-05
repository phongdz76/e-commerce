import Image from "next/image";
import { FaUserCircle } from "react-icons/fa";
import { FaU } from "react-icons/fa6";

interface AvatarProps {
  src?: string | null | undefined;
}

export default function Avatar({ src }: AvatarProps) {
  if (src) {
    return (
      <Image
        src={src}
        alt="User Avatar"
        className="rounded-full"
        width="30"
        height="30"
      ></Image>
    );
  }

  return <FaUserCircle size={40} />;
}
