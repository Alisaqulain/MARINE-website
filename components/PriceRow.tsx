import { DISCOUNT_PERCENT, formatPrice, listPrice } from "@/lib/products";

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
}: {
  price: number;
  /** When an admin sale is running, show its real discount instead of the standing one. */
  salePercent?: number;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const s = sizes[size];
  const onSale = salePercent != null && salePercent > 0 && salePercent < 100;
  const was = onSale ? Number((price / (1 - salePercent / 100)).toFixed(2)) : listPrice(price);
  return (
    <p className={`flex flex-wrap items-baseline gap-x-1 leading-tight sm:gap-x-1.5 ${className}`}>
      <span className={`font-bold text-[#2F6B1F] ${s.price}`}>{formatPrice(price)}</span>
      <span className={`whitespace-nowrap text-[#595959] ${s.rest}`}>
        <span className="line-through">{formatPrice(was)}</span>
        <span className={`ml-0.5 ${onSale ? "font-semibold text-red-700" : ""}`}>
          ({onSale ? `Sale ${salePercent}%` : `${DISCOUNT_PERCENT}%`} off)
        </span>
      </span>
    </p>
  );
}
