import { PaywallModal } from "@/components/slip/PaywallModal";

const benefits = [
  "✅ Full line-by-line breakdown + dasar hukum",
  "✅ Estimasi total overcharge 12 bulan",
  "✅ Surat keberatan siap copy",
  "✅ Template WhatsApp ke HR",
  "✅ Download PDF laporan"
];

export default function PremiumPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full min-w-[375px] max-w-2xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-semibold">Upgrade ke Laporan Premium</h1>
      <p className="text-sm text-gray-600">Rp 20.000 — akses selamanya untuk slip ini</p>

      <div className="rounded-md border p-4">
        <ul className="space-y-2 text-sm">
          {benefits.map((benefit) => (
            <li key={benefit}>{benefit}</li>
          ))}
        </ul>
      </div>

      <PaywallModal auditId="premium-page-preview" />

      <div className="rounded-md border bg-gray-50 p-3 text-xs text-gray-700">
        <p>✔ Tanpa subscription</p>
        <p>✔ Akses instan setelah bayar</p>
        <p>✔ PDF report siap unduh</p>
      </div>
    </main>
  );
}
