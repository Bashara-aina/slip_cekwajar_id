import type {
  AuditInput,
  AuditResult,
  BPJSDeductions,
  Issue,
  IssueSeverity,
  PTKPStatus,
  TERCategory,
  VerdictType
} from "@/types/slip";
import {
  TER_A,
  TER_B,
  TER_C,
  TER_CATEGORY,
  BPJS_KESEHATAN,
  BPJS_JHT,
  BPJS_JP,
  VERDICT_THRESHOLDS,
} from "@/lib/regulations";

const ILLEGAL_EMPLOYER_DEDUCTION_THRESHOLD = 1_000;

// Derived from imported constants — always in sync
const BPJS_KESEHATAN_CAP = BPJS_KESEHATAN.wage_cap;
const BPJS_KESEHATAN_MAX = BPJS_KESEHATAN.employee_max;

/** JP cap changes effective 1 March each year. Jan–Feb of year X use year X-1 cap. */
function getJpCapForAudit(month: number): number {
  const year = new Date().getFullYear();
  const effectiveYear = month < 3 ? year - 1 : year;
  if (effectiveYear <= 2024) return BPJS_JP.wage_cap_2024;
  if (effectiveYear === 2025) return BPJS_JP.wage_cap_2025;
  return BPJS_JP.wage_cap_2026;
}

export interface BPJSExpected {
  kesehatan: number;
  jht: number;
  jp: number;
  jkk: number;
  jkm: number;
  total: number;
}

export function getPTKPCategory(status: PTKPStatus): TERCategory {
  return TER_CATEGORY[status] as TERCategory;
}

const TER_MAP: Record<TERCategory, typeof TER_A> = {
  A: TER_A,
  B: TER_B,
  C: TER_C,
};

export function getTERRate(category: TERCategory, gross: number): number {
  const slab = TER_MAP[category].find(
    (row) => gross >= row.min && (row.max === null || gross <= row.max)
  );
  // regulations.ts slabs use .rate (decimal, e.g. 0.0175) — do NOT divide by 100
  return slab?.rate ?? 0;
}

export function calculateExpectedBPJS(gross: number, month: number): BPJSExpected {
  const jpCap = getJpCapForAudit(month);
  const jpMax = Math.round(jpCap * BPJS_JP.employee_rate);

  const kesehatan = Math.min(
    Math.round(Math.min(gross, BPJS_KESEHATAN_CAP) * BPJS_KESEHATAN.employee_rate),
    BPJS_KESEHATAN_MAX
  );
  const jht = Math.round(gross * BPJS_JHT.employee_rate);
  const jp = Math.min(
    Math.round(Math.min(gross, jpCap) * BPJS_JP.employee_rate),
    jpMax
  );
  const jkk = 0;
  const jkm = 0;
  return { kesehatan, jht, jp, jkk, jkm, total: kesehatan + jht + jp };
}

export function estimateAnnualOvercharge(monthlyDiscrepancy: number, months: number): number {
  return Math.max(0, Math.round(monthlyDiscrepancy)) * Math.max(0, Math.round(months));
}

function pphIssueSeverity(diff: number, gross: number): IssueSeverity | null {
  if (diff <= 0) return null;
  if (diff <= VERDICT_THRESHOLDS.wajar_tolerance) return "minor";
  if (diff > gross * 0.05) return "critical";
  return "major";
}

function addIssue(
  issues: Issue[],
  legalRefs: Set<string>,
  issue: Omit<Issue, "severity"> & { severity: IssueSeverity }
): void {
  issues.push(issue);
  legalRefs.add(issue.legal_basis);
}

function toBPJSBreakdown(
  input: AuditInput,
  expected: BPJSExpected
): { breakdown: BPJSDeductions; chargedTotal: number } {
  const breakdown: BPJSDeductions = {
    kesehatan: {
      charged: input.deductions.bpjs_kesehatan,
      expected: expected.kesehatan
    },
    jht: {
      charged: input.deductions.bpjs_jht,
      expected: expected.jht
    },
    jp: {
      charged: input.deductions.bpjs_jp,
      expected: expected.jp
    },
    jkk: {
      charged: input.deductions.bpjs_jkk,
      expected: expected.jkk
    },
    jkm: {
      charged: input.deductions.bpjs_jkm,
      expected: expected.jkm
    }
  };

  const chargedTotal =
    input.deductions.bpjs_kesehatan +
    input.deductions.bpjs_jht +
    input.deductions.bpjs_jp +
    input.deductions.bpjs_jkk +
    input.deductions.bpjs_jkm;

  return { breakdown, chargedTotal };
}

function determineVerdict(issues: Issue[]): VerdictType {
  if (issues.length === 0) return "WAJAR";
  const hasCriticalOrMajor = issues.some(
    (issue) => issue.severity === "critical" || issue.severity === "major"
  );
  return hasCriticalOrMajor ? "POTONGAN_SALAH" : "ADA_YANG_ANEH";
}

