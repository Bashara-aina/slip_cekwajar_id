"use client";

import { Button } from "@/components/ui/button";
import type { VerdictType } from "@/types/slip";

type Props = {
  verdict: VerdictType;
  shareUrl: string;
};

function verdictText(verdict: VerdictType): string {
  if (verdict === "WAJAR") return "WAJAR ✅";
  if (verdict === "ADA_YANG_ANEH") return "ADA YANG ANEH ⚠️";
  return "ADA YANG SALAH 🚨";
}

export function ShareCard({ verdict, shareUrl }: Props) {
  const text = `Potongan gaji gue ${verdictText(verdict)}\nCek punyamu → cekwajar.id/slip`;

  return (
    <div className="mx-auto flex w-full min-w-[375px] max-w-xl flex-col gap-3 rounded-xl border p-4">
      <p className="text-sm whitespace-pre-line">{text}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          className="h-10 text-sm"
          onClick={async () => {
            await navigator.clipboard.writeText(shareUrl);
          }}
        >
          Copy Link
        </Button>
        <Button
          className="h-10 text-sm"
          onClick={() => {
            const xUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(
              shareUrl
            )}`;
            window.open(xUrl, "_blank");
          }}
        >
          Share ke X
        </Button>
      </div>
    </div>
  );
}
