/**
 * PPh 21 TER and BPJS calculation engine.
 * Implemented from user-provided regulation values.
 */

export type PTKPStatus =
  | "TK/0" | "TK/1" | "TK/2" | "TK/3"
  | "K/0" | "K/1" | "K/2" | "K/3"
  | "K/I/0" | "K/I/1" | "K/I/2" | "K/I/3"

export type TERCategory = "A" | "B" | "C"
export type VerdictType = "WAJAR" | "PERLU_DICEK" | "TIDAK_WAJAR"

type Slab = readonly [min: number, max: number | null, rateDecimal: number]

export const REGULATION_SOURCES = {
  pph21_ter: {
    name: "PMK No. 168/PMK.03/2023",
    url: "https://jdih.kemenkeu.go.id/fulltext/2023/168~PMK.03~2023Per.htm",
    effective: "2024-01-01",
  },
  pph21_rates_article_17: {
    name: "UU PPh Pasal 17 (perubahan terakhir UU No. 7 Tahun 2021)",
    url: "https://peraturan.bpk.go.id/Details/185162/uu-no-7-tahun-2021",
    effective: "2022-01-01",
  },
  ptkp: {
    name: "PMK No. 101/PMK.010/2016",
    url: "https://jdih.kemenkeu.go.id/fulltext/2016/101~PMK.010~2016Per.pdf",
    effective: "2016-01-01",
  },
  biaya_jabatan: {
    name: "PER-32/PJ/2015 (biaya jabatan)",
    url: "https://peraturan.bpk.go.id/Details/120946/perdirjen-pajak-no-per-32pj2015",
    effective: "2015-01-01",
  },
  bpjs_kesehatan: {
    name: "Perpres No. 64 Tahun 2020 jo. Perpres No. 82 Tahun 2018",
    url: "https://peraturan.bpk.go.id/Details/136650/perpres-no-64-tahun-2020",
    effective: "2020-07-01",
  },
  bpjs_jht: {
    name: "PP No. 46 Tahun 2015 (JHT)",
    url: "https://peraturan.bpk.go.id/Details/5614/pp-no-46-tahun-2015",
    effective: "2015-07-01",
  },
  bpjs_jp: {
    name: "PP No. 45 Tahun 2015 (JP) + penetapan batas upah tahunan",
    url: "https://peraturan.bpk.go.id/Details/5613/pp-no-45-tahun-2015",
    effective: "2015-07-01",
  },
  bpjs_jkk_jkm: {
    name: "PP No. 44 Tahun 2015 (JKK/JKM)",
    url: "https://peraturan.bpk.go.id/Home/Details/5612",
    effective: "2015-07-01",
  },
} as const

/**
 * PMK 168/2023 lampiran TER kategori A.
 * Effective: 1 Jan 2024.
 */
const TER_A: readonly Slab[] = [
  [0, 5_400_000, 0.0], [5_400_001, 5_650_000, 0.0025], [5_650_001, 5_950_000, 0.005], [5_950_001, 6_300_000, 0.0075],
  [6_300_001, 6_750_000, 0.01], [6_750_001, 7_500_000, 0.0125], [7_500_001, 8_550_000, 0.015], [8_550_001, 9_650_000, 0.0175],
  [9_650_001, 10_050_000, 0.02], [10_050_001, 10_350_000, 0.0225], [10_350_001, 10_700_000, 0.025], [10_700_001, 11_050_000, 0.03],
  [11_050_001, 11_600_000, 0.035], [11_600_001, 12_500_000, 0.04], [12_500_001, 13_750_000, 0.05], [13_750_001, 15_100_000, 0.06],
  [15_100_001, 16_950_000, 0.07], [16_950_001, 19_750_000, 0.08], [19_750_001, 24_150_000, 0.09], [24_150_001, 26_450_000, 0.1],
  [26_450_001, 28_000_000, 0.11], [28_000_001, 30_050_000, 0.12], [30_050_001, 32_400_000, 0.13], [32_400_001, 35_400_000, 0.14],
  [35_400_001, 39_100_000, 0.15], [39_100_001, 43_850_000, 0.16], [43_850_001, 47_800_000, 0.17], [47_800_001, 51_400_000, 0.18],
  [51_400_001, 56_300_000, 0.19], [56_300_001, 62_200_000, 0.2], [62_200_001, 68_600_000, 0.21], [68_600_001, 77_500_000, 0.22],
  [77_500_001, 89_000_000, 0.23], [89_000_001, 103_000_000, 0.24], [103_000_001, 125_000_000, 0.25], [125_000_001, 157_000_000, 0.26],
  [157_000_001, 206_000_000, 0.27], [206_000_001, 337_000_000, 0.28], [337_000_001, 454_000_000, 0.29], [454_000_001, 550_000_000, 0.3],
  [550_000_001, 695_000_000, 0.31], [695_000_001, 910_000_000, 0.32], [910_000_001, 1_400_000_000, 0.33], [1_400_000_001, null, 0.34],
]

