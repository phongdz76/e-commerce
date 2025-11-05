"use client";

interface HeadingProps {
  title: string;
  center?: boolean;
}

export default function Heading({ title, center }: HeadingProps) {
  return (
    <div className={center ? "text-center" : "text-start"}>
      <h1 className="font-bold text-2xl">{title}</h1>
    </div>
  );
}
