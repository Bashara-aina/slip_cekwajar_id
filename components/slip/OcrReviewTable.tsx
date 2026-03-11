"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { OcrExtractedData } from "@/types/slip";

type Props = {
  data: OcrExtractedData;
  loading?: boolean;
  onSubmit: (payload: OcrExtractedData) => Promise<void> | void;
};

type EditableNumericFields =
  | "gaji_pokok"
  | "tunjangan_tetap"
  | "tunjangan_tidak_tetap"
  | "tunjangan_makan"
  | "tunjangan_transport"
  | "uang_lembur"
  | "pph21"
  | "bpjs_kesehatan"
  | "bpjs_jht"
  | "bpjs_jp"
  | "bpjs_jkk"
  | "bpjs_jkm"
  | "potongan_lain"
  | "gaji_bersih";

const editableRows: Array<{ key: EditableNumericFields; label: string; confidenceKey?: keyof OcrExtractedData["confidence"] }> = [
  { key: "gaji_pokok", label: "Gaji Pokok", confidenceKey: "gaji_pokok" },
  { key: "tunjangan_tetap", label: "Tunjangan Tetap" },
  { key: "tunjangan_tidak_tetap", label: "Tunjangan Tidak Tetap" },
  { key: "tunjangan_makan", label: "Tunjangan Makan" },
  { key: "tunjangan_transport", label: "Tunjangan Transport" },
  { key: "uang_lembur", label: "Uang Lembur" },
  { key: "pph21", label: "PPh21", confidenceKey: "pph21" },
  { key: "bpjs_kesehatan", label: "BPJS Kesehatan", confidenceKey: "bpjs_kesehatan" },
  { key: "bpjs_jht", label: "BPJS JHT", confidenceKey: "bpjs_jht" },
  { key: "bpjs_jp", label: "BPJS JP", confidenceKey: "bpjs_jp" },
  { key: "bpjs_jkk", label: "BPJS JKK" },
  { key: "bpjs_jkm", label: "BPJS JKM" },
  { key: "potongan_lain", label: "Potongan Lain" },
  { key: "gaji_bersih", label: "Gaji Bersih" }
];

function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

function parseRupiah(value: string): number {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

function getConfidenceBadge(value: number | undefined): string {
  if (typeof value !== "number") return "—";
  if (value >= 0.9) return "✅";
  if (value >= 0.7) return "⚠️";
  return "🚩 Mohon periksa ulang";
}

export function OcrReviewTable({ data, onSubmit, loading = false }: Props) {
  const [draft, setDraft] = useState<OcrExtractedData>(data);
  const lowConfidenceInfo = useMemo(
    () => draft.low_confidence_fields.join(", "),
    [draft.low_confidence_fields]
  );

  return (
    <div className="mx-auto flex w-full min-w-[375px] max-w-3xl flex-col gap-3 px-4 py-3">
      <div className="rounded-md border p-3 text-xs text-gray-700">
        <p className="font-medium">Review hasil OCR sebelum cek audit.</p>
        <p>Field confidence rendah: {lowConfidenceInfo || "Tidak ada"}</p>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Field</TableHead>
              <TableHead>Nilai</TableHead>
              <TableHead>Confidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {editableRows.map((row) => {
              const value = (draft[row.key] ?? 0) as number;
              const confidenceValue = row.confidenceKey ? draft.confidence[row.confidenceKey] : undefined;
              return (
                <TableRow key={row.key}>
                  <TableCell className="text-xs font-medium">{row.label}</TableCell>
                  <TableCell>
                    <Input
                      inputMode="numeric"
                      className="h-10 min-w-[140px] text-sm"
                      value={formatRupiah(value)}
                      onChange={(event) => {
                        const parsed = parseRupiah(event.target.value);
                        setDraft((current) => ({ ...current, [row.key]: parsed }));
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-xs">{getConfidenceBadge(confidenceValue)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Button className="h-11 text-sm font-semibold" disabled={loading} onClick={() => onSubmit(draft)}>
        {loading ? "Memproses..." : "Lanjut Cek →"}
      </Button>
    </div>
  );
}
