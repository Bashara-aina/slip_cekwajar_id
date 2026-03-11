/**
 * PPh 21 TER and BPJS calculation tests.
 * Known correct values from DJP / regulation examples.
 */

import {
  getTERCategory,
  getTERRate,
  getJpCap,
  calculateAll,
  calculateSlip,
  validateSlipInput,
  isDecemberInput,
} from "../pph21-ter"

// ─── TER Category Assignment ───────────────────────────────────
describe("TER Category Assignment (PMK 168/2023)", () => {
  test("TK/0 → A", () => expect(getTERCategory("TK/0")).toBe("A"))
  test("TK/1 → A", () => expect(getTERCategory("TK/1")).toBe("A"))
  test("K/0  → A", () => expect(getTERCategory("K/0")).toBe("A"))

  test("TK/2 → B", () => expect(getTERCategory("TK/2")).toBe("B"))
  test("TK/3 → B", () => expect(getTERCategory("TK/3")).toBe("B"))
  test("K/1  → B", () => expect(getTERCategory("K/1")).toBe("B"))
  test("K/2  → B (was wrong as C, now fixed)", () =>
    expect(getTERCategory("K/2")).toBe("B"))

  test("K/3   → C", () => expect(getTERCategory("K/3")).toBe("C"))
  test("K/I/0 → C", () => expect(getTERCategory("K/I/0")).toBe("C"))
  test("K/I/3 → C", () => expect(getTERCategory("K/I/3")).toBe("C"))
})

// ─── JP Cap Month Boundary ─────────────────────────────────────
describe("getJpCap — March boundary logic", () => {
  test("Jan 2025 → 2024 cap (10_042_300)", () =>
    expect(getJpCap(2025, 1)).toBe(10_042_300))
  test("Feb 2025 → 2024 cap (10_042_300)", () =>
    expect(getJpCap(2025, 2)).toBe(10_042_300))
  test("Mar 2025 → 2025 cap (10_547_400)", () =>
    expect(getJpCap(2025, 3)).toBe(10_547_400))
  test("Dec 2025 → 2025 cap (10_547_400)", () =>
    expect(getJpCap(2025, 12)).toBe(10_547_400))
  test("Jan 2026 → 2025 cap (10_547_400)", () =>
    expect(getJpCap(2026, 1)).toBe(10_547_400))
  test("Feb 2026 → 2025 cap (10_547_400)", () =>
    expect(getJpCap(2026, 2)).toBe(10_547_400))
  test("Mar 2026 → 2026 cap (11_004_000)", () =>
    expect(getJpCap(2026, 3)).toBe(11_004_000))
})

// ─── TER Rates (DJP official examples) ────────────────────────
describe("TER Rates — known lookup values", () => {
  test("Cat A, Rp5.000.000 → 0% (below threshold)", () =>
    expect(getTERRate("A", 5_000_000)).toBe(0))
  test("Cat A, Rp5.400.000 → 0% (at boundary)", () =>
    expect(getTERRate("A", 5_400_000)).toBe(0))
  test("Cat A, Rp5.400.001 → 0.25%", () =>
    expect(getTERRate("A", 5_400_001)).toBe(0.0025))
  test("Cat A, Rp8.000.000 → 1.5% (slab 7.5M–8.55M)", () =>
    expect(getTERRate("A", 8_000_000)).toBe(0.015))
  test("Cat A, Rp10.000.000 → 2.00%", () =>
    expect(getTERRate("A", 10_000_000)).toBe(0.02))
  test("Cat B, Rp6.200.000 → 0%", () =>
    expect(getTERRate("B", 6_200_000)).toBe(0))
  test("Cat C, Rp7.000.000 → 0.50%", () =>
    expect(getTERRate("C", 7_000_000)).toBe(0.005))
})

