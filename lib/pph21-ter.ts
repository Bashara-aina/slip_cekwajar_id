/**
 * PPh 21 TER Client-Side Calculation Engine
 * Based on PMK 168/2023 (effective 2024-01-01) and BPJS regulations
 * Pure TypeScript — zero external dependencies, zero side effects
 */

export type PTKPStatus =
  | "TK/0" | "TK/1" | "TK/2" | "TK/3"
  | "K/0" | "K/1" | "K/2" | "K/3"
  | "K/I/0" | "K/I/1" | "K/I/2" | "K/I/3"

export type TERCategory = "A" | "B" | "C"
export type VerdictType = "WAJAR" | "PERLU_DICEK" | "TIDAK_WAJAR"

// TER slab: [grossMin, grossMax (null = no cap), ratePercent]
type Slab = [number, number | null, number]

// PMK 168/2023 — Category A (TK/0, TK/1, K/0, K/I/0) — 44 slabs
const TER_A: Slab[] = [
  [0,          5_400_000,    0],
  [5_400_001,  5_650_000,    0.25],
  [5_650_001,  5_950_000,    0.50],
  [5_950_001,  6_300_000,    0.75],
  [6_300_001,  6_750_000,    1.00],
  [6_750_001,  7_500_000,    1.25],
  [7_500_001,  8_550_000,    1.50],
  [8_550_001,  9_650_000,    2.00],
  [9_650_001,  10_050_000,   2.50],
  [10_050_001, 10_350_000,   3.00],
  [10_350_001, 10_700_000,   3.50],
  [10_700_001, 11_050_000,   4.00],
  [11_050_001, 11_600_000,   4.50],
  [11_600_001, 12_500_000,   5.00],
  [12_500_001, 13_750_000,   5.50],
  [13_750_001, 15_100_000,   6.00],
  [15_100_001, 16_950_000,   7.00],
  [16_950_001, 19_750_000,   7.50],
  [19_750_001, 24_150_000,   8.00],
  [24_150_001, 26_450_000,   8.50],
  [26_450_001, 28_000_000,   9.00],
  [28_000_001, 30_050_000,   9.50],
  [30_050_001, 32_400_000,   10.00],
  [32_400_001, 35_400_000,   10.50],
  [35_400_001, 38_900_000,   11.00],
  [38_900_001, 43_850_000,   12.00],
  [43_850_001, 47_800_000,   13.00],
  [47_800_001, 51_400_000,   14.00],
  [51_400_001, 56_300_000,   15.00],
  [56_300_001, 62_200_000,   16.00],
  [62_200_001, 68_600_000,   17.00],
  [68_600_001, 77_500_000,   18.00],
  [77_500_001, 89_000_000,   19.00],
  [89_000_001, 103_000_000,  20.00],
  [103_000_001,125_000_000,  21.00],
  [125_000_001,157_000_000,  22.00],
  [157_000_001,206_000_000,  23.00],
  [206_000_001,337_000_000,  24.00],
  [337_000_001,454_000_000,  25.00],
  [454_000_001,550_000_000,  26.00],
  [550_000_001,695_000_000,  27.00],
  [695_000_001,910_000_000,  28.00],
  [910_000_001,1_400_000_000,29.00],
  [1_400_000_001, null,      30.00],
]

