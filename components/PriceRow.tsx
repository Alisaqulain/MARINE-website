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
}: {
  price: number;
  /** The struck-through price and discount only appear while an admin sale is running. */
  salePercent?: number;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const s = sizes[size];
  const onSale = salePercent != null && salePercent > 0 && salePercent < 100;
  const was = onSale ? Number((price / (1 - salePercent / 100)).toFixed(2)) : null;
  return (
    <p className={`flex flex-wrap items-baseline gap-x-1 leading-tight sm:gap-x-1.5 ${className}`}>
      <span className={`font-bold ${onSale ? "text-[#2F6B1F]" : "text-[#222222]"} ${s.price}`}>{formatPrice(price)}</span>
      {was != null ? (
        <span className={`whitespace-nowrap text-[#595959] ${s.rest}`}>
          <span className="line-through">{formatPrice(was)}</span>
          <span className="ml-0.5 font-semibold text-red-700">({salePercent}% off)</span>
        </span>
      ) : null}
    </p>
  );
}