export function auditSlip(input: AuditInput): AuditResult {
  const gross = Math.max(0, Math.round(input.gross));
  const month = Math.max(1, Math.min(12, Math.round(input.month)));
  const isDecember = month === 12;
  const category = getPTKPCategory(input.ptkp_status);
  const terRate = getTERRate(category, gross);
  const pphExpected = Math.round(gross * terRate);
  const bpjsExpected = calculateExpectedBPJS(gross, month);
  const { breakdown: bpjsBreakdown, chargedTotal: bpjsChargedTotal } = toBPJSBreakdown(
    input,
    bpjsExpected
  );

  const issues: Issue[] = [];
  const legalRefs = new Set<string>();

  // ── PPh21 check — SKIP in December (Pasal 17 applies, not TER)
  if (!isDecember) {
    const pphDiff = Math.abs(input.deductions.pph21 - pphExpected);
    const pphSeverity = pphIssueSeverity(pphDiff, gross);
    if (pphSeverity) {
      addIssue(issues, legalRefs, {
        type: "PPH21_MISMATCH",
        description: `PPh 21 dipotong Rp${input.deductions.pph21.toLocaleString("id-ID")}, seharusnya Rp${pphExpected.toLocaleString("id-ID")}.`,
        discrepancy_rp: pphDiff,
        legal_basis: "PMK 168/2023",
        severity: pphSeverity
      });
    }
  }

  // ── BPJS Kesehatan — check ALWAYS (including December)
  const kesehatanDiff = Math.abs(
    input.deductions.bpjs_kesehatan - bpjsExpected.kesehatan
  );
  if (kesehatanDiff > ILLEGAL_EMPLOYER_DEDUCTION_THRESHOLD) {
    addIssue(issues, legalRefs, {
      type: "BPJS_KESEHATAN_MISMATCH",
      description: `Potongan BPJS Kesehatan tidak sesuai batas 1% dengan cap Rp${BPJS_KESEHATAN_CAP.toLocaleString("id-ID")} (maks Rp${BPJS_KESEHATAN_MAX.toLocaleString("id-ID")}).`,
      discrepancy_rp: kesehatanDiff,
      legal_basis: "Perpres 64/2020",
      severity: "major"
    });
  }

  // ── JHT — check ALWAYS
  const jhtDiff = Math.abs(input.deductions.bpjs_jht - bpjsExpected.jht);
  if (jhtDiff > ILLEGAL_EMPLOYER_DEDUCTION_THRESHOLD) {
    addIssue(issues, legalRefs, {
      type: "BPJS_JHT_MISMATCH",
      description: `Potongan JHT karyawan seharusnya ${(BPJS_JHT.employee_rate * 100).toFixed(0)}% dari penghasilan bruto.`,
      discrepancy_rp: jhtDiff,
      legal_basis: "PP 46/2015",
      severity: "major"
    });
  }

  // ── JP — check ALWAYS (cap changes by year/month via getJpCapForAudit)
  const jpCap = getJpCapForAudit(month);
  const jpMax = Math.round(jpCap * BPJS_JP.employee_rate);
  const jpDiff = Math.abs(input.deductions.bpjs_jp - bpjsExpected.jp);
  if (jpDiff > ILLEGAL_EMPLOYER_DEDUCTION_THRESHOLD) {
    addIssue(issues, legalRefs, {
      type: "BPJS_JP_MISMATCH",
      description: `Potongan JP karyawan seharusnya 1% dengan cap Rp${jpCap.toLocaleString("id-ID")} (maks Rp${jpMax.toLocaleString("id-ID")}).`,
      discrepancy_rp: jpDiff,
      legal_basis: "PP 45/2015",
      severity: "major"
    });
  }

  // ── JKK — illegal if > 0 (ALWAYS, including December)
  if (input.deductions.bpjs_jkk > ILLEGAL_EMPLOYER_DEDUCTION_THRESHOLD) {
    addIssue(issues, legalRefs, {
      type: "ILLEGAL_JKK_DEDUCTION",
      description: "JKK adalah iuran pihak pemberi kerja; tidak boleh dipotong dari karyawan.",
      discrepancy_rp: input.deductions.bpjs_jkk,
      legal_basis: "PP 44/2015",
      severity: "critical"
    });
  }

  // ── JKM — illegal if > 0 (ALWAYS, including December)
  if (input.deductions.bpjs_jkm > ILLEGAL_EMPLOYER_DEDUCTION_THRESHOLD) {
    addIssue(issues, legalRefs, {
      type: "ILLEGAL_JKM_DEDUCTION",
      description: "JKM adalah iuran pihak pemberi kerja; tidak boleh dipotong dari karyawan.",
      discrepancy_rp: input.deductions.bpjs_jkm,
      legal_basis: "PP 44/2015",
      severity: "critical"
    });
  }

  // ── Total > 50% gross check (PP 36/2021 Pasal 65)
  const totalCharged =
    input.deductions.pph21 +
    bpjsChargedTotal +
    Math.max(0, input.deductions.potongan_lain);
  if (totalCharged > gross * 0.5) {
    addIssue(issues, legalRefs, {
      type: "TOTAL_DEDUCTION_OVER_50_PERCENT",
      description: "Total potongan melebihi 50% penghasilan bruto.",
      discrepancy_rp: Math.round(totalCharged - gross * 0.5),
      legal_basis: "PP 36/2021 Pasal 65",
      severity: "critical"
    });
  }

  const otherLegal = Math.max(0, input.deductions.potongan_lain);
  const pphForTotal = isDecember ? input.deductions.pph21 : pphExpected;
  const legalExpectedTotal = pphForTotal + bpjsExpected.total + otherLegal;
  const discrepancyRp = Math.max(0, totalCharged - legalExpectedTotal);

  return {
    verdict: determineVerdict(issues),
    expected_breakdown: {
      pph21: pphExpected,
      bpjs: bpjsBreakdown,
      bpjs_total: bpjsExpected.total,
      total_legal_deductions: legalExpectedTotal
    },
    issues,
    discrepancy_rp: discrepancyRp,
    legal_refs: Array.from(legalRefs),
    ...(isDecember
      ? {
          note: "Masa pajak Desember: PPh 21 menggunakan rekonsiliasi Pasal 17 (tidak diperiksa TER). Komponen BPJS tetap diperiksa."
        }
      : {})
  };
}