// ─── BPJS Kesehatan Cap ────────────────────────────────────────
describe("BPJS Kesehatan — 1% capped at Rp120.000", () => {
  const baseInput = {
    month: 3,
    ptkp_status: "TK/0" as const,
    tunjangan_tetap: 0,
    tunjangan_tidak_tetap: 0,
    pph21_charged: 0,
    bpjs_jht_charged: 0,
    bpjs_jp_charged: 0,
    bpjs_jkk_charged: 0,
    bpjs_jkm_charged: 0,
    potongan_lain: 0,
  }

  test("Gaji Rp8jt → expected Rp80.000 (1%)", () => {
    const r = calculateAll({
      ...baseInput,
      gaji_pokok: 8_000_000,
      bpjs_kesehatan_charged: 80_000,
    })
    expect(r.bpjsKesehatan.expected).toBe(80_000)
  })

  test("Gaji Rp12jt → expected Rp120.000 (cap)", () => {
    const r = calculateAll({
      ...baseInput,
      gaji_pokok: 12_000_000,
      bpjs_kesehatan_charged: 120_000,
    })
    expect(r.bpjsKesehatan.expected).toBe(120_000)
  })

  test("Gaji Rp50jt → expected still Rp120.000 (cap)", () => {
    const r = calculateAll({
      ...baseInput,
      gaji_pokok: 50_000_000,
      bpjs_kesehatan_charged: 120_000,
    })
    expect(r.bpjsKesehatan.expected).toBe(120_000)
  })

  test("Charged Rp150.000 on Rp12jt → TIDAK_WAJAR", () => {
    const r = calculateAll({
      ...baseInput,
      gaji_pokok: 12_000_000,
      bpjs_kesehatan_charged: 150_000,
    })
    expect(r.bpjsKesehatan.verdict).toBe("TIDAK_WAJAR")
  })
})

// ─── JKK / JKM Employer-Only Enforcement ──────────────────────
describe("JKK/JKM — employer only (PP 44/2015)", () => {
  const baseInput = {
    month: 5,
    ptkp_status: "TK/0" as const,
    gaji_pokok: 8_000_000,
    tunjangan_tetap: 0,
    tunjangan_tidak_tetap: 0,
    pph21_charged: 140_000,
    bpjs_kesehatan_charged: 80_000,
    bpjs_jht_charged: 160_000,
    bpjs_jp_charged: 80_000,
    potongan_lain: 0,
  }

  test("JKK = 0 → WAJAR", () => {
    const r = calculateAll({
      ...baseInput,
      bpjs_jkk_charged: 0,
      bpjs_jkm_charged: 0,
    })
    expect(r.jkk.verdict).toBe("WAJAR")
  })

  test("JKK > 0 → TIDAK_WAJAR + overallVerdict TIDAK_WAJAR", () => {
    const r = calculateAll({
      ...baseInput,
      bpjs_jkk_charged: 89_000,
      bpjs_jkm_charged: 0,
    })
    expect(r.jkk.verdict).toBe("TIDAK_WAJAR")
    expect(r.overallVerdict).toBe("TIDAK_WAJAR")
    expect(r.flags).toContain(
      "JKK dipotong dari karyawan (harus beban pemberi kerja)"
    )
  })

  test("JKM > 0 → TIDAK_WAJAR", () => {
    const r = calculateAll({
      ...baseInput,
      bpjs_jkk_charged: 0,
      bpjs_jkm_charged: 24_000,
    })
    expect(r.jkm.verdict).toBe("TIDAK_WAJAR")
  })
})

// ─── December null handling ────────────────────────────────────
describe("December reconciliation", () => {
  const baseDecember = {
    month: 12,
    ptkp_status: "TK/0" as const,
    gaji_pokok: 8_000_000,
    tunjangan_tetap: 0,
    tunjangan_tidak_tetap: 0,
    pph21_charged: 500_000,
    bpjs_kesehatan_charged: 80_000,
    bpjs_jht_charged: 160_000,
    bpjs_jp_charged: 80_000,
    bpjs_jkk_charged: 0,
    bpjs_jkm_charged: 0,
    potongan_lain: 0,
  }

  test("No annual_gross → pph21.expected is null", () => {
    const r = calculateAll(baseDecember)
    expect(r.pph21.expected).toBeNull()
    expect(r.pph21.verdict).toBe("PERLU_DICEK")
    expect(r.flags).toContain(
      "Bulan Desember: isi total penghasilan tahunan untuk hasil akurat"
    )
  })

  test("With annual_gross → pph21.expected is a number", () => {
    const r = calculateAll({
      ...baseDecember,
      annual_gross: 96_000_000,
      annual_pph21_paid_before_last_period: 2_800_000,
    })
    expect(typeof r.pph21.expected).toBe("number")
    expect(r.pph21.expected).toBeGreaterThanOrEqual(0)
  })
})

