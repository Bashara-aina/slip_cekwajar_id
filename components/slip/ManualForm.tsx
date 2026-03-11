"use client";

import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import type { PTKPStatus, SlipGajiInput } from "@/types/slip";

const ptkpOptions: Array<{ value: PTKPStatus; label: string }> = [
  { value: "TK/0", label: "TK/0 — Belum menikah, 0 tanggungan" },
  { value: "TK/1", label: "TK/1 — Belum menikah, 1 tanggungan" },
  { value: "TK/2", label: "TK/2 — Belum menikah, 2 tanggungan" },
  { value: "TK/3", label: "TK/3 — Belum menikah, 3 tanggungan" },
  { value: "K/0", label: "K/0 — Menikah, 0 tanggungan" },
  { value: "K/1", label: "K/1 — Menikah, 1 tanggungan" },
  { value: "K/2", label: "K/2 — Menikah, 2 tanggungan" },
  { value: "K/3", label: "K/3 — Menikah, 3 tanggungan" },
  { value: "K/I/0", label: "K/I/0 — Menikah gabung penghasilan, 0 tanggungan" },
  { value: "K/I/1", label: "K/I/1 — Menikah gabung penghasilan, 1 tanggungan" },
  { value: "K/I/2", label: "K/I/2 — Menikah gabung penghasilan, 2 tanggungan" },
  { value: "K/I/3", label: "K/I/3 — Menikah gabung penghasilan, 3 tanggungan" }
];

const schema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Format periode: YYYY-MM"),
  month: z.number().int().min(1).max(12),
  ptkp_status: z.enum([
    "TK/0",
    "TK/1",
    "TK/2",
    "TK/3",
    "K/0",
    "K/1",
    "K/2",
    "K/3",
    "K/I/0",
    "K/I/1",
    "K/I/2",
    "K/I/3"
  ]),
  gaji_pokok: z.number().min(0),
  tunjangan_tetap: z.number().min(0),
  tunjangan_tidak_tetap: z.number().min(0),
  pph21_charged: z.number().min(0),
  bpjs_kesehatan_charged: z.number().min(0),
  bpjs_jht_charged: z.number().min(0),
  bpjs_jp_charged: z.number().min(0),
  bpjs_jkk_charged: z.number().min(0).optional(),
  bpjs_jkm_charged: z.number().min(0).optional(),
  potongan_lain: z.number().min(0).optional()
});

type ManualFormValues = z.infer<typeof schema>;

type Props = {
  initialValues?: Partial<SlipGajiInput>;
  loading?: boolean;
  onSubmit: (values: SlipGajiInput) => Promise<void> | void;
};

/** Format number as Indonesian Rupiah: Rp 5.000.000 (form state stays raw number) */
function formatRupiah(value: number): string {
  return "Rp " + new Intl.NumberFormat("id-ID").format(value);
}

/** Parse displayed Rupiah string back to raw number */
function parseRupiah(value: string): number {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

type CurrencyFieldProps = {
  name: keyof ManualFormValues;
  label: string;
  control: ReturnType<typeof useForm<ManualFormValues>>["control"];
  required?: boolean;
};

function CurrencyField({ name, label, control, required = true }: CurrencyFieldProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <label className="flex w-full flex-col gap-1 text-sm">
          <span className="font-medium">
            {label}
            {!required ? " (opsional)" : ""}
          </span>
          <Input
            inputMode="numeric"
            value={formatRupiah(Number(field.value ?? 0))}
            onChange={(event) => field.onChange(parseRupiah(event.target.value))}
            className="h-11 text-sm"
          />
        </label>
      )}
    />
  );
}

export function ManualForm({ initialValues, onSubmit, loading = false }: Props) {
  const defaults = useMemo<ManualFormValues>(
    () => ({
      period: initialValues?.period ?? new Date().toISOString().slice(0, 7),
      month: initialValues?.month ?? new Date().getMonth() + 1,
      ptkp_status: initialValues?.ptkp_status ?? "TK/0",
      gaji_pokok: initialValues?.gaji_pokok ?? 0,
      tunjangan_tetap: initialValues?.tunjangan_tetap ?? 0,
      tunjangan_tidak_tetap: initialValues?.tunjangan_tidak_tetap ?? 0,
      pph21_charged: initialValues?.pph21_charged ?? 0,
      bpjs_kesehatan_charged: initialValues?.bpjs_kesehatan_charged ?? 0,
      bpjs_jht_charged: initialValues?.bpjs_jht_charged ?? 0,
      bpjs_jp_charged: initialValues?.bpjs_jp_charged ?? 0,
      bpjs_jkk_charged: initialValues?.bpjs_jkk_charged ?? 0,
      bpjs_jkm_charged: initialValues?.bpjs_jkm_charged ?? 0,
      potongan_lain: initialValues?.potongan_lain ?? 0
    }),
    [initialValues]
  );

  const form = useForm<ManualFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults
  });

  return (
    <form
      className="mx-auto flex w-full min-w-[375px] max-w-xl flex-col gap-3 px-4 py-3"
      onSubmit={form.handleSubmit(async (values) => {
        await onSubmit(values);
      })}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Periode</span>
        <Input className="h-11" placeholder="YYYY-MM" {...form.register("period")} />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Bulan (1-12)</span>
        <Input
          className="h-11"
          inputMode="numeric"
          value={String(form.watch("month"))}
          onChange={(event) => form.setValue("month", Number(event.target.value.replace(/\D/g, "")) || 1)}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Status PTKP</span>
        <Controller
          control={form.control}
          name="ptkp_status"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Pilih status PTKP" />
              </SelectTrigger>
              <SelectContent>
                {ptkpOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </label>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Penghasilan
        </h3>
        <CurrencyField control={form.control} name="gaji_pokok" label="Gaji Pokok" />
        <CurrencyField control={form.control} name="tunjangan_tetap" label="Tunjangan Tetap" />
        <CurrencyField control={form.control} name="tunjangan_tidak_tetap" label="Tunjangan Tidak Tetap" />
      </section>

      <div className="border-t border-gray-200 pt-3" aria-hidden />

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Potongan
        </h3>
        <CurrencyField control={form.control} name="pph21_charged" label="PPh21 Dipotong" />
        <CurrencyField control={form.control} name="bpjs_kesehatan_charged" label="BPJS Kesehatan Dipotong" />
        <CurrencyField control={form.control} name="bpjs_jht_charged" label="BPJS JHT Dipotong" />
        <CurrencyField control={form.control} name="bpjs_jp_charged" label="BPJS JP Dipotong" />
        <CurrencyField control={form.control} name="bpjs_jkk_charged" label="BPJS JKK Dipotong" required={false} />
        <CurrencyField control={form.control} name="bpjs_jkm_charged" label="BPJS JKM Dipotong" required={false} />
        <CurrencyField control={form.control} name="potongan_lain" label="Potongan Lain" required={false} />
      </section>

      <Button type="submit" className="mt-2 h-11 text-sm font-semibold" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Memproses...
          </>
        ) : (
          "Cek Sekarang →"
        )}
      </Button>
    </form>
  );
}