/**
 * PMK 168/2023 lampiran TER kategori B.
 * Effective: 1 Jan 2024.
 */
const TER_B: readonly Slab[] = [
  [0, 6_200_000, 0.0], [6_200_001, 6_500_000, 0.0025], [6_500_001, 6_850_000, 0.005], [6_850_001, 7_300_000, 0.0075],
  [7_300_001, 9_200_000, 0.01], [9_200_001, 10_750_000, 0.015], [10_750_001, 11_250_000, 0.02], [11_250_001, 11_600_000, 0.025],
  [11_600_001, 12_600_000, 0.03], [12_600_001, 13_600_000, 0.04], [13_600_001, 14_950_000, 0.05], [14_950_001, 16_400_000, 0.06],
  [16_400_001, 18_450_000, 0.07], [18_450_001, 21_850_000, 0.08], [21_850_001, 26_000_000, 0.09], [26_000_001, 27_700_000, 0.1],
  [27_700_001, 29_350_000, 0.11], [29_350_001, 31_450_000, 0.12], [31_450_001, 33_950_000, 0.13], [33_950_001, 37_100_000, 0.14],
  [37_100_001, 41_100_000, 0.15], [41_100_001, 45_800_000, 0.16], [45_800_001, 49_500_000, 0.17], [49_500_001, 53_800_000, 0.18],
  [53_800_001, 58_500_000, 0.19], [58_500_001, 64_000_000, 0.2], [64_000_001, 71_000_000, 0.21], [71_000_001, 80_000_000, 0.22],
  [80_000_001, 93_000_000, 0.23], [93_000_001, 109_000_000, 0.24], [109_000_001, 129_000_000, 0.25], [129_000_001, 163_000_000, 0.26],
  [163_000_001, 211_000_000, 0.27], [211_000_001, 374_000_000, 0.28], [374_000_001, 459_000_000, 0.29], [459_000_001, 555_000_000, 0.3],
  [555_000_001, 704_000_000, 0.31], [704_000_001, 957_000_000, 0.32], [957_000_001, 1_405_000_000, 0.33], [1_405_000_001, null, 0.34],
]

/**
 * PMK 168/2023 lampiran TER kategori C.
 * Effective: 1 Jan 2024.
 */
const TER_C: readonly Slab[] = [
  [0, 6_600_000, 0.0], [6_600_001, 6_950_000, 0.0025], [6_950_001, 7_350_000, 0.005], [7_350_001, 7_800_000, 0.0075],
  [7_800_001, 8_850_000, 0.01], [8_850_001, 9_800_000, 0.0125], [9_800_001, 10_950_000, 0.015], [10_950_001, 11_200_000, 0.0175],
  [11_200_001, 12_050_000, 0.02], [12_050_001, 12_950_000, 0.03], [12_950_001, 14_150_000, 0.04], [14_150_001, 15_550_000, 0.05],
  [15_550_001, 17_050_000, 0.06], [17_050_001, 19_500_000, 0.07], [19_500_001, 22_700_000, 0.08], [22_700_001, 26_600_000, 0.09],
  [26_600_001, 28_100_000, 0.1], [28_100_001, 30_100_000, 0.11], [30_100_001, 32_600_000, 0.12], [32_600_001, 35_400_000, 0.13],
  [35_400_001, 38_900_000, 0.14], [38_900_001, 43_000_000, 0.15], [43_000_001, 47_400_000, 0.16], [47_400_001, 51_200_000, 0.17],
  [51_200_001, 55_800_000, 0.18], [55_800_001, 60_400_000, 0.19], [60_400_001, 66_700_000, 0.2], [66_700_001, 74_500_000, 0.21],
  [74_500_001, 83_200_000, 0.22], [83_200_001, 95_600_000, 0.23], [95_600_001, 110_000_000, 0.24], [110_000_001, 134_000_000, 0.25],
  [134_000_001, 169_000_000, 0.26], [169_000_001, 221_000_000, 0.27], [221_000_001, 390_000_000, 0.28], [390_000_001, 463_000_000, 0.29],
  [463_000_001, 561_000_000, 0.3], [561_000_001, 709_000_000, 0.31], [709_000_001, 965_000_000, 0.32], [965_000_001, 1_419_000_000, 0.33],
  [1_419_000_001, null, 0.34],
]