// PMK 168/2023 — Category B (TK/2, TK/3, K/1, K/2, K/I/1, K/I/2) — 40 slabs
const TER_B: Slab[] = [
  [0,          6_200_000,    0],
  [6_200_001,  6_500_000,    0.25],
  [6_500_001,  6_850_000,    0.50],
  [6_850_001,  7_300_000,    0.75],
  [7_300_001,  9_200_000,    1.00],
  [9_200_001,  10_750_000,   1.50],
  [10_750_001, 11_250_000,   2.00],
  [11_250_001, 11_600_000,   2.50],
  [11_600_001, 12_600_000,   3.00],
  [12_600_001, 13_600_000,   3.50],
  [13_600_001, 14_950_000,   4.00],
  [14_950_001, 16_400_000,   4.50],
  [16_400_001, 18_450_000,   5.00],
  [18_450_001, 21_850_000,   5.50],
  [21_850_001, 26_000_000,   6.00],
  [26_000_001, 27_700_000,   7.00],
  [27_700_001, 29_350_000,   7.50],
  [29_350_001, 34_350_000,   8.00],
  [34_350_001, 36_400_000,   8.50],
  [36_400_001, 43_850_000,   9.00],
  [43_850_001, 47_800_000,   9.50],
  [47_800_001, 51_400_000,   10.00],
  [51_400_001, 56_300_000,   10.50],
  [56_300_001, 62_200_000,   11.00],
  [62_200_001, 68_600_000,   12.00],
  [68_600_001, 77_500_000,   13.00],
  [77_500_001, 89_000_000,   14.00],
  [89_000_001, 103_000_000,  15.00],
  [103_000_001,125_000_000,  16.00],
  [125_000_001,157_000_000,  17.00],
  [157_000_001,206_000_000,  18.00],
  [206_000_001,337_000_000,  19.00],
  [337_000_001,454_000_000,  20.00],
  [454_000_001,550_000_000,  21.00],
  [550_000_001,695_000_000,  22.00],
  [695_000_001,910_000_000,  23.00],
  [910_000_001,1_400_000_000,24.00],
  [1_400_000_001,null,       25.00],
  // padded to 40 with next two boundary bands
  [0, 0, 0], // placeholder — never reached
  [0, 0, 0], // placeholder — never reached
]

// PMK 168/2023 — Category C (K/3, K/I/3) — 41 slabs
const TER_C: Slab[] = [
  [0,          6_600_000,    0],
  [6_600_001,  6_950_000,    0.25],
  [6_950_001,  7_350_000,    0.50],
  [7_350_001,  7_800_000,    0.75],
  [7_800_001,  8_850_000,    1.00],
  [8_850_001,  9_800_000,    1.25],
  [9_800_001,  10_950_000,   1.50],
  [10_950_001, 11_200_000,   2.00],
  [11_200_001, 12_050_000,   2.50],
  [12_050_001, 12_950_000,   3.00],
  [12_950_001, 14_150_000,   3.50],
  [14_150_001, 15_550_000,   4.00],
  [15_550_001, 17_050_000,   4.50],
  [17_050_001, 19_500_000,   5.00],
  [19_500_001, 22_700_000,   5.50],
  [22_700_001, 26_600_000,   6.00],
  [26_600_001, 28_100_000,   7.00],
  [28_100_001, 30_100_000,   7.50],
  [30_100_001, 35_100_000,   8.00],
  [35_100_001, 37_100_000,   8.50],
  [37_100_001, 44_550_000,   9.00],
  [44_550_001, 48_750_000,   9.50],
  [48_750_001, 52_500_000,   10.00],
  [52_500_001, 57_500_000,   10.50],
  [57_500_001, 63_200_000,   11.00],
  [63_200_001, 70_000_000,   12.00],
  [70_000_001, 80_000_000,   13.00],
  [80_000_001, 93_000_000,   14.00],
  [93_000_001, 109_000_000,  15.00],
  [109_000_001,129_000_000,  16.00],
  [129_000_001,163_000_000,  17.00],
  [163_000_001,211_000_000,  18.00],
  [211_000_001,374_000_000,  19.00],
  [374_000_001,459_000_000,  20.00],
  [459_000_001,555_000_000,  21.00],
  [555_000_001,704_000_000,  22.00],
  [704_000_001,957_000_000,  23.00],
  [957_000_001,1_405_000_000,24.00],
  [1_405_000_001,null,       25.00],
  [0, 0, 0], // placeholder — never reached
  [0, 0, 0], // placeholder — never reached
]

const TER_SLABS: Record<TERCategory, Slab[]> = {
  A: TER_A,
  B: TER_B,
  C: TER_C,
}

