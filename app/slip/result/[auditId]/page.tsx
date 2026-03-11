import { notFound } from "next/navigation";
import { FullReport } from "@/components/slip/FullReport";
import { PaywallModal } from "@/components/slip/PaywallModal";
import { ShareCard } from "@/components/slip/ShareCard";
import { VerdictCard } from "@/components/slip/VerdictCard";
import { generatePremiumTexts } from "@/lib/slip/surat-keberatan";
import type { AuditResult, PremiumContent } from "@/types/slip";

type PageProps = {
  params: {
    auditId: string;
  };
};

type AuditRow = {
  id: string;
  verdict: AuditResult["verdict"];
  discrepancy_amount: number;
  issues: AuditResult["issues"];
  premium_unlocked: boolean;
  pph21_charged: number;
  pph21_expected: number;
  bpjs_kesehatan_charged: number;
  bpjs_kesehatan_expected: number;
  bpjs_tk_charged: number;
  bpjs_tk_expected: number;
};

function toAuditResult(row: AuditRow): AuditResult {
  return {
    verdict: row.verdict,
    discrepancy_rp: row.discrepancy_amount,
    issues: row.issues ?? [],
    legal_refs: (row.issues ?? []).map((issue) => issue.legal_basis).filter(Boolean),
    expected_breakdown: {
      pph21: row.pph21_expected,
      bpjs: {
        kesehatan: { charged: row.bpjs_kesehatan_charged, expected: row.bpjs_kesehatan_expected },
        jht: { charged: row.bpjs_tk_charged, expected: row.bpjs_tk_expected },
        jp: { charged: 0, expected: 0 },
        jkk: { charged: 0, expected: 0 },
        jkm: { charged: 0, expected: 0 }
      },
      bpjs_total: row.bpjs_kesehatan_expected + row.bpjs_tk_expected,
      total_legal_deductions: row.pph21_expected + row.bpjs_kesehatan_expected + row.bpjs_tk_expected
    }
  };
}

function buildPremiumBreakdown(row: AuditRow): PremiumContent["full_breakdown"] {
  return [
    {
      komponen: "PPh21",
      dipotong: row.pph21_charged,
      seharusnya: row.pph21_expected,
      selisih: Math.max(0, row.pph21_charged - row.pph21_expected),
      dasar_hukum: "PMK 168/2023"
    },
    {
      komponen: "BPJS Kesehatan",
      dipotong: row.bpjs_kesehatan_charged,
      seharusnya: row.bpjs_kesehatan_expected,
      selisih: Math.max(0, row.bpjs_kesehatan_charged - row.bpjs_kesehatan_expected),
      dasar_hukum: "Perpres 64/2020"
    },
    {
      komponen: "BPJS TK (JHT+JP)",
      dipotong: row.bpjs_tk_charged,
      seharusnya: row.bpjs_tk_expected,
      selisih: Math.max(0, row.bpjs_tk_charged - row.bpjs_tk_expected),
      dasar_hukum: "PP 84/2015"
    }
  ];
}

async function getPremiumContent(row: AuditRow): Promise<PremiumContent> {
  const full_breakdown = buildPremiumBreakdown(row);
  const estimation_12_months = {
    monthly_discrepancy: row.discrepancy_amount,
    estimated_total: row.discrepancy_amount * 12,
    formula: "discrepancy bulanan x 12 bulan"
  };

  const { surat_keberatan, wa_templates } = await generatePremiumTexts({
    verdict: row.verdict,
    month: new Date().getMonth() + 1,
    is_december: new Date().getMonth() === 11,
    discrepancy_rp: row.discrepancy_amount,
    breakdown: full_breakdown,
    estimated_12_month: row.discrepancy_amount * 12
  });

  return {
    full_breakdown,
    estimation_12_months,
    surat_keberatan,
    wa_templates,
    pdf_url: null
  };
}

async function fetchAuditById(auditId: string): Promise<AuditRow | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/slip_audits?id=eq.${encodeURIComponent(
        auditId
      )}&select=id,verdict,discrepancy_amount,issues,premium_unlocked,pph21_charged,pph21_expected,bpjs_kesehatan_charged,bpjs_kesehatan_expected,bpjs_tk_charged,bpjs_tk_expected&limit=1`,
      {
        method: "GET",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`
        },
        cache: "no-store"
      }
    );

    if (!response.ok) return null;
    const rows = (await response.json()) as AuditRow[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export default async function ResultPage({ params }: PageProps) {
  const audit = await fetchAuditById(params.auditId);
  if (!audit) notFound();

  const result = toAuditResult(audit);
  const visibleIssues = result.issues.slice(0, 1);
  const hiddenIssuesCount = Math.max(0, result.issues.length - 1);

  let premiumContent: PremiumContent | null = null;
  if (audit.premium_unlocked) {
    try {
      premiumContent = await getPremiumContent(audit);
    } catch {
      premiumContent = null;
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full min-w-[375px] max-w-4xl flex-col gap-4 px-4 py-6">
      <VerdictCard result={result} />

      <section className="rounded-md border p-4">
        <p className="text-sm font-medium">Verdict: {result.verdict}</p>
        <p className="mt-1 text-sm">Total discrepancy: Rp {new Intl.NumberFormat("id-ID").format(result.discrepancy_rp)}</p>
      </section>

      <section className="rounded-md border p-4">
        <h2 className="text-sm font-semibold">Issue Details</h2>
        <div className="mt-2 space-y-2">
          {visibleIssues.length > 0 ? (
            visibleIssues.map((issue) => (
              <div key={`${issue.type}-${issue.description}`} className="rounded-md bg-gray-50 p-2 text-sm">
                {issue.description}
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-600">Tidak ada issue.</p>
          )}
          {hiddenIssuesCount > 0 ? (
            <div className="rounded-md bg-gray-100 p-3 text-sm blur-[2px] select-none">
              🔒 {hiddenIssuesCount} issue lainnya tersedia di laporan premium
            </div>
          ) : null}
        </div>
      </section>

      {audit.premium_unlocked && premiumContent ? (
        <FullReport content={premiumContent} />
      ) : (
        <PaywallModal auditId={audit.id} />
      )}

      <ShareCard verdict={result.verdict} shareUrl={`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/slip/result/${audit.id}`} />
    </main>
  );
}
