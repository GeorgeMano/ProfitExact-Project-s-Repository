import Image from "next/image";

export function BrandMark({ className }: { className: string }) {
  return (
    <span className={className} aria-hidden="true">
      <Image src="/profitexact-logo.png" alt="" width={44} height={44} />
    </span>
  );
}
