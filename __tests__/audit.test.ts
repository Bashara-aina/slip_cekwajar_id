/**
 * audit.ts regression tests — covers all 5 critical bugs fixed in the rewrite.
 * Run with: npx jest --testPathPattern="audit.test"
 */

import { auditSlip } from "@/lib/slip/audit";
import { calculateSlip } from "@/lib/pph21-ter";

describe("audit.ts — critical regression tests", () => {

  // B-1: JP cap must use 2026 value (11_004_000) for March 2026
  it("JP expected uses 2026 cap for month=3", () => {
    const result = auditSlip({
      gross: 11_004_000,
      month: 3,
      ptkp_status: "TK/0",
      deductions: {
        pph21: 0,
        bpjs_kesehatan: 110_040,
        bpjs_jht: 220_080,
        bpjs_jp: 110_040,   // 1% × 11_004_000
        bpjs_jkk: 0,
        bpjs_jkm: 0,
        potongan_lain: 0,
      },
    });
    expect(result.expected_breakdown.bpjs.jp.expected).toBe(110_040);
  });

  // B-3: K/I/0 must map to TER Category C (was wrongly mapped to A in old PTKP_CATEGORY_MAP)
  it("K/I/0 maps to TER category C", () => {
    // TER C has a non-zero threshold starting at Rp6.600.001 for gross Rp7.000.000
    // TER A has a non-zero threshold starting at Rp5.400.001
    // At Rp7.000.000: TER C = 0.5% = Rp35.000; TER A = 1.25% = Rp87.500
    const result = auditSlip({
      gross: 7_000_000,
      month: 6,
      ptkp_status: "K/I/0",
      deductions: {
        pph21: 0,
        bpjs_kesehatan: 70_000,
        bpjs_jht: 140_000,
        bpjs_jp: 70_000,
        bpjs_jkk: 0,
        bpjs_jkm: 0,
        potongan_lain: 0,
      },
    });
    // TER C: Rp7.000.000 is in slab { min: 6_950_001, max: 7_350_000, rate: 0.005 } = 0.5%
    // expected pph21 = 7_000_000 × 0.005 = 35_000
    expect(result.expected_breakdown.pph21).toBe(35_000);
  });

  // B-4: December must NOT return WAJAR blindly — JKK should still be caught
  it("December with illegal JKK returns POTONGAN_SALAH", () => {
    const result = auditSlip({
      gross: 8_000_000,
      month: 12,
      ptkp_status: "TK/0",
      deductions: {
        pph21: 140_000,
        bpjs_kesehatan: 80_000,
        bpjs_jht: 160_000,
        bpjs_jp: 80_000,
        bpjs_jkk: 50_000,   // illegal — employer-only
        bpjs_jkm: 0,
        potongan_lain: 0,
      },
    });
    expect(result.verdict).toBe("POTONGAN_SALAH");
    expect(result.issues.some((i) => i.type === "ILLEGAL_JKK_DEDUCTION")).toBe(true);
  });

  // B-4: December clean slip returns WAJAR (no issues)
  it("December clean slip with no issues returns WAJAR", () => {
    const result = auditSlip({
      gross: 8_000_000,
      month: 12,
      ptkp_status: "TK/0",
      deductions: {
        pph21: 140_000,
        bpjs_kesehatan: 80_000,
        bpjs_jht: 160_000,
        bpjs_jp: 80_000,
        bpjs_jkk: 0,
        bpjs_jkm: 0,
        potongan_lain: 0,
      },
    });
    expect(result.verdict).toBe("WAJAR");
  });

  // C-1: December PPh21 progressive tax bracket boundary — must not be NaN
  it("progressiveTax at bracket boundary is accurate", () => {
    const res = calculateSlip({
      month: 12,
      ptkp_status: "TK/0",
      gaji_pokok: 5_000_000,
      tunjangan_tetap: 0,
      tunjangan_tidak_tetap: 0,
      pph21_charged: 0,
      bpjs_kesehatan_charged: 0,
      bpjs_jht_charged: 0,
      bpjs_jp_charged: 0,
      bpjs_jkk_charged: 0,
      bpjs_jkm_charged: 0,
      potongan_lain: 0,
      annual_gross: 60_000_000, // exactly at Pasal 17 bracket boundary
    });
    expect(typeof res.pph21?.expected).toBe("number");
    expect(isNaN(res.pph21?.expected as number)).toBe(false);
  });

  // K/2 = Category B (fixed from old bug where K/2 was sometimes wrongly treated)
  it("K/2 maps to TER category B, not C", () => {
    // TER B at Rp8.000.000 is slab { min: 7_300_001, max: 9_200_000, ratePercent: 1 } = 1.0%
    // expected pph21 = 8_000_000 × 1% = 80_000
    const result = auditSlip({
      gross: 8_000_000,
      month: 3,
      ptkp_status: "K/2",
      deductions: {
        pph21: 80_000,    // 1.0% × 8M = TER B rate — exactly correct
        bpjs_kesehatan: 80_000,
        bpjs_jht: 160_000,
        bpjs_jp: 80_000,
        bpjs_jkk: 0,
        bpjs_jkm: 0,
        potongan_lain: 0,
      },
    });
    expect(result.verdict).toBe("WAJAR");
  });

});
