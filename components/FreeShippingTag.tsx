export function FreeShippingTag({
  placement = "text",
}: {
  placement?: "text" | "image";
}) {
  const tag = (
    <span className="inline-flex rounded-[3px] bg-[#258635] px-1.5 py-[3px] text-[11px] font-semibold leading-none text-white">
      FREE shipping
    </span>
  );

  if (placement === "image") {
    return <span className="absolute left-2 top-2 z-[5]">{tag}</span>;
  }

  return <span className="inline-flex">{tag}</span>;
}
