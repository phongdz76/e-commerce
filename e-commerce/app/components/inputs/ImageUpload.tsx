"use client";

import { CldUploadWidget } from "next-cloudinary";
import { useCallback } from "react";
import { TbPhotoPlus } from "react-icons/tb";

interface ImageUploadProps {
  onChange: (value: string) => void;
  value?: string;
  uploadPreset: "ecommerce_avatar" | "ecommerce_product";
}

interface CloudinaryResult {
  info?: {
    secure_url?: string;
  };
}

export default function ImageUpload({
  onChange,
  uploadPreset,
}: ImageUploadProps) {
  const handleUpload = useCallback(
    (result: unknown) => {
      const secureUrl = (result as CloudinaryResult)?.info?.secure_url;
      if (secureUrl) {
        onChange(secureUrl);
      }
    },
    [onChange]
  );

  return (
    <CldUploadWidget
      onSuccess={handleUpload}
      uploadPreset={uploadPreset}
      options={{
        maxFiles: 1,
        sources: ["local"],
      }}
    >
      {({ open }) => {
        return (
          <div
            onClick={() => open?.()}
            className="
              relative
              cursor-pointer
              hover:opacity-70
              transition
              border-dashed 
              border-2 
              p-6
              border-neutral-300
              flex
              flex-col
              justify-center
              items-center
              gap-4
              text-neutral-600
              bg-white
              rounded-lg
            "
          >
            <TbPhotoPlus size={30} />
            <div className="font-semibold text-sm">Click to upload</div>
          </div>
        );
      }}
    </CldUploadWidget>
  );
}
