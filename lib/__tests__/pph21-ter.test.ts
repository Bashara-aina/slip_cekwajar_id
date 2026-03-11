/**
 * PPh 21 TER and BPJS calculation tests.
 * Known correct values from DJP / regulation examples.
 */

import {
  getTERCategory,
  getTERRate,
  getJpCap,
  calculateAll,
} from "../pph21-ter"

describe("PPh21 TER Calculation", () => {
  test("TK/0, gaji Rp9jt → TER Cat A, rate 1.75%", () => {
    const rate = getTERRate("A", 9_000_000)
    expect(rate).toBe(0.0175)
  })

  test("K/2, gaji Rp10jt → TER Cat B (not C)", () => {
    expect(getTERCategory("K/2")).toBe("B")
  })

  test("BPJS Kesehatan capped at Rp120.000 for high salary", () => {
    const result = calculateAll({
      month: 3,
      ptkp_status: "TK/0",
      gaji_pokok: 50_000_000,
      tunjangan_tetap: 0,
      tunjangan_tidak_tetap: 0,
      pph21_charged: 0,
      bpjs_kesehatan_charged: 120_000,
      bpjs_jht_charged: 0,
      bpjs_jp_charged: 0,
      bpjs_jkk_charged: 0,
      bpjs_jkm_charged: 0,
      potongan_lain: 0,
    })
    expect(result.bpjsKesehatan.expected).toBe(120_000)
  })

  test("JP cap uses March boundary correctly", () => {
    const capFeb = getJpCap(2025, 2)
    expect(capFeb).toBe(10_042_300)
    const capMar = getJpCap(2025, 3)
    expect(capMar).toBe(10_547_400)
  })

  test("JKK charged to employee = TIDAK_WAJAR", () => {
    const result = calculateAll({
      month: 5,
      ptkp_status: "TK/0",
      gaji_pokok: 8_000_000,
      tunjangan_tetap: 0,
      tunjangan_tidak_tetap: 0,
      pph21_charged: 140_000,
      bpjs_kesehatan_charged: 80_000,
      bpjs_jht_charged: 160_000,
      bpjs_jp_charged: 80_000,
      bpjs_jkk_charged: 50_000,
      bpjs_jkm_charged: 0,
      potongan_lain: 0,
    })
    expect(result.jkk.verdict).toBe("TIDAK_WAJAR")
    expect(result.overallVerdict).toBe("TIDAK_WAJAR")
  })

  test("DJP example: TK/0, Rp5jt → TER rate 0%", () => {
    const rate = getTERRate("A", 5_000_000)
    expect(rate).toBe(0)
  })
})
