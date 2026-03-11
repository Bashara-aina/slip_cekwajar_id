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

type TERSlab = {
  min: number;
  max: number | null;
  ratePercent: number;
};

export interface BPJSExpected {
  kesehatan: number;
  jht: number;
  jp: number;
  jkk: number;
  jkm: number;
  total: number;
}

const BPJS_KESEHATAN_CAP = 12_000_000;
const BPJS_KESEHATAN_MAX = 120_000;
const JP_CAP_2026 = 10_547_400;
const JP_MAX_2026 = 105_474;
const ILLEGAL_EMPLOYER_DEDUCTION_THRESHOLD = 1_000;

const PTKP_CATEGORY_MAP: Record<PTKPStatus, TERCategory> = {
  "TK/0": "A",
  "TK/1": "A",
  "TK/2": "B",
  "TK/3": "B",
  "K/0": "A",
  "K/1": "B",
  "K/2": "B",
  "K/3": "C",
  "K/I/0": "A",
  "K/I/1": "B",
  "K/I/2": "B",
  "K/I/3": "C"
};

const TER_SLABS: Record<TERCategory, TERSlab[]> = {
  A: [
    { min: 0, max: 5_400_000, ratePercent: 0 },
    { min: 5_400_001, max: 5_650_000, ratePercent: 0.25 },
    { min: 5_650_001, max: 5_950_000, ratePercent: 0.5 },
    { min: 5_950_001, max: 6_300_000, ratePercent: 0.75 },
    { min: 6_300_001, max: 6_750_000, ratePercent: 1 },
    { min: 6_750_001, max: 7_500_000, ratePercent: 1.25 },
    { min: 7_500_001, max: 8_550_000, ratePercent: 1.5 },
    { min: 8_550_001, max: 9_650_000, ratePercent: 1.75 },
    { min: 9_650_001, max: 10_050_000, ratePercent: 2 },
    { min: 10_050_001, max: 10_350_000, ratePercent: 2.25 },
    { min: 10_350_001, max: 10_700_000, ratePercent: 2.5 },
    { min: 10_700_001, max: 11_050_000, ratePercent: 3 },
    { min: 11_050_001, max: 11_600_000, ratePercent: 3.5 },
    { min: 11_600_001, max: 12_500_000, ratePercent: 4 },
    { min: 12_500_001, max: 13_750_000, ratePercent: 5 },
    { min: 13_750_001, max: 15_100_000, ratePercent: 6 },
    { min: 15_100_001, max: 16_950_000, ratePercent: 7 },
    { min: 16_950_001, max: 19_750_000, ratePercent: 8 },
    { min: 19_750_001, max: 24_150_000, ratePercent: 9 },
    { min: 24_150_001, max: 26_450_000, ratePercent: 10 },
    { min: 26_450_001, max: 28_000_000, ratePercent: 11 },
    { min: 28_000_001, max: 30_050_000, ratePercent: 12 },
    { min: 30_050_001, max: 32_400_000, ratePercent: 13 },
    { min: 32_400_001, max: 35_400_000, ratePercent: 14 },
    { min: 35_400_001, max: 39_100_000, ratePercent: 15 },
    { min: 39_100_001, max: 43_850_000, ratePercent: 16 },
    { min: 43_850_001, max: 47_800_000, ratePercent: 17 },
    { min: 47_800_001, max: 51_400_000, ratePercent: 18 },
    { min: 51_400_001, max: 56_300_000, ratePercent: 19 },
    { min: 56_300_001, max: 62_200_000, ratePercent: 20 },
    { min: 62_200_001, max: 68_600_000, ratePercent: 21 },
    { min: 68_600_001, max: 77_500_000, ratePercent: 22 },
    { min: 77_500_001, max: 89_000_000, ratePercent: 23 },
    { min: 89_000_001, max: 103_000_000, ratePercent: 24 },
    { min: 103_000_001, max: 125_000_000, ratePercent: 25 },
    { min: 125_000_001, max: 157_000_000, ratePercent: 26 },
    { min: 157_000_001, max: 206_000_000, ratePercent: 27 },
    { min: 206_000_001, max: 337_000_000, ratePercent: 28 },
    { min: 337_000_001, max: 454_000_000, ratePercent: 29 },
    { min: 454_000_001, max: 550_000_000, ratePercent: 30 },
    { min: 550_000_001, max: 695_000_000, ratePercent: 31 },
    { min: 695_000_001, max: 910_000_000, ratePercent: 32 },
    { min: 910_000_001, max: 1_400_000_000, ratePercent: 33 },
    { min: 1_400_000_001, max: null, ratePercent: 34 }
  ],
  B: [
    { min: 0, max: 6_200_000, ratePercent: 0 },
    { min: 6_200_001, max: 6_500_000, ratePercent: 0.25 },
    { min: 6_500_001, max: 6_850_000, ratePercent: 0.5 },
    { min: 6_850_001, max: 7_300_000, ratePercent: 0.75 },
    { min: 7_300_001, max: 9_200_000, ratePercent: 1 },
    { min: 9_200_001, max: 10_750_000, ratePercent: 1.5 },
    { min: 10_750_001, max: 11_250_000, ratePercent: 2 },
    { min: 11_250_001, max: 11_600_000, ratePercent: 2.5 },
    { min: 11_600_001, max: 12_600_000, ratePercent: 3 },
    { min: 12_600_001, max: 13_600_000, ratePercent: 4 },
    { min: 13_600_001, max: 14_950_000, ratePercent: 5 },
    { min: 14_950_001, max: 16_400_000, ratePercent: 6 },
    { min: 16_400_001, max: 18_450_000, ratePercent: 7 },
    { min: 18_450_001, max: 21_850_000, ratePercent: 8 },
    { min: 21_850_001, max: 26_000_000, ratePercent: 9 },
    { min: 26_000_001, max: 27_700_000, ratePercent: 10 },
    { min: 27_700_001, max: 29_350_000, ratePercent: 11 },
    { min: 29_350_001, max: 31_450_000, ratePercent: 12 },
    { min: 31_450_001, max: 33_950_000, ratePercent: 13 },
    { min: 33_950_001, max: 37_100_000, ratePercent: 14 },
    { min: 37_100_001, max: 41_100_000, ratePercent: 15 },
    { min: 41_100_001, max: 45_800_000, ratePercent: 16 },
    { min: 45_800_001, max: 49_500_000, ratePercent: 17 },
    { min: 49_500_001, max: 53_800_000, ratePercent: 18 },
    { min: 53_800_001, max: 58_500_000, ratePercent: 19 },
    { min: 58_500_001, max: 64_000_000, ratePercent: 20 },
    { min: 64_000_001, max: 71_000_000, ratePercent: 21 },
    { min: 71_000_001, max: 80_000_000, ratePercent: 22 },
    { min: 80_000_001, max: 93_000_000, ratePercent: 23 },
    { min: 93_000_001, max: 109_000_000, ratePercent: 24 },
    { min: 109_000_001, max: 129_000_000, ratePercent: 25 },
    { min: 129_000_001, max: 163_000_000, ratePercent: 26 },
    { min: 163_000_001, max: 211_000_000, ratePercent: 27 },
    { min: 211_000_001, max: 374_000_000, ratePercent: 28 },
    { min: 374_000_001, max: 459_000_000, ratePercent: 29 },
    { min: 459_000_001, max: 555_000_000, ratePercent: 30 },
    { min: 555_000_001, max: 704_000_000, ratePercent: 31 },
    { min: 704_000_001, max: 957_000_000, ratePercent: 32 },
    { min: 957_000_001, max: 1_405_000_000, ratePercent: 33 },
    { min: 1_405_000_001, max: null, ratePercent: 34 }
  ],
  C: [
    { min: 0, max: 6_600_000, ratePercent: 0 },
    { min: 6_600_001, max: 6_950_000, ratePercent: 0.25 },
    { min: 6_950_001, max: 7_350_000, ratePercent: 0.5 },
    { min: 7_350_001, max: 7_800_000, ratePercent: 0.75 },
    { min: 7_800_001, max: 8_850_000, ratePercent: 1 },
    { min: 8_850_001, max: 9_800_000, ratePercent: 1.25 },
    { min: 9_800_001, max: 10_950_000, ratePercent: 1.5 },
    { min: 10_950_001, max: 11_200_000, ratePercent: 1.75 },
    { min: 11_200_001, max: 12_050_000, ratePercent: 2 },
    { min: 12_050_001, max: 12_950_000, ratePercent: 3 },
    { min: 12_950_001, max: 14_150_000, ratePercent: 4 },
    { min: 14_150_001, max: 15_550_000, ratePercent: 5 },
    { min: 15_550_001, max: 17_050_000, ratePercent: 6 },
    { min: 17_050_001, max: 19_500_000, ratePercent: 7 },
    { min: 19_500_001, max: 22_700_000, ratePercent: 8 },
    { min: 22_700_001, max: 26_600_000, ratePercent: 9 },
    { min: 26_600_001, max: 28_100_000, ratePercent: 10 },
    { min: 28_100_001, max: 30_100_000, ratePercent: 11 },
    { min: 30_100_001, max: 32_600_000, ratePercent: 12 },
    { min: 32_600_001, max: 35_400_000, ratePercent: 13 },
    { min: 35_400_001, max: 38_900_000, ratePercent: 14 },
    { min: 38_900_001, max: 43_000_000, ratePercent: 15 },
    { min: 43_000_001, max: 47_400_000, ratePercent: 16 },
    { min: 47_400_001, max: 51_200_000, ratePercent: 17 },
    { min: 51_200_001, max: 55_800_000, ratePercent: 18 },
    { min: 55_800_001, max: 60_400_000, ratePercent: 19 },
    { min: 60_400_001, max: 66_700_000, ratePercent: 20 },
    { min: 66_700_001, max: 74_500_000, ratePercent: 21 },
    { min: 74_500_001, max: 83_200_000, ratePercent: 22 },
    { min: 83_200_001, max: 95_600_000, ratePercent: 23 },
    { min: 95_600_001, max: 110_000_000, ratePercent: 24 },
    { min: 110_000_001, max: 134_000_000, ratePercent: 25 },
    { min: 134_000_001, max: 169_000_000, ratePercent: 26 },
    { min: 169_000_001, max: 221_000_000, ratePercent: 27 },
    { min: 221_000_001, max: 390_000_000, ratePercent: 28 },
    { min: 390_000_001, max: 463_000_000, ratePercent: 29 },
    { min: 463_000_001, max: 561_000_000, ratePercent: 30 },
    { min: 561_000_001, max: 709_000_000, ratePercent: 31 },
    { min: 709_000_001, max: 965_000_000, ratePercent: 32 },
    { min: 965_000_001, max: 1_419_000_000, ratePercent: 33 },
    { min: 1_419_000_001, max: null, ratePercent: 34 }
  ]
};