const TER_SLABS: Record<TERCategory, readonly Slab[]> = { A: TER_A, B: TER_B, C: TER_C }

/**
 * TER grouping source:
 * PMK No. 168/PMK.03/2023 (as instructed in user brief).
 */
const PTKP_CATEGORY: Record<PTKPStatus, TERCategory> = {
  "TK/0": "A",
  "TK/1": "A",
  "K/0": "A",
  "TK/2": "B",
  "TK/3": "B",
  "K/1": "B",
  "K/2": "C",
  "K/3": "C",
  "K/I/0": "C",
  "K/I/1": "C",
  "K/I/2": "C",
  "K/I/3": "C",
}

/**
 * PTKP setahun.
 * Source: PMK No. 101/PMK.010/2016.
 * Effective: 2016 and used in 2024-2025.
 */
const PTKP_VALUES: Record<PTKPStatus, number> = {
  "TK/0": 54_000_000,
  "TK/1": 58_500_000,
  "TK/2": 63_000_000,
  "TK/3": 67_500_000,
  "K/0": 58_500_000,
  "K/1": 63_000_000,
  "K/2": 67_500_000,
  "K/3": 72_000_000,
  "K/I/0": 112_500_000,
  "K/I/1": 117_000_000,
  "K/I/2": 121_500_000,
  "K/I/3": 126_000_000,
}

/**
 * Biaya jabatan.
 * Source: PER-32/PJ/2015 Pasal 21.
 * Effective: 2015.
 */
const BIAYA_JABATAN_RATE = 0.05
const BIAYA_JABATAN_MONTHLY_CAP = 500_000
const BIAYA_JABATAN_ANNUAL_CAP = 6_000_000

/**
 * BPJS Kesehatan PPU.
 * Source: Perpres 64/2020 jo. Perpres 82/2018.
 * Effective: 2020.
 */
const BPJS_KESEHATAN_EMPLOYEE_RATE = 0.01
const BPJS_KESEHATAN_EMPLOYER_RATE = 0.04
const BPJS_KESEHATAN_WAGE_CAP = 12_000_000
const BPJS_KESEHATAN_EMPLOYEE_MAX = 120_000

/**
 * BPJS JHT employee share.
 * Source: PP 46/2015.
 * Effective: 2015.
 */
const JHT_EMPLOYEE_RATE = 0.02

/**
 * BPJS JP employee share.
 * Source: PP 45/2015.
 * Effective: 2015.
 */
const JP_EMPLOYEE_RATE = 0.01

/**
 * JP upah maksimum (monthly wage cap).
 * Source: annual BPJS employment cap notices.
 * Effective dates in user brief: 2024-03-01 and 2025-03-01.
 */
const JP_WAGE_CAP_BY_YEAR: Record<number, number> = {
  2024: 10_042_300,
  2025: 10_547_400,
}

/**
 * JKK rates by risk group (employer-only).
 * Source: PP 44/2015 Lampiran I.
 */
export const JKK_RATES = {
  groupI: 0.0024,
  groupII: 0.0054,
  groupIII: 0.0089,
  groupIV: 0.0127,
  groupV: 0.0174,
} as const

/**
 * JKM rate (employer-only).
 * Source: PP 44/2015 Pasal 18.
 */
export const JKM_RATE = 0.003

/**
 * Product tolerance thresholds from requirement.
 * Not legal thresholds.
 */
const WAJAR_DIFF_MAX = 10_000
const PERLU_DICEK_DIFF_MAX = 50_000

/**
 * Pasal 17 progressive annual tax rates.
 * Source: UU PPh Pasal 17 (updated by UU 7/2021 / HPP).
 */
const PASAL_17_BRACKETS: readonly Slab[] = [
  [0, 60_000_000, 0.05],
  [60_000_000, 250_000_000, 0.15],
  [250_000_000, 500_000_000, 0.25],
  [500_000_000, 5_000_000_000, 0.3],
  [5_000_000_000, null, 0.35],
]

