"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AllowanceChip } from "@/components/shop/allowance-chip";
import { getHeaderAllowance } from "@/lib/shop/allowance-action";

type Data = Awaited<ReturnType<typeof getHeaderAllowance>>;

/** Budget indicator next to the cart button; refreshed on every page change. */
export function HeaderAllowance() {
  const pathname = usePathname();
  const [data, setData] = useState<Data>(null);

  useEffect(() => {
    let live = true;
    getHeaderAllowance()
      .then((d) => live && setData(d))
      .catch(() => {
        /* niet tonen als het ophalen mislukt */
      });
    return () => {
      live = false;
    };
  }, [pathname]);

  if (!data) return null;
  return (
    <AllowanceChip
      settings={data.settings}
      allowance={data.allowance}
      canRequest={data.canRequest}
      forName={data.forName}
    />
  );
}
