import Image from "next/image";
import { FaUserCircle } from "react-icons/fa";

interface AvatarProps {
  src?: string | null | undefined;
  size?: number;
}

export default function Avatar({ src, size = 30 }: AvatarProps) {
  if (src) {
    return (
      <Image
        src={src}
        alt="User Avatar"
        className="rounded-full"
        width={size}
        height={size}
      ></Image>
    );
  }

  return <FaUserCircle size={size} className="text-slate-400" />;
}
