"use client"

import { useRef, useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { motion, AnimatePresence } from "framer-motion"
import { Sun, Moon, ChevronLeft, ChevronRight, Loader2, Info, ChevronDown } from "lucide-react"

import { CurrencyInput } from "@/components/CurrencyInput"
import { PTKPSelector } from "@/components/PTKPSelector"
import { MonthPicker } from "@/components/MonthPicker"
import { VerdictCard } from "@/components/VerdictCard"
import { useDarkMode } from "@/hooks/useDarkMode"
import { calculateSlip, validateSlipInput, type SlipResult, type PTKPStatus } from "@/lib/pph21-ter"

// ─── Zod schema (Zod v4 — no required_error, no .default()) ──────────────────
const schema = z.object({
  month: z.number().int().min(1, "Pilih bulan").max(12),
  ptkp_status: z.string().min(1, "Pilih status PTKP"),
  gaji_pokok: z.number().min(1, "Masukkan gaji pokok"),
  tunjangan_tetap: z.number().min(0),
  tunjangan_tidak_tetap: z.number().min(0),
  pph21_charged: z.number().min(0),
  bpjs_kesehatan_charged: z.number().min(0),
  bpjs_jht_charged: z.number().min(0),
  bpjs_jp_charged: z.number().min(0),
  bpjs_jkk_charged: z.number().min(0),
  bpjs_jkm_charged: z.number().min(0),
  potongan_lain: z.number().min(0),
})

type FormValues = z.infer<typeof schema>

const DEFAULT_VALUES: Partial<FormValues> = {
  month: new Date().getMonth() + 1,
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
}

// ─── Step slide animation ─────────────────────────────────────────────────────
const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? "60%" : "-60%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? "-60%" : "60%", opacity: 0 }),
}

