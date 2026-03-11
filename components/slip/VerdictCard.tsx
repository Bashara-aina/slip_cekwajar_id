"use client";

import { useEffect, useMemo, useState } from "react";
import type { AuditResult } from "@/types/slip";

type Props = {
  result: AuditResult;
};

function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

export function VerdictCard({ result }: Props) {
  const [displayAmount, setDisplayAmount] = useState(0);

  useEffect(() => {
    const target = result.discrepancy_rp;
    if (target <= 0) {
      setDisplayAmount(0);
      return;
    }
    const duration = 600;
    const steps = 20;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setDisplayAmount(target);
        clearInterval(timer);
      } else {
        setDisplayAmount(Math.round(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [result.discrepancy_rp]);

  const content = useMemo(() => {
    if (result.verdict === "WAJAR") {
      return {
        title: "✅ Potongan gaji kamu sesuai regulasi!",
        className: "bg-green-50 border-green-200 text-green-900"
      };
    }
    if (result.verdict === "ADA_YANG_ANEH") {
      return {
        title: `⚠️ Ada ${result.issues.length} hal yang perlu dicek`,
        className: "bg-yellow-50 border-yellow-200 text-yellow-900"
      };
    }
    return {
      title: `🚨 Kamu kelebihan dipotong Rp ${formatRupiah(displayAmount)} bulan ini`,
      className: "bg-red-50 border-red-200 text-red-900"
    };
  }, [displayAmount, result.issues.length, result.verdict]);

  return (
    <div className={`animate-in fade-in mx-auto w-full min-w-[375px] rounded-xl border p-4 ${content.className}`}>
      <h2 className="text-base font-semibold">{content.title}</h2>
      <p className="mt-2 text-sm">
        Dasar hukum: {result.legal_refs.length > 0 ? result.legal_refs.join(", ") : "PMK 168/2023 dan aturan BPJS terkait"}
      </p>
    </div>
  );
}
