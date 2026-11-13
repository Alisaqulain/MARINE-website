"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useWholesaleGate } from "@/components/WholesaleGateProvider";

type Props = Omit<ComponentProps<typeof Link>, "href"> & {
  callbackUrl?: string;
  href?: string;
};

/** Wholesale / B2B link — retail customers get a popup to log out and switch accounts. */
export function WholesaleNavLink({ callbackUrl = "/wholesale", href, onClick, ...rest }: Props) {
  const { wholesaleEntryHref, handleWholesaleClick } = useWholesaleGate();

  return (
    <Link
      {...rest}
      href={wholesaleEntryHref(callbackUrl)}
      onClick={(e) => {
        handleWholesaleClick(e, callbackUrl);
        onClick?.(e);
      }}
    />
  );
}