// ─── Tooltip helper ───────────────────────────────────────────────────────────
function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-text-muted hover:text-brand-primary"
        aria-label="Info"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 4 }}
            className="absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-xl dark:bg-slate-700"
          >
            {text}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  )
}

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-700">
      <span className="text-base" aria-hidden="true">{icon}</span>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted dark:text-slate-400">
        {title}
      </h3>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SlipPage() {
  const { isDark, toggle: toggleDark } = useDarkMode()
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1)
  const [result, setResult] = useState<SlipResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showOptional, setShowOptional] = useState(false)
  const [formErrors, setFormErrors] = useState<string[]>([])
  const resultRef = useRef<HTMLDivElement>(null)

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
    trigger,
  } = useForm<FormValues, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULT_VALUES,
    mode: "onBlur",
  })

  // Live warning: total deductions > gross
  const watchedValues = watch([
    "gaji_pokok", "tunjangan_tetap", "tunjangan_tidak_tetap",
    "pph21_charged", "bpjs_kesehatan_charged", "bpjs_jht_charged",
    "bpjs_jp_charged", "bpjs_jkk_charged", "bpjs_jkm_charged", "potongan_lain",
  ])
  const totalGross = (watchedValues[0] || 0) + (watchedValues[1] || 0) + (watchedValues[2] || 0)
  const totalDeductions =
    (watchedValues[3] || 0) +
    (watchedValues[4] || 0) +
    (watchedValues[5] || 0) +
    (watchedValues[6] || 0) +
    (watchedValues[7] || 0) +
    (watchedValues[8] || 0) +
    (watchedValues[9] || 0)
  const showOverWarning = step === 2 && totalGross > 0 && totalDeductions > totalGross

  const goToStep2 = async () => {
    const valid = await trigger(["month", "ptkp_status"])
    if (!valid) return
    setFormErrors([])
    setDirection(1)
    setStep(2)
  }

  const goToStep1 = () => {
    setDirection(-1)
    setStep(1)
  }

  const onSubmit = handleSubmit(async (data) => {
    const slipInput = {
      ...data,
      ptkp_status: data.ptkp_status as PTKPStatus,
    }
    const validationErrors = validateSlipInput(slipInput)
    if (validationErrors.length > 0) {
      setFormErrors(validationErrors)
      return
    }
    setFormErrors([])
    setSubmitting(true)
    await new Promise((r) => setTimeout(r, 600))
    const res = calculateSlip(slipInput)
    setResult(res)
    setSubmitting(false)
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100)
  })

  const handleReset = () => {
    setResult(null)
    setFormErrors([])
    reset(DEFAULT_VALUES)
    setStep(1)
    setDirection(-1)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-slate-900">
      {/* ── Sticky header ─────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <a href="/" className="flex items-baseline gap-0.5">
            <span className="text-xl font-black tracking-tight text-brand-primary">💼 wajar</span>
            <span className="text-xl font-black tracking-tight text-brand-accent">slip</span>
          </a>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-text-muted sm:block">
              PPh21 + BPJS Calculator
            </span>
            <button
              type="button"
              onClick={toggleDark}
              aria-label={isDark ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6 pb-32">
        {/* ── Hero ──────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6 rounded-2xl bg-gradient-to-br from-blue-50 to-emerald-50 p-6 dark:from-blue-950/50 dark:to-emerald-950/50"
        >
          <h1 className="mb-2 text-[28px] font-bold leading-tight tracking-tight text-text-primary dark:text-slate-100">
            Potongan gaji lo bener gak? 🤔
          </h1>
          <p className="mb-4 text-sm leading-relaxed text-text-muted dark:text-slate-400">
            Cek PPh 21 TER + BPJS sesuai regulasi 2024 dalam 30 detik.
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { icon: "✅", text: "Data Resmi DJP" },
              { icon: "🔒", text: "Tidak Disimpan" },
              { icon: "⚡", text: "Real-time" },
            ].map((b) => (
              <span
                key={b.text}
                className="inline-flex items-center gap-1 rounded-full border border-white/80 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur-sm dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-slate-300"
              >
                <span>{b.icon}</span> {b.text}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">
            Berdasarkan PMK 168/2023 (TER) &amp; PP 44/2015 (BPJS)
          </p>
        </motion.section>

        {/* ── Form Card ─────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
            >
                <form onSubmit={onSubmit} noValidate>
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card dark:border-slate-700 dark:bg-slate-800">
                  {/* Step indicator */}
                  <div className="flex items-center gap-0 border-b border-slate-100 dark:border-slate-700">
                    {[
                      { n: 1, label: "Info Karyawan" },
                      { n: 2, label: "Penghasilan & Potongan" },
                    ].map(({ n, label }) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => n === 1 ? goToStep1() : goToStep2()}
                        className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 text-xs font-semibold transition-colors ${
                          step === n
                            ? "border-b-2 border-brand-primary text-brand-primary"
                            : "text-text-muted hover:text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                            step === n
                              ? "bg-brand-primary text-white"
                              : step > n
                              ? "bg-brand-accent text-white"
                              : "bg-slate-200 text-slate-500 dark:bg-slate-600"
                          }`}
                        >
                          {step > n ? "✓" : n}
                        </span>
                        <span className="hidden sm:inline">{label}</span>
                        <span className="sm:hidden">Step {n}</span>
                      </button>
                    ))}
                  </div>

                  {/* Steps */}
                  <div className="relative overflow-hidden">
                    <AnimatePresence initial={false} custom={direction} mode="wait">
                      {step === 1 ? (
                        <motion.div
                          key="step1"
                          custom={direction}
                          variants={slideVariants}
                          initial="enter"
                          animate="center"
                          exit="exit"
                          transition={{ type: "tween", duration: 0.28, ease: "easeInOut" }}
                          className="space-y-6 p-5"
                        >
                          <Controller
                            control={control}
                            name="month"
                            render={({ field }) => (
                              <MonthPicker
                                value={field.value ?? 0}
                                onChange={field.onChange}
                                error={errors.month?.message}
                              />
                            )}
                          />

                          <Controller
                            control={control}
                            name="ptkp_status"
                            render={({ field }) => (
                              <PTKPSelector
                                value={(field.value as PTKPStatus) || ""}
                                onChange={field.onChange}
                                error={errors.ptkp_status?.message}
                              />
                            )}
                          />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="step2"
                          custom={direction}
                          variants={slideVariants}
                          initial="enter"
                          animate="center"
                          exit="exit"
                          transition={{ type: "tween", duration: 0.28, ease: "easeInOut" }}
                          className="space-y-5 p-5"
                        >
                          {/* Over-deduction warning */}
                          <AnimatePresence>
                            {showOverWarning && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                                  ⚠️ Hmm, potongan lebih besar dari gaji. Cek kembali ya.
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Section A: Penghasilan */}
                          <div className="space-y-3">
                            <SectionLabel icon="💰" title="Penghasilan Kotor" />

                            <Controller
                              control={control}
                              name="gaji_pokok"
                              render={({ field }) => (
                                <CurrencyInput
                                  label="Gaji Pokok"
                                  required
                                  value={field.value ?? 0}
                                  onChange={field.onChange}
                                  error={errors.gaji_pokok?.message}
                                />
                              )}
                            />
                            <Controller
                              control={control}
                              name="tunjangan_tetap"
                              render={({ field }) => (
                                <CurrencyInput
                                  label="Tunjangan Tetap"
                                  optional
                                  value={field.value ?? 0}
                                  onChange={field.onChange}
                                />
                              )}
                            />
                            <Controller
                              control={control}
                              name="tunjangan_tidak_tetap"
                              render={({ field }) => (
                                <CurrencyInput
                                  label="Tunjangan Tidak Tetap"
                                  optional
                                  value={field.value ?? 0}
                                  onChange={field.onChange}
                                />
                              )}
                            />
                          </div>

                          {/* Section B: Potongan */}
                          <div className="space-y-3">
                            <SectionLabel icon="✂️" title="Potongan di Slip" />

                            <div className="flex items-center gap-1.5">
                              <Controller
                                control={control}
                                name="pph21_charged"
                                render={({ field }) => (
                                  <CurrencyInput
                                    label="PPh 21 Dipotong"
                                    required
                                    value={field.value ?? 0}
                                    onChange={field.onChange}
                                    error={errors.pph21_charged?.message}
                                    hint="PPh 21 yang tertera di slip, bukan pajak tahunan"
                                    className="flex-1"
                                  />
                                )}
                              />
                              <div className="mt-5">
                                <Tooltip text="ℹ️ Ini adalah PPh 21 yang tertera di slip gaji, bukan pajak penghasilan tahunan." />
                              </div>
                            </div>

                            <div className="rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                              💡 BPJS Kesehatan = 1% gaji (maks bruto Rp 12jt). JHT karyawan = 2%.
                            </div>

                            <Controller
                              control={control}
                              name="bpjs_kesehatan_charged"
                              render={({ field }) => (
                                <CurrencyInput
                                  label="BPJS Kesehatan Dipotong"
                                  required
                                  value={field.value ?? 0}
                                  onChange={field.onChange}
                                  error={errors.bpjs_kesehatan_charged?.message}
                                />
                              )}
                            />
                            <Controller
                              control={control}
                              name="bpjs_jht_charged"
                              render={({ field }) => (
                                <CurrencyInput
                                  label="BPJS JHT Dipotong"
                                  required
                                  value={field.value ?? 0}
                                  onChange={field.onChange}
                                  error={errors.bpjs_jht_charged?.message}
                                />
                              )}
                            />
                            <Controller
                              control={control}
                              name="bpjs_jp_charged"
                              render={({ field }) => (
                                <CurrencyInput
                                  label="BPJS JP Dipotong"
                                  required
                                  value={field.value ?? 0}
                                  onChange={field.onChange}
                                  error={errors.bpjs_jp_charged?.message}
                                />
                              )}
                            />

                            {/* Optional fields toggle */}
                            <button
                              type="button"
                              onClick={() => setShowOptional((v) => !v)}
                              className="flex w-full items-center justify-between rounded-xl border border-dashed border-slate-200 px-3 py-2.5 text-xs font-medium text-text-muted transition-colors hover:border-slate-300 hover:text-slate-600 dark:border-slate-600 dark:text-slate-400"
                            >
                              <span>
                                {showOptional ? "Sembunyikan" : "Tampilkan"} kolom opsional (JKK, JKM, Potongan Lain)
                              </span>
                              <ChevronDown
                                className={`h-4 w-4 transition-transform ${showOptional ? "rotate-180" : ""}`}
                              />
                            </button>

                            <AnimatePresence>
                              {showOptional && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="space-y-3 pt-1">
                                    <div className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400">
                                      🚫 JKK &amp; JKM adalah tanggungan pemberi kerja. Jika dipotong dari kamu, itu ilegal.
                                    </div>
                                    <Controller
                                      control={control}
                                      name="bpjs_jkk_charged"
                                      render={({ field }) => (
                                        <CurrencyInput
                                          label="BPJS JKK Dipotong"
                                          optional
                                          value={field.value ?? 0}
                                          onChange={field.onChange}
                                        />
                                      )}
                                    />
                                    <Controller
                                      control={control}
                                      name="bpjs_jkm_charged"
                                      render={({ field }) => (
                                        <CurrencyInput
                                          label="BPJS JKM Dipotong"
                                          optional
                                          value={field.value ?? 0}
                                          onChange={field.onChange}
                                        />
                                      )}
                                    />
                                    <Controller
                                      control={control}
                                      name="potongan_lain"
                                      render={({ field }) => (
                                        <CurrencyInput
                                          label="Potongan Lain-lain"
                                          optional
                                          value={field.value ?? 0}
                                          onChange={field.onChange}
                                          hint="Cicilan, koperasi, dll"
                                        />
                                      )}
                                    />
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Privacy note */}
                <p className="mt-3 text-center text-xs text-text-muted dark:text-slate-500">
                  🔒 Tidak ada data yang dikirim ke server kami saat kamu mengisi form ini.
                </p>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              ref={resultRef}
            >
              <VerdictCard result={result} onReset={handleReset} resultRef={resultRef} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── Sticky bottom CTA ─────────────────────────────────── */}
      <AnimatePresence>
        {!result && (
          <motion.div
            key="cta"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-100 bg-white/95 px-4 pb-safe pt-3 shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95"
          >
            <div className="mx-auto max-w-lg">
              {step === 1 ? (
                <motion.button
                  type="button"
                  onClick={goToStep2}
                  whileTap={{ scale: 0.97 }}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-brand-primary text-base font-semibold text-white shadow-md transition-colors hover:bg-blue-700 active:bg-blue-800"
                >
                  Lanjut <ChevronRight className="h-5 w-5" />
                </motion.button>
              ) : (
                <div className="flex gap-3">
                  <motion.button
                    type="button"
                    onClick={goToStep1}
                    whileTap={{ scale: 0.97 }}
                    className="flex h-14 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 font-semibold text-slate-600 shadow-card transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={onSubmit}
                    disabled={submitting}
                    whileTap={{ scale: 0.97 }}
                    className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-primary text-base font-semibold text-white shadow-md transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:opacity-80"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                        Menghitung...
                      </>
                    ) : (
                      "Cek Sekarang →"
                    )}
                  </motion.button>
                </div>
              )}
              {formErrors.length > 0 && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950/40">
                  {formErrors.map((e, i) => (
                    <p key={i} className="text-sm text-red-700 dark:text-red-300">
                      ⚠️ {e}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
