import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

export type SuratContext = {
  verdict: string;
  month: number;        // 1–12
  is_december: boolean; // true = rekonsiliasi Pasal 17
  discrepancy_rp: number;
  breakdown: Array<{
    komponen: string;
    dipotong: number;
    seharusnya: number;
    selisih: number;
    dasar_hukum: string;
  }>;
  estimated_12_month: number;
};

const SURAT_SYSTEM = `Kamu adalah asisten yang menulis surat keberatan resmi dalam Bahasa Indonesia untuk karyawan yang mengajukan keberatan atas potongan gaji yang tidak sesuai regulasi.
Tulis surat yang singkat, sopan, dan mengacu pada dasar hukum yang relevan (PMK 168/2023, PP 44/2015).
Format: paragraf biasa, tidak perlu kop surat. Awali dengan "Yth. Bapak/Ibu [HR/Divisi SDM]," dan akhiri dengan permintaan review serta pengembalian selisih potongan. Maksimal 4 paragraf.`;

const WA_SYSTEM = `Kamu menghasilkan 3 kalimat singkat dalam Bahasa Indonesia yang bisa dipakai sebagai template chat WhatsApp ke HR untuk menindaklanjuti keberatan potongan gaji.
Setiap kalimat: sopan, singkat (max 1 baris), dan mengarah ke permintaan review/koreksi. Berikan hanya 3 baris teks, setiap baris satu template, tanpa numbering atau penjelasan.`;

function buildSuratUserPrompt(ctx: SuratContext): string {
  const rp = new Intl.NumberFormat("id-ID").format(ctx.discrepancy_rp);
  const monthLabel = new Intl.DateTimeFormat("id-ID", { month: "long" }).format(
    new Date(2024, ctx.month - 1)
  );
  const taxNote = ctx.is_december
    ? "Catatan: ini masa pajak Desember — PPh 21 menggunakan rekonsiliasi tahunan Pasal 17, bukan TER. Surat sebaiknya hanya mempermasalahkan komponen BPJS."
    : "Ini adalah potongan TER bulanan (PMK 168/2023).";
  const lines = ctx.breakdown
    .filter((b) => b.selisih > 0)
    .map(
      (b) =>
        `- ${b.komponen}: dipotong Rp ${new Intl.NumberFormat("id-ID").format(b.dipotong)}, seharusnya Rp ${new Intl.NumberFormat("id-ID").format(b.seharusnya)} (selisih Rp ${new Intl.NumberFormat("id-ID").format(b.selisih)}, ${b.dasar_hukum})`
    )
    .join("\n");
  return `Slip bulan ${monthLabel}. ${taxNote}\nVerdict: ${ctx.verdict}. Total selisih kelebihan potongan: Rp ${rp}.\n\nRincian:\n${lines || "Tidak ada rincian."}\n\nEstimasi 12 bulan: Rp ${new Intl.NumberFormat("id-ID").format(ctx.estimated_12_month)}.\n\nTulis surat keberatan berdasarkan data di atas.`;
}

function buildWaUserPrompt(ctx: SuratContext): string {
  const rp = new Intl.NumberFormat("id-ID").format(ctx.discrepancy_rp);
  return `Karyawan punya selisih potongan Rp ${rp} (verdict: ${ctx.verdict}). Buat 3 template WA singkat untuk kirim ke HR.`;
}

const FALLBACK_SURAT =
  "Yth. Bapak/Ibu HR/Divisi SDM,\n\nSaya mengajukan keberatan atas potongan gaji yang tidak sesuai regulasi. Mohon review dan pengembalian selisih potongan sesuai PMK 168/2023 dan PP 44/2015.\n\nTerima kasih.";

const FALLBACK_WA = [
  "Halo HR, saya cek ada selisih potongan di slip. Boleh dibantu review?",
  "Mau konfirmasi potongan gaji bulan ini, sepertinya ada perhitungan yang perlu dicek ulang.",
  "Saya kirim hasil audit slip, mohon follow-up koreksi potongan ya."
];

/**
 * Generate Surat Keberatan (objection letter) using Groq — free and fast.
 * Returns fallback text if GROQ_API_KEY is missing or the API fails.
 */
export async function generateSuratKeberatan(context: SuratContext): Promise<string> {
  if (!process.env.GROQ_API_KEY) return FALLBACK_SURAT;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 600,
      temperature: 0.3,
      messages: [
        { role: "system", content: SURAT_SYSTEM },
        { role: "user", content: buildSuratUserPrompt(context) }
      ]
    });
    const text = completion.choices?.[0]?.message?.content?.trim();
    return text && text.length > 50 ? text : FALLBACK_SURAT;
  } catch {
    return FALLBACK_SURAT;
  }
}

/**
 * Generate 3 WhatsApp templates for follow-up to HR using Groq.
 */
export async function generateWaTemplates(context: SuratContext): Promise<string[]> {
  if (!process.env.GROQ_API_KEY) return FALLBACK_WA;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 300,
      temperature: 0.4,
      messages: [
        { role: "system", content: WA_SYSTEM },
        { role: "user", content: buildWaUserPrompt(context) }
      ]
    });
    const text = completion.choices?.[0]?.message?.content?.trim();
    if (!text) return FALLBACK_WA;
    const lines = text
      .split(/\n/)
      .map((s) => s.replace(/^[\d.)\-\*]+\s*/, "").trim())
      .filter((s) => s.length > 10 && s.length < 200);
    return lines.length >= 3 ? lines.slice(0, 3) : FALLBACK_WA;
  } catch {
    return FALLBACK_WA;
  }
}

/**
 * Generate both surat keberatan and WA templates in one flow (two parallel Groq calls).
 */
export async function generatePremiumTexts(context: SuratContext): Promise<{
  surat_keberatan: string;
  wa_templates: string[];
}> {
  const [surat_keberatan, wa_templates] = await Promise.all([
    generateSuratKeberatan(context),
    generateWaTemplates(context)
  ]);
  return { surat_keberatan, wa_templates };
}
