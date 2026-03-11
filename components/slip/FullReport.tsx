"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PremiumContent } from "@/types/slip";

type Props = {
  content: PremiumContent;
};

function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

export function FullReport({ content }: Props) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyText = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1200);
  };

  return (
    <div className="mx-auto flex w-full min-w-[375px] max-w-4xl flex-col gap-4 px-4 py-4">
      <div className="rounded-md border p-3">
        <h3 className="text-sm font-semibold">Full Breakdown</h3>
        <div className="mt-2 overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Komponen</TableHead>
                <TableHead>Dipotong</TableHead>
                <TableHead>Seharusnya</TableHead>
                <TableHead>Selisih</TableHead>
                <TableHead>Dasar Hukum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {content.full_breakdown.map((line) => (
                <TableRow key={`${line.komponen}-${line.dasar_hukum}`}>
                  <TableCell className="text-xs">{line.komponen}</TableCell>
                  <TableCell className="text-xs">Rp {formatRupiah(line.dipotong)}</TableCell>
                  <TableCell className="text-xs">Rp {formatRupiah(line.seharusnya)}</TableCell>
                  <TableCell className="text-xs">Rp {formatRupiah(line.selisih)}</TableCell>
                  <TableCell className="text-xs">{line.dasar_hukum}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="rounded-md border p-3 text-sm">
        <p className="font-semibold">Estimasi Kerugian 12 Bulan</p>
        <p className="mt-1">
          Bulanan: Rp {formatRupiah(content.estimation_12_months.monthly_discrepancy)} × 12 = Rp{" "}
          {formatRupiah(content.estimation_12_months.estimated_total)}
        </p>
        <p className="text-xs text-gray-600">Formula: {content.estimation_12_months.formula}</p>
      </div>

      <div className="rounded-md border p-3">
        <p className="text-sm font-semibold">Surat Keberatan</p>
        <pre className="mt-2 whitespace-pre-wrap rounded-md bg-gray-50 p-2 text-xs">{content.surat_keberatan}</pre>
        <Button
          className="mt-2 h-10 text-xs"
          onClick={() => copyText(content.surat_keberatan, "surat")}
        >
          {copiedKey === "surat" ? "Tersalin" : "Copy Surat"}
        </Button>
      </div>

      <div className="rounded-md border p-3">
        <p className="text-sm font-semibold">Template WhatsApp</p>
        <div className="mt-2 space-y-2">
          {content.wa_templates.map((template, idx) => (
            <div key={template} className="rounded-md bg-gray-50 p-2">
              <p className="text-xs whitespace-pre-wrap">{template}</p>
              <Button className="mt-2 h-9 text-xs" onClick={() => copyText(template, `wa-${idx}`)}>
                {copiedKey === `wa-${idx}` ? "Tersalin" : `Copy Template ${idx + 1}`}
              </Button>
            </div>
          ))}
        </div>
      </div>

      <Button
        className="h-11 text-sm font-semibold"
        onClick={() => {
          if (content.pdf_url) window.open(content.pdf_url, "_blank");
        }}
        disabled={!content.pdf_url}
      >
        {content.pdf_url ? "Download PDF" : "PDF Belum Tersedia"}
      </Button>
    </div>
  );
}
