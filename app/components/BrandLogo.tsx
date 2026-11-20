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
      src="/bonj-logo.png"
      alt={alt}
      width={1024}
      height={1024}
      priority={priority}
      unoptimized
    />
  );
}