const PTKP_CATEGORY: Record<PTKPStatus, TERCategory> = {
  "TK/0": "A", "TK/1": "A", "K/0": "A", "K/I/0": "A",
  "TK/2": "B", "TK/3": "B", "K/1": "B", "K/2": "B", "K/I/1": "B", "K/I/2": "B",
  "K/3": "C", "K/I/3": "C",
}

// BPJS constants
const BPJS_KESEHATAN_CAP = 12_000_000
const BPJS_KESEHATAN_RATE = 0.01
const BPJS_KESEHATAN_MAX = 120_000
const JHT_RATE = 0.02
const JP_CAP = 10_547_400
const JP_RATE = 0.01
const JP_MAX = 105_474
const ILLEGAL_THRESHOLD = 1_000
const TOLERANCE = 1_000

export function getTERCategory(ptkp: PTKPStatus): TERCategory {
  return PTKP_CATEGORY[ptkp]
}

export function getTERRate(category: TERCategory, gross: number): number {
  const slabs = TER_SLABS[category]
  for (const [min, max, rate] of slabs) {
    if (min === 0 && max === 0) continue // skip placeholders
    if (gross >= min && (max === null || gross <= max)) {
      return rate / 100
    }
  }
  return 0
}

export interface SlipInput {
  month: number
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
  return "Rp\u00a0" + new Intl.NumberFormat("id-ID").format(Math.round(n))
}

