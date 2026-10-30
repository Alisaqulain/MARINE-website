import type { ReactNode } from "react";
import { formatPrice } from "@/lib/products";

const sizes = {
  card: {
    price: "text-[13px] sm:text-[16px]",
    rest: "text-[10px] sm:text-[13px]",
  },
  page: {
    price: "text-[1.45rem] md:text-[2rem]",
    rest: "text-[13px] md:text-[16px]",
  },
};

export function PriceRow({
  price,
  salePercent,
  size = "card",
  className = "",
  trailing,
}: {
  price: number;
  /** The struck-through price and discount only appear while an admin sale is running. */
  salePercent?: number;
  size?: keyof typeof sizes;
  className?: string;
  /** Shown at the end of the same line, e.g. the FREE shipping tag. */
  trailing?: ReactNode;
}) {
  const s = sizes[size];
  const onSale = salePercent != null && salePercent > 0 && salePercent < 100;
  const was = onSale ? Number((price / (1 - salePercent / 100)).toFixed(2)) : null;
  return (
    <p className={`flex flex-wrap items-center gap-x-1 gap-y-1 leading-tight sm:gap-x-1.5 ${className}`}>
      <span className={`font-bold ${onSale ? "text-[#2F6B1F]" : "text-[#222222]"} ${s.price}`}>{formatPrice(price)}</span>
      {was != null ? (
        <span className={`whitespace-nowrap text-[#595959] line-through ${s.rest}`}>{formatPrice(was)}</span>
      ) : null}
      {trailing}
    </p>
  );
}