export interface SlipInput {
  month: number
  tax_year?: number
  ptkp_status: PTKPStatus
  gaji_pokok: number
  tunjangan_tetap: number
  tunjangan_tidak_tetap: number
  pph21_charged: number
  bpjs_kesehatan_charged: number
  bpjs_jht_charged: number
  bpjs_jp_charged: number
  bpjs_jkk_charged: number
  bpjs_jkm_charged: number
  potongan_lain: number
  annual_gross?: number
  annual_iuran_pensiun?: number
  annual_zakat?: number
  annual_pph21_paid_before_last_period?: number
}

export interface ComponentResult {
  label: string
  charged: number
  expected: number
  diff: number
  isCorrect: boolean
  isIllegal?: boolean
  note?: string
}

type CalculationItem = {
  expected: number
  actual: number
  diff: number
  verdict: VerdictType
  regulation: string
  explanation_id: string
}

export interface CalculateAllResult {
  pph21: CalculationItem
  bpjsKesehatan: CalculationItem
  bpjsJHT: CalculationItem
  bpjsJP: CalculationItem
  jkk: {
    shouldBeZero: boolean
    actual: number
    verdict: VerdictType
    explanation_id: string
  }
  jkm: {
    shouldBeZero: boolean
    actual: number
    verdict: VerdictType
    explanation_id: string
  }
  overallVerdict: VerdictType
  totalOvercharge: number
  annualImpact: number
  flags: string[]
  terCategory: TERCategory
  terRate: number
  gross: number
  isDecember: boolean
}

export interface SlipResult {
  verdict: VerdictType
  terCategory: TERCategory
  terRate: number
  gross: number
  pph21: ComponentResult
  bpjsKesehatan: ComponentResult
  bpjsJht: ComponentResult
  bpjsJp: ComponentResult
  bpjsJkk: ComponentResult
  bpjsJkm: ComponentResult
  totalCharged: number
  totalExpected: number
  totalOvercharge: number
  explanation: string
  legalBasis: string[]
  isDecember: boolean
}

function fmt(n: number): string {
  return "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n))
}

function classifyDiff(diff: number): VerdictType {
  const abs = Math.abs(diff)
  if (abs <= WAJAR_DIFF_MAX) return "WAJAR"
  if (abs <= PERLU_DICEK_DIFF_MAX) return "PERLU_DICEK"
  return "TIDAK_WAJAR"
}

function worstVerdict(a: VerdictType, b: VerdictType): VerdictType {
  const rank: Record<VerdictType, number> = { WAJAR: 0, PERLU_DICEK: 1, TIDAK_WAJAR: 2 }
  return rank[a] >= rank[b] ? a : b
}

function progressiveTax(pkp: number, brackets: readonly Slab[]): number {
  let tax = 0

  for (const [min, max, rate] of brackets) {
    const upper = max ?? Number.POSITIVE_INFINITY
    const taxable = Math.max(0, Math.min(pkp, upper) - min)
    tax += taxable * rate
  }

  return Math.round(tax)
}

export function getTERCategory(ptkp: PTKPStatus): TERCategory {
  return PTKP_CATEGORY[ptkp]
}

export function getTERRate(category: TERCategory, gross: number): number {
  for (const [min, max, rate] of TER_SLABS[category]) {
    if (gross >= min && (max === null || gross <= max)) return rate
  }
  return 0
}

function getJpCap(year?: number): number {
  if (!year) return JP_WAGE_CAP_BY_YEAR[2025]
  return JP_WAGE_CAP_BY_YEAR[year] ?? JP_WAGE_CAP_BY_YEAR[2025]
}

function calculateBiayaJabatan(annualGross: number): number {
  return Math.min(
    annualGross * BIAYA_JABATAN_RATE,
    BIAYA_JABATAN_MONTHLY_CAP * 12,
    BIAYA_JABATAN_ANNUAL_CAP
  )
}

