"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { usePayment } from "@/hooks/usePayment";

type Props = {
  auditId: string;
  userId?: string;
  onSuccess?: () => void;
};

const benefits = [
  "Full breakdown line-by-line + dasar hukum",
  "Estimasi kerugian 12 bulan",
  "Surat keberatan siap kirim",
  "3 template WhatsApp ke HR",
  "Unduh laporan PDF"
];

export function PaywallModal({ auditId, userId, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const { openSnap, loading, status } = usePayment({
    onSuccess: () => {
      onSuccess?.();
      setOpen(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11 w-full text-sm font-semibold">Lihat Laporan Lengkap — Rp 20.000</Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] min-w-[375px] max-w-md p-4">
        <DialogHeader>
          <DialogTitle className="text-base">Unlock Laporan Premium</DialogTitle>
          <DialogDescription className="text-sm">
            Rp 20.000 — akses selamanya untuk slip ini.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 text-sm">
          {benefits.map((benefit) => (
            <li key={benefit}>✅ {benefit}</li>
          ))}
        </ul>

        <Button
          className="h-11 w-full text-sm font-semibold"
          disabled={loading}
          onClick={async () => {
            await openSnap({ audit_id: auditId, user_id: userId });
          }}
        >
          {loading ? "Memproses pembayaran..." : "Bayar & Buka Sekarang"}
        </Button>

        {status === "pending" ? <p className="text-xs text-yellow-600">Pembayaran pending, selesaikan di Snap.</p> : null}
        {status === "error" ? <p className="text-xs text-red-600">Pembayaran gagal. Coba lagi.</p> : null}
        {status === "success" ? <p className="text-xs text-green-600">Pembayaran berhasil. Memuat laporan...</p> : null}
      </DialogContent>
    </Dialog>
  );
}