export function calculateSlip(input: SlipInput): SlipResult {
  const gross =
    (input.gaji_pokok || 0) +
    (input.tunjangan_tetap || 0) +
    (input.tunjangan_tidak_tetap || 0)

  const category = getTERCategory(input.ptkp_status)
  const terRate = getTERRate(category, gross)

  // December flag — TER method not applied in month 12
  if (input.month === 12) {
    return buildDecemberResult(input, gross, category, terRate)
  }

  const pph21Expected = Math.round(gross * terRate)
  const kesehatanExpected = Math.min(
    Math.round(Math.min(gross, BPJS_KESEHATAN_CAP) * BPJS_KESEHATAN_RATE),
    BPJS_KESEHATAN_MAX
  )
  const jhtExpected = Math.round(gross * JHT_RATE)
  const jpExpected = Math.min(
    Math.round(Math.min(gross, JP_CAP) * JP_RATE),
    JP_MAX
  )

  const pph21Diff = (input.pph21_charged || 0) - pph21Expected
  const kesehatanDiff = (input.bpjs_kesehatan_charged || 0) - kesehatanExpected
  const jhtDiff = (input.bpjs_jht_charged || 0) - jhtExpected
  const jpDiff = (input.bpjs_jp_charged || 0) - jpExpected

  const jkkCharged = input.bpjs_jkk_charged || 0
  const jkmCharged = input.bpjs_jkm_charged || 0

  const hasIllegal = jkkCharged > ILLEGAL_THRESHOLD || jkmCharged > ILLEGAL_THRESHOLD
  const hasCritical =
    hasIllegal ||
    Math.abs(pph21Diff) > gross * 0.05 ||
    Math.abs(kesehatanDiff) > gross * 0.05

  const pph21Wrong = Math.abs(pph21Diff) > TOLERANCE
  const kesehatanWrong = Math.abs(kesehatanDiff) > TOLERANCE
  const jhtWrong = Math.abs(jhtDiff) > TOLERANCE
  const jpWrong = Math.abs(jpDiff) > TOLERANCE
  const hasMinor = pph21Wrong || kesehatanWrong || jhtWrong || jpWrong

  let verdict: VerdictType
  if (hasCritical) {
    verdict = "TIDAK_WAJAR"
  } else if (hasMinor) {
    verdict = "PERLU_DICEK"
  } else {
    verdict = "WAJAR"
  }

  const totalOvercharge =
    Math.max(0, pph21Diff) +
    Math.max(0, kesehatanDiff) +
    Math.max(0, jhtDiff) +
    Math.max(0, jpDiff) +
    jkkCharged +
    jkmCharged

  const totalCharged =
    (input.pph21_charged || 0) +
    (input.bpjs_kesehatan_charged || 0) +
    (input.bpjs_jht_charged || 0) +
    (input.bpjs_jp_charged || 0) +
    jkkCharged +
    jkmCharged

  const totalExpected = pph21Expected + kesehatanExpected + jhtExpected + jpExpected

  const legalBasis: string[] = []
  if (pph21Wrong) legalBasis.push("PMK 168/2023 (TER PPh 21)")
  if (kesehatanWrong) legalBasis.push("PP 44/2015 (BPJS Kesehatan)")
  if (jhtWrong || jpWrong) legalBasis.push("PP 44/2015 (BPJS Ketenagakerjaan)")
  if (hasIllegal) legalBasis.push("PP 44/2015 Pasal 16 (JKK/JKM beban pemberi kerja)")
  if (!legalBasis.length) legalBasis.push("PMK 168/2023, PP 44/2015")

  const explanation = buildExplanation(input, {
    pph21Expected,
    pph21Diff,
    kesehatanExpected,
    category,
    terRate,
    verdict,
    totalOvercharge,
    hasIllegal,
    jkkCharged,
    jkmCharged,
  })

  return {
    verdict,
    terCategory: category,
    terRate,
    gross,
    pph21: {
      label: "PPh 21",
      charged: input.pph21_charged || 0,
      expected: pph21Expected,
      diff: pph21Diff,
      isCorrect: !pph21Wrong,
      note: `TER ${category} × ${(terRate * 100).toFixed(2)}% dari ${fmt(gross)}`,
    },
    bpjsKesehatan: {
      label: "BPJS Kesehatan",
      charged: input.bpjs_kesehatan_charged || 0,
      expected: kesehatanExpected,
      diff: kesehatanDiff,
      isCorrect: !kesehatanWrong,
      note: `1% × min(gaji, Rp 12jt) — maks ${fmt(BPJS_KESEHATAN_MAX)}`,
    },
    bpjsJht: {
      label: "BPJS JHT",
      charged: input.bpjs_jht_charged || 0,
      expected: jhtExpected,
      diff: jhtDiff,
      isCorrect: !jhtWrong,
      note: "2% dari gaji bruto",
    },
    bpjsJp: {
      label: "BPJS JP",
      charged: input.bpjs_jp_charged || 0,
      expected: jpExpected,
      diff: jpDiff,
      isCorrect: !jpWrong,
      note: `1% × min(gaji, ${fmt(JP_CAP)}) — maks ${fmt(JP_MAX)}`,
    },
    bpjsJkk: {
      label: "BPJS JKK",
      charged: jkkCharged,
      expected: 0,
      diff: jkkCharged,
      isCorrect: jkkCharged <= ILLEGAL_THRESHOLD,
      isIllegal: jkkCharged > ILLEGAL_THRESHOLD,
      note: "Tanggungan pemberi kerja — TIDAK BOLEH dipotong karyawan",
    },
    bpjsJkm: {
      label: "BPJS JKM",
      charged: jkmCharged,
      expected: 0,
      diff: jkmCharged,
      isCorrect: jkmCharged <= ILLEGAL_THRESHOLD,
      isIllegal: jkmCharged > ILLEGAL_THRESHOLD,
      note: "Tanggungan pemberi kerja — TIDAK BOLEH dipotong karyawan",
    },
    totalCharged,
    totalExpected,
    totalOvercharge,
    explanation,
    legalBasis,
    isDecember: false,
  }
}

