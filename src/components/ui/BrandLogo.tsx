import Image from "next/image";

import { siteConfig } from "@/config/site";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
  decorative?: boolean;
};

export function BrandLogo({
  className = "",
  priority = false,
  decorative = false,
}: BrandLogoProps) {
  return (
    <Image
      className={`brand-logo ${className}`.trim()}
      src={siteConfig.logo}
      alt={decorative ? "" : "NUMORA"}
      width={1600}
      height={800}
      priority={priority}
      sizes="(max-width: 768px) 144px, 176px"
    />
  );
}
