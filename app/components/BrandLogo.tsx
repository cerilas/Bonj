import Image from "next/image";

type BrandLogoProps = {
  className?: string;
  alt?: string;
  priority?: boolean;
};

export function BrandLogo({
  className = "",
  alt = "Bonj Cake Story",
  priority = false,
}: BrandLogoProps) {
  return (
    <Image
      className={`bonj-brand-logo ${className}`.trim()}
      src="/bonj-logo2.svg"
      alt={alt}
      width={1920}
      height={1920}
      priority={priority}
      unoptimized
    />
  );
}