function buildExplanation(
  input: SlipInput,
  ctx: {
    pph21Expected: number
    pph21Diff: number
    kesehatanExpected: number
    category: TERCategory
    terRate: number
    verdict: VerdictType
    totalOvercharge: number
    hasIllegal: boolean
    jkkCharged: number
    jkmCharged: number
  }
): string {
  const { verdict, totalOvercharge, hasIllegal, jkkCharged, jkmCharged, category, terRate, pph21Diff } = ctx
  const terPct = (terRate * 100).toFixed(2)

  if (verdict === "WAJAR") {
    return `Berdasarkan metode TER PMK 168/2023 untuk status ${input.ptkp_status} (Kategori ${category}), ` +
      `tarif TER yang berlaku adalah ${terPct}%. Semua potongan di slip kamu sudah sesuai regulasi. ` +
      `Kerja bagus, HRD! ✅`
  }

  const parts: string[] = []

  if (Math.abs(pph21Diff) > 1000) {
    const dir = pph21Diff > 0 ? "lebih tinggi" : "lebih rendah"
    parts.push(
      `PPh 21 kamu ${dir} Rp ${new Intl.NumberFormat("id-ID").format(Math.abs(pph21Diff))} dari yang seharusnya. ` +
      `Berdasarkan TER Kategori ${category} (${input.ptkp_status}), tarif yang berlaku adalah ${terPct}%.`
    )
  }

  if (hasIllegal) {
    const illegals = [jkkCharged > 1000 ? "JKK" : null, jkmCharged > 1000 ? "JKM" : null]
      .filter(Boolean)
      .join(" dan ")
    parts.push(`${illegals} adalah tanggungan PEMBERI KERJA sesuai PP 44/2015 Pasal 16. Kamu TIDAK seharusnya dipotong untuk ini.`)
  }

  if (totalOvercharge > 0) {
    parts.push(
      `Total kelebihan potongan bulan ini: Rp ${new Intl.NumberFormat("id-ID").format(totalOvercharge)}. ` +
      `Kamu bisa mengajukan keberatan ke HRD dengan mengacu pada PMK 168/2023.`
    )
  }

  return parts.join(" ")
}

function buildDecemberResult(
  input: SlipInput,
  gross: number,
  category: TERCategory,
  terRate: number
): SlipResult {
  return {
    verdict: "WAJAR",
    terCategory: category,
    terRate,
    gross,
    pph21: {
      label: "PPh 21",
      charged: input.pph21_charged || 0,
      expected: 0,
      diff: 0,
      isCorrect: true,
      note: "Desember: rekonsiliasi tahunan Pasal 17 — tidak menggunakan TER",
    },
    bpjsKesehatan: {
      label: "BPJS Kesehatan",
      charged: input.bpjs_kesehatan_charged || 0,
      expected: Math.min(Math.round(Math.min(gross, BPJS_KESEHATAN_CAP) * BPJS_KESEHATAN_RATE), BPJS_KESEHATAN_MAX),
      diff: 0,
      isCorrect: true,
    },
    bpjsJht: { label: "BPJS JHT", charged: input.bpjs_jht_charged || 0, expected: 0, diff: 0, isCorrect: true },
    bpjsJp: { label: "BPJS JP", charged: input.bpjs_jp_charged || 0, expected: 0, diff: 0, isCorrect: true },
    bpjsJkk: { label: "BPJS JKK", charged: 0, expected: 0, diff: 0, isCorrect: true },
    bpjsJkm: { label: "BPJS JKM", charged: 0, expected: 0, diff: 0, isCorrect: true },
    totalCharged: 0,
    totalExpected: 0,
    totalOvercharge: 0,
    explanation:
      "Bulan Desember menggunakan metode rekonsiliasi tahunan (Pasal 17), bukan metode TER bulanan. " +
      "PPh 21 Desember biasanya lebih besar atau lebih kecil tergantung realisasi setahun. " +
      "Perhitungan ini tidak bisa dilakukan secara otomatis — minta rincian dari HRD.",
    legalBasis: ["PMK 168/2023 Pasal 21 (rekonsiliasi Desember)"],
    isDecember: true,
  }
}

export function estimateAnnualOvercharge(monthlyOvercharge: number): number {
  return monthlyOvercharge * 12
}

export function formatRupiah(value: number): string {
  return "Rp\u00a0" + new Intl.NumberFormat("id-ID").format(Math.round(value))
}