// ─── SlipResult pph21DataIncomplete ─────────────────────────────
describe("calculateSlip — pph21DataIncomplete", () => {
  test("December without annual_gross → pph21DataIncomplete true", () => {
    const r = calculateSlip({
      month: 12,
      ptkp_status: "TK/0",
      gaji_pokok: 8_000_000,
      tunjangan_tetap: 0,
      tunjangan_tidak_tetap: 0,
      pph21_charged: 500_000,
      bpjs_kesehatan_charged: 80_000,
      bpjs_jht_charged: 160_000,
      bpjs_jp_charged: 80_000,
      bpjs_jkk_charged: 0,
      bpjs_jkm_charged: 0,
      potongan_lain: 0,
    })
    expect(r.pph21DataIncomplete).toBe(true)
  })

  test("December with annual_gross → pph21DataIncomplete false", () => {
    const r = calculateSlip({
      month: 12,
      ptkp_status: "TK/0",
      gaji_pokok: 8_000_000,
      tunjangan_tetap: 0,
      tunjangan_tidak_tetap: 0,
      pph21_charged: 500_000,
      bpjs_kesehatan_charged: 80_000,
      bpjs_jht_charged: 160_000,
      bpjs_jp_charged: 80_000,
      bpjs_jkk_charged: 0,
      bpjs_jkm_charged: 0,
      potongan_lain: 0,
      annual_gross: 96_000_000,
      annual_pph21_paid_before_last_period: 2_800_000,
    })
    expect(r.pph21DataIncomplete).toBe(false)
  })
})

// ─── validateSlipInput ─────────────────────────────────────────
describe("validateSlipInput", () => {
  test("Valid input → no errors", () => {
    expect(
      validateSlipInput({
        month: 5,
        ptkp_status: "TK/0",
        gaji_pokok: 8_000_000,
        tunjangan_tetap: 0,
        tunjangan_tidak_tetap: 0,
        pph21_charged: 0,
        bpjs_kesehatan_charged: 0,
        bpjs_jht_charged: 0,
        bpjs_jp_charged: 0,
        bpjs_jkk_charged: 0,
        bpjs_jkm_charged: 0,
        potongan_lain: 0,
      })
    ).toHaveLength(0)
  })

  test("December without annual_gross → error", () => {
    const errors = validateSlipInput({
      month: 12,
      ptkp_status: "TK/0",
      gaji_pokok: 8_000_000,
      tunjangan_tetap: 0,
      tunjangan_tidak_tetap: 0,
      pph21_charged: 0,
      bpjs_kesehatan_charged: 0,
      bpjs_jht_charged: 0,
      bpjs_jp_charged: 0,
      bpjs_jkk_charged: 0,
      bpjs_jkm_charged: 0,
      potongan_lain: 0,
    })
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]).toMatch(/Desember/)
  })

  test("Invalid month → error", () => {
    const errors = validateSlipInput({
      month: 13,
      ptkp_status: "TK/0",
      gaji_pokok: 0,
      tunjangan_tetap: 0,
      tunjangan_tidak_tetap: 0,
      pph21_charged: 0,
      bpjs_kesehatan_charged: 0,
      bpjs_jht_charged: 0,
      bpjs_jp_charged: 0,
      bpjs_jkk_charged: 0,
      bpjs_jkm_charged: 0,
      potongan_lain: 0,
    })
    expect(errors).toContain("Bulan harus antara 1–12")
  })
})

// ─── isDecemberInput type guard ────────────────────────────────
describe("isDecemberInput", () => {
  test("December with annual_gross → true", () => {
    const input = {
      month: 12,
      ptkp_status: "TK/0" as const,
      gaji_pokok: 8_000_000,
      tunjangan_tetap: 0,
      tunjangan_tidak_tetap: 0,
      pph21_charged: 0,
      bpjs_kesehatan_charged: 0,
      bpjs_jht_charged: 0,
      bpjs_jp_charged: 0,
      bpjs_jkk_charged: 0,
      bpjs_jkm_charged: 0,
      potongan_lain: 0,
      annual_gross: 96_000_000,
    }
    expect(isDecemberInput(input)).toBe(true)
    expect(input.annual_gross).toBe(96_000_000)
  })

  test("December without annual_gross → false", () => {
    const input = {
      month: 12,
      ptkp_status: "TK/0" as const,
      gaji_pokok: 8_000_000,
      tunjangan_tetap: 0,
      tunjangan_tidak_tetap: 0,
      pph21_charged: 0,
      bpjs_kesehatan_charged: 0,
      bpjs_jht_charged: 0,
      bpjs_jp_charged: 0,
      bpjs_jkk_charged: 0,
      bpjs_jkm_charged: 0,
      potongan_lain: 0,
    }
    expect(isDecemberInput(input)).toBe(false)
  })

  test("Non-December → false", () => {
    const input = {
      month: 5,
      ptkp_status: "TK/0" as const,
      gaji_pokok: 8_000_000,
      tunjangan_tetap: 0,
      tunjangan_tidak_tetap: 0,
      pph21_charged: 0,
      bpjs_kesehatan_charged: 0,
      bpjs_jht_charged: 0,
      bpjs_jp_charged: 0,
      bpjs_jkk_charged: 0,
      bpjs_jkm_charged: 0,
      potongan_lain: 0,
    }
    expect(isDecemberInput(input)).toBe(false)
  })
})