function calculateAnnualPph21Expected(input: SlipInput): { expected: number; debugNoBiaya: number } {
  const annualGross = input.annual_gross ?? 0
  const annualIuranPensiun = input.annual_iuran_pensiun ?? 0
  const annualZakat = input.annual_zakat ?? 0
  const paidJanNov = input.annual_pph21_paid_before_last_period ?? 0
  const ptkpAnnual = PTKP_VALUES[input.ptkp_status]

  const biayaJabatanApplied = calculateBiayaJabatan(annualGross)
  const pkpLegal = Math.max(0, annualGross - biayaJabatanApplied - annualIuranPensiun - annualZakat - ptkpAnnual)
  const annualTaxLegal = progressiveTax(pkpLegal, PASAL_17_BRACKETS)
  const expected = Math.max(0, annualTaxLegal - paidJanNov)

  const pkpNoBiaya = Math.max(0, annualGross - annualIuranPensiun - annualZakat - ptkpAnnual)
  const annualTaxNoBiaya = progressiveTax(pkpNoBiaya, PASAL_17_BRACKETS)
  const debugNoBiaya = Math.max(0, annualTaxNoBiaya - paidJanNov)

  return {
    expected: Math.round(expected),
    debugNoBiaya: Math.round(debugNoBiaya),
  }
}