export function getPTKPCategory(status: PTKPStatus): TERCategory {
  return PTKP_CATEGORY_MAP[status];
}

export function getTERRate(category: TERCategory, gross: number): number {
  const slab = TER_SLABS[category].find(
    (row) => gross >= row.min && (row.max === null || gross <= row.max)
  );
  return (slab?.ratePercent ?? 0) / 100;
}

export function calculateExpectedBPJS(gross: number, _month: number): BPJSExpected {
  const kesehatan = Math.min(
    Math.round(Math.min(gross, BPJS_KESEHATAN_CAP) * 0.01),
    BPJS_KESEHATAN_MAX
  );
  const jht = Math.round(gross * 0.02);
  const jp = Math.min(Math.round(Math.min(gross, JP_CAP_2026) * 0.01), JP_MAX_2026);
  const jkk = 0;
  const jkm = 0;

  return {
    kesehatan,
    jht,
    jp,
    jkk,
    jkm,
    total: kesehatan + jht + jp
  };
}

export function estimateAnnualOvercharge(monthlyDiscrepancy: number, months: number): number {
  return Math.max(0, Math.round(monthlyDiscrepancy)) * Math.max(0, Math.round(months));
}

function pphIssueSeverity(diff: number, gross: number): IssueSeverity | null {
  if (diff <= 0) return null;
  if (diff <= 1_000) return "minor";
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

  if (month === 12) {
    return {
      verdict: "WAJAR",
      expected_breakdown: {
        pph21: pphExpected,
        bpjs: bpjsBreakdown,
        bpjs_total: bpjsExpected.total,
        total_legal_deductions: pphExpected + bpjsExpected.total + input.deductions.potongan_lain
      },
      issues: [],
      discrepancy_rp: 0,
      legal_refs: ["PMK 168/2023 Pasal 17 (Masa Pajak Terakhir)"],
      note: "Masa pajak Desember menggunakan rekonsiliasi tahunan Pasal 17, bukan TER bulanan."
    };
  }

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

  const kesehatanDiff = Math.abs(input.deductions.bpjs_kesehatan - bpjsExpected.kesehatan);
  if (kesehatanDiff > 1_000) {
    addIssue(issues, legalRefs, {
      type: "BPJS_KESEHATAN_MISMATCH",
      description: `Potongan BPJS Kesehatan tidak sesuai batas 1% dengan cap Rp12.000.000 (maks Rp120.000).`,
      discrepancy_rp: kesehatanDiff,
      legal_basis: "Perpres 64/2020",
      severity: "major"
    });
  }

  const jhtDiff = Math.abs(input.deductions.bpjs_jht - bpjsExpected.jht);
  if (jhtDiff > 1_000) {
    addIssue(issues, legalRefs, {
      type: "BPJS_JHT_MISMATCH",
      description: "Potongan JHT karyawan seharusnya 2% dari penghasilan bruto.",
      discrepancy_rp: jhtDiff,
      legal_basis: "PP 84/2015",
      severity: "major"
    });
  }

  const jpDiff = Math.abs(input.deductions.bpjs_jp - bpjsExpected.jp);
  if (jpDiff > 1_000) {
    addIssue(issues, legalRefs, {
      type: "BPJS_JP_MISMATCH",
      description: `Potongan JP karyawan seharusnya 1% dengan cap Rp${JP_CAP_2026.toLocaleString("id-ID")} (maks Rp${JP_MAX_2026.toLocaleString("id-ID")}).`,
      discrepancy_rp: jpDiff,
      legal_basis: "PP 45/2015",
      severity: "major"
    });
  }

  if (input.deductions.bpjs_jkk > ILLEGAL_EMPLOYER_DEDUCTION_THRESHOLD) {
    addIssue(issues, legalRefs, {
      type: "ILLEGAL_JKK_DEDUCTION",
      description: "JKK adalah iuran pihak pemberi kerja; tidak boleh dipotong dari karyawan.",
      discrepancy_rp: input.deductions.bpjs_jkk,
      legal_basis: "PP 84/2015",
      severity: "critical"
    });
  }

  if (input.deductions.bpjs_jkm > ILLEGAL_EMPLOYER_DEDUCTION_THRESHOLD) {
    addIssue(issues, legalRefs, {
      type: "ILLEGAL_JKM_DEDUCTION",
      description: "JKM adalah iuran pihak pemberi kerja; tidak boleh dipotong dari karyawan.",
      discrepancy_rp: input.deductions.bpjs_jkm,
      legal_basis: "PP 84/2015",
      severity: "critical"
    });
  }

  const totalCharged =
    input.deductions.pph21 + bpjsChargedTotal + Math.max(0, input.deductions.potongan_lain);
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
  const legalExpectedTotal = pphExpected + bpjsExpected.total + otherLegal;
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
    legal_refs: Array.from(legalRefs)
  };
}
