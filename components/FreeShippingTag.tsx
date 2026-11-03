export function FreeShippingTag({
  placement = "text",
}: {
  placement?: "text" | "image";
}) {
  const tag = (
    <span className="inline-flex whitespace-nowrap rounded-[3px] bg-[#258635] px-1 py-[2px] text-[9px] font-semibold leading-none text-white sm:text-[10px]">
      FREE shipping
    </span>
  );

  if (placement === "image") {
    return <span className="absolute left-2 top-2 z-[5]">{tag}</span>;
  }

  return <span className="inline-flex">{tag}</span>;
}