export function calculateAll(input: SlipInput): CalculateAllResult {
  const gross = (input.gaji_pokok || 0) + (input.tunjangan_tetap || 0) + (input.tunjangan_tidak_tetap || 0)
  const category = getTERCategory(input.ptkp_status)
  const terRate = getTERRate(category, gross)
  const isDecember = input.month === 12
  const taxYear = input.tax_year ?? new Date().getFullYear()

  const pph21Expected = isDecember
    ? input.annual_gross !== undefined
      ? calculateAnnualPph21Expected(input).expected
      : 0
    : Math.round(gross * terRate)

  const bpjsKesehatanExpected = Math.round(Math.min(gross, BPJS_KESEHATAN_WAGE_CAP) * BPJS_KESEHATAN_EMPLOYEE_RATE)
  const bpjsJHTExpected = Math.round(gross * JHT_EMPLOYEE_RATE)
  const jpCap = getJpCap(taxYear)
  const bpjsJPExpected = Math.round(Math.min(gross, jpCap) * JP_EMPLOYEE_RATE)

  const pph21Actual = input.pph21_charged || 0
  const bpjsKesehatanActual = input.bpjs_kesehatan_charged || 0
  const bpjsJHTActual = input.bpjs_jht_charged || 0
  const bpjsJPActual = input.bpjs_jp_charged || 0
  const jkkActual = input.bpjs_jkk_charged || 0
  const jkmActual = input.bpjs_jkm_charged || 0

  const pph21Diff = pph21Actual - pph21Expected
  const kesehatanDiff = bpjsKesehatanActual - bpjsKesehatanExpected
  const jhtDiff = bpjsJHTActual - bpjsJHTExpected
  const jpDiff = bpjsJPActual - bpjsJPExpected

  const pph21Verdict = isDecember && input.annual_gross === undefined
    ? "PERLU_DICEK"
    : classifyDiff(pph21Diff)
  const kesehatanVerdict = classifyDiff(kesehatanDiff)
  const jhtVerdict = classifyDiff(jhtDiff)
  const jpVerdict = classifyDiff(jpDiff)

  const flags: string[] = []

  const jkkVerdict: VerdictType = jkkActual > 0 ? "TIDAK_WAJAR" : "WAJAR"
  if (jkkActual > 0) flags.push("JKK dipotong dari karyawan (harus beban pemberi kerja)")

  const jkmVerdict: VerdictType = jkmActual > 0 ? "TIDAK_WAJAR" : "WAJAR"
  if (jkmActual > 0) flags.push("JKM dipotong dari karyawan (harus beban pemberi kerja)")

  if (bpjsKesehatanActual > BPJS_KESEHATAN_EMPLOYEE_MAX) {
    flags.push("Potongan BPJS Kesehatan karyawan melebihi batas Rp 120.000")
  }
  const kesehatanCapVerdict: VerdictType = bpjsKesehatanActual > BPJS_KESEHATAN_EMPLOYEE_MAX ? "TIDAK_WAJAR" : kesehatanVerdict

  if (gross > jpCap && bpjsJPActual > bpjsJPExpected) {
    flags.push("Potongan JP dihitung pada gaji di atas batas upah JP")
  }
  const jpCapVerdict: VerdictType = gross > jpCap && bpjsJPActual > bpjsJPExpected ? "TIDAK_WAJAR" : jpVerdict

  let biayaJabatanVerdict: VerdictType = "WAJAR"
  if (isDecember && input.annual_gross !== undefined) {
    const annualCheck = calculateAnnualPph21Expected(input)
    const looksLikeNoBiaya = Math.abs(pph21Actual - annualCheck.debugNoBiaya) <= WAJAR_DIFF_MAX
    const legalFar = Math.abs(pph21Actual - annualCheck.expected) > PERLU_DICEK_DIFF_MAX
    if (looksLikeNoBiaya && legalFar) {
      biayaJabatanVerdict = "TIDAK_WAJAR"
      flags.push("Biaya jabatan tidak diterapkan sebelum hitung PPh 21 rekonsiliasi")
    }
  }
  if (isDecember && input.annual_gross === undefined) {
    flags.push("Data rekonsiliasi tahunan belum lengkap (annual_gross tidak diisi)")
  }

  let overallVerdict = pph21Verdict
  overallVerdict = worstVerdict(overallVerdict, kesehatanCapVerdict)
  overallVerdict = worstVerdict(overallVerdict, jhtVerdict)
  overallVerdict = worstVerdict(overallVerdict, jpCapVerdict)
  overallVerdict = worstVerdict(overallVerdict, jkkVerdict)
  overallVerdict = worstVerdict(overallVerdict, jkmVerdict)
  overallVerdict = worstVerdict(overallVerdict, biayaJabatanVerdict)

  const totalOvercharge =
    Math.max(0, pph21Diff) +
    Math.max(0, kesehatanDiff) +
    Math.max(0, jhtDiff) +
    Math.max(0, jpDiff) +
    Math.max(0, jkkActual) +
    Math.max(0, jkmActual)

  return {
    pph21: {
      expected: pph21Expected,
      actual: pph21Actual,
      diff: pph21Diff,
      verdict: pph21Verdict,
      regulation: isDecember ? "PMK 168/2023 rekonsiliasi Desember + Pasal 17" : "PMK 168/2023 TER",
      explanation_id: isDecember
        ? "PPh 21 masa terakhir dihitung dengan rekonsiliasi tahunan Pasal 17."
        : "PPh 21 Jan-Nov dihitung pakai tarif efektif rata-rata (TER).",
    },
    bpjsKesehatan: {
      expected: bpjsKesehatanExpected,
      actual: bpjsKesehatanActual,
      diff: kesehatanDiff,
      verdict: kesehatanCapVerdict,
      regulation: "Perpres 64/2020 jo. Perpres 82/2018",
      explanation_id: "BPJS Kesehatan karyawan 1% dari upah dengan batas upah Rp 12.000.000.",
    },
    bpjsJHT: {
      expected: bpjsJHTExpected,
      actual: bpjsJHTActual,
      diff: jhtDiff,
      verdict: jhtVerdict,
      regulation: "PP 46/2015",
      explanation_id: "JHT karyawan 2% dari upah bulanan.",
    },
    bpjsJP: {
      expected: bpjsJPExpected,
      actual: bpjsJPActual,
      diff: jpDiff,
      verdict: jpCapVerdict,
      regulation: "PP 45/2015 + batas upah JP tahunan",
      explanation_id: `JP karyawan 1% dengan batas upah ${fmt(jpCap)} untuk tahun ${taxYear}.`,
    },
    jkk: {
      shouldBeZero: true,
      actual: jkkActual,
      verdict: jkkVerdict,
      explanation_id: "JKK adalah beban pemberi kerja, tidak boleh dipotong dari karyawan.",
    },
    jkm: {
      shouldBeZero: true,
      actual: jkmActual,
      verdict: jkmVerdict,
      explanation_id: "JKM adalah beban pemberi kerja, tidak boleh dipotong dari karyawan.",
    },
    overallVerdict,
    totalOvercharge,
    annualImpact: totalOvercharge * 12,
    flags,
    terCategory: category,
    terRate,
    gross,
    isDecember,
  }
}

function buildExplanation(result: CalculateAllResult): string {
  if (result.overallVerdict === "WAJAR") {
    return "Potongan di slip sesuai parameter regulasi yang dihitung sistem."
  }

  const parts: string[] = []
  if (result.pph21.verdict !== "WAJAR") parts.push("PPh 21 berbeda dari hasil perhitungan regulasi.")
  if (result.bpjsKesehatan.verdict !== "WAJAR") parts.push("BPJS Kesehatan berbeda dari batas 1% dan cap upah.")
  if (result.bpjsJP.verdict !== "WAJAR") parts.push("BPJS JP berbeda dari batas upah JP yang berlaku.")
  if (result.jkk.verdict === "TIDAK_WAJAR") parts.push("JKK dipotong dari karyawan padahal beban pemberi kerja.")
  if (result.jkm.verdict === "TIDAK_WAJAR") parts.push("JKM dipotong dari karyawan padahal beban pemberi kerja.")
  if (result.flags.length) parts.push(`Temuan: ${result.flags.join("; ")}.`)
  parts.push(`Estimasi potongan berlebih per bulan: ${fmt(result.totalOvercharge)}.`)

  return parts.join(" ")
}

export function calculateSlip(input: SlipInput): SlipResult {
  const all = calculateAll(input)

  const totalExpected = all.pph21.expected + all.bpjsKesehatan.expected + all.bpjsJHT.expected + all.bpjsJP.expected
  const totalCharged =
    all.pph21.actual +
    all.bpjsKesehatan.actual +
    all.bpjsJHT.actual +
    all.bpjsJP.actual +
    all.jkk.actual +
    all.jkm.actual

  const legalBasis = [
    REGULATION_SOURCES.pph21_ter.name,
    REGULATION_SOURCES.bpjs_kesehatan.name,
    REGULATION_SOURCES.bpjs_jht.name,
    REGULATION_SOURCES.bpjs_jp.name,
    REGULATION_SOURCES.bpjs_jkk_jkm.name,
  ]

  return {
    verdict: all.overallVerdict,
    terCategory: all.terCategory,
    terRate: all.terRate,
    gross: all.gross,
    pph21: {
      label: "PPh 21",
      charged: all.pph21.actual,
      expected: all.pph21.expected,
      diff: all.pph21.diff,
      isCorrect: all.pph21.verdict === "WAJAR",
      note: all.isDecember
        ? "Masa terakhir: rekonsiliasi tahunan Pasal 17"
        : `TER ${all.terCategory} x ${(all.terRate * 100).toFixed(2)}%`,
    },
    bpjsKesehatan: {
      label: "BPJS Kesehatan",
      charged: all.bpjsKesehatan.actual,
      expected: all.bpjsKesehatan.expected,
      diff: all.bpjsKesehatan.diff,
      isCorrect: all.bpjsKesehatan.verdict === "WAJAR",
      isIllegal: all.bpjsKesehatan.actual > BPJS_KESEHATAN_EMPLOYEE_MAX,
      note: `1% x min(gaji, ${fmt(BPJS_KESEHATAN_WAGE_CAP)})`,
    },
    bpjsJht: {
      label: "BPJS JHT",
      charged: all.bpjsJHT.actual,
      expected: all.bpjsJHT.expected,
      diff: all.bpjsJHT.diff,
      isCorrect: all.bpjsJHT.verdict === "WAJAR",
      note: "2% dari upah bulanan",
    },
    bpjsJp: {
      label: "BPJS JP",
      charged: all.bpjsJP.actual,
      expected: all.bpjsJP.expected,
      diff: all.bpjsJP.diff,
      isCorrect: all.bpjsJP.verdict === "WAJAR",
      isIllegal: all.bpjsJP.verdict === "TIDAK_WAJAR" && all.flags.some((f) => f.includes("JP")),
      note: all.bpjsJP.explanation_id,
    },
    bpjsJkk: {
      label: "BPJS JKK",
      charged: all.jkk.actual,
      expected: 0,
      diff: all.jkk.actual,
      isCorrect: all.jkk.verdict === "WAJAR",
      isIllegal: all.jkk.verdict === "TIDAK_WAJAR",
      note: all.jkk.explanation_id,
    },
    bpjsJkm: {
      label: "BPJS JKM",
      charged: all.jkm.actual,
      expected: 0,
      diff: all.jkm.actual,
      isCorrect: all.jkm.verdict === "WAJAR",
      isIllegal: all.jkm.verdict === "TIDAK_WAJAR",
      note: all.jkm.explanation_id,
    },
    totalCharged,
    totalExpected,
    totalOvercharge: all.totalOvercharge,
    explanation: buildExplanation(all),
    legalBasis,
    isDecember: all.isDecember,
  }
}

export function estimateAnnualOvercharge(monthlyOvercharge: number): number {
  return monthlyOvercharge * 12
}

export function formatRupiah(value: number): string {
  return "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(value))
}
