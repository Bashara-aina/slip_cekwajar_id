import OpenAI from "openai";
import type { OcrExtractedData } from "@/types/slip";

/** OCR uses OpenRouter (OpenAI-compatible client), not Anthropic SDK. */
const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY
});

const SYSTEM_PROMPT =
  "You are an expert Indonesian payroll document parser. Extract all salary and deduction data from this slip gaji (payslip) image. Return ONLY valid JSON, no explanation. If a field is unclear or missing, set value to null and confidence to 0. Confidence scale: 0.0-1.0";

const USER_PROMPT_TEMPLATE = `Return JSON exactly in this structure:
{
  "period": "YYYY-MM",
  "gaji_pokok": number | null,
  "tunjangan_tetap": number | null,
  "tunjangan_tidak_tetap": number | null,
  "tunjangan_makan": number | null,
  "tunjangan_transport": number | null,
  "uang_lembur": number | null,
  "pph21": number | null,
  "bpjs_kesehatan": number | null,
  "bpjs_jht": number | null,
  "bpjs_jp": number | null,
  "bpjs_jkk": number | null,
  "bpjs_jkm": number | null,
  "potongan_lain": number | null,
  "gaji_bersih": number | null,
  "confidence": {
    "gaji_pokok": 0.0-1.0,
    "pph21": 0.0-1.0,
    "bpjs_kesehatan": 0.0-1.0,
    "bpjs_jht": 0.0-1.0,
    "bpjs_jp": 0.0-1.0
  }
}`;

function defaultOcrResult(): OcrExtractedData {
  return {
    period: null,
    gaji_pokok: null,
    tunjangan_tetap: null,
    tunjangan_tidak_tetap: null,
    tunjangan_makan: null,
    tunjangan_transport: null,
    uang_lembur: null,
    pph21: null,
    bpjs_kesehatan: null,
    bpjs_jht: null,
    bpjs_jp: null,
    bpjs_jkk: null,
    bpjs_jkm: null,
    potongan_lain: null,
    gaji_bersih: null,
    confidence: {
      gaji_pokok: 0,
      pph21: 0,
      bpjs_kesehatan: 0,
      bpjs_jht: 0,
      bpjs_jp: 0
    },
    low_confidence_fields: ["gaji_pokok", "pph21", "bpjs_kesehatan", "bpjs_jht", "bpjs_jp"],
    all_low_confidence: true,
    raw_text: null
  };
}

function sanitizeModelResult(parsed: unknown): OcrExtractedData {
  const base = defaultOcrResult();
  if (!parsed || typeof parsed !== "object") return base;
  const data = parsed as Record<string, unknown>;
  const out: OcrExtractedData = {
    ...base,
    period: typeof data.period === "string" ? data.period : null,
    gaji_pokok: typeof data.gaji_pokok === "number" ? data.gaji_pokok : null,
    tunjangan_tetap: typeof data.tunjangan_tetap === "number" ? data.tunjangan_tetap : null,
    tunjangan_tidak_tetap:
      typeof data.tunjangan_tidak_tetap === "number" ? data.tunjangan_tidak_tetap : null,
    tunjangan_makan: typeof data.tunjangan_makan === "number" ? data.tunjangan_makan : null,
    tunjangan_transport: typeof data.tunjangan_transport === "number" ? data.tunjangan_transport : null,
    uang_lembur: typeof data.uang_lembur === "number" ? data.uang_lembur : null,
    pph21: typeof data.pph21 === "number" ? data.pph21 : null,
    bpjs_kesehatan: typeof data.bpjs_kesehatan === "number" ? data.bpjs_kesehatan : null,
    bpjs_jht: typeof data.bpjs_jht === "number" ? data.bpjs_jht : null,
    bpjs_jp: typeof data.bpjs_jp === "number" ? data.bpjs_jp : null,
    bpjs_jkk: typeof data.bpjs_jkk === "number" ? data.bpjs_jkk : null,
    bpjs_jkm: typeof data.bpjs_jkm === "number" ? data.bpjs_jkm : null,
    potongan_lain: typeof data.potongan_lain === "number" ? data.potongan_lain : null,
    gaji_bersih: typeof data.gaji_bersih === "number" ? data.gaji_bersih : null
  };

  const c = data.confidence as Record<string, unknown> | undefined;
  if (c) {
    out.confidence = {
      gaji_pokok: typeof c.gaji_pokok === "number" ? c.gaji_pokok : 0,
      pph21: typeof c.pph21 === "number" ? c.pph21 : 0,
      bpjs_kesehatan: typeof c.bpjs_kesehatan === "number" ? c.bpjs_kesehatan : 0,
      bpjs_jht: typeof c.bpjs_jht === "number" ? c.bpjs_jht : 0,
      bpjs_jp: typeof c.bpjs_jp === "number" ? c.bpjs_jp : 0
    };
  }

  out.low_confidence_fields = Object.entries(out.confidence)
    .filter(([, value]) => value < 0.8)
    .map(([key]) => key);
  out.all_low_confidence = out.low_confidence_fields.length === Object.keys(out.confidence).length;
  return out;
}

/**
 * Extract slip gaji data from a base64-encoded image using OpenRouter (Claude).
 * Never throws; returns partial/default result on error or unreadable image.
 */
export async function extractSlipData(
  imageBase64: string,
  mimeType: string
): Promise<OcrExtractedData> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return defaultOcrResult();

  const dataUrl = `data:${mimeType};base64,${imageBase64}`;

  try {
    const completion = await client.chat.completions.create({
      model: "anthropic/claude-3.5-sonnet",
      max_tokens: 1200,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        {
          role: "user",
          content: [
            { type: "text", text: USER_PROMPT_TEMPLATE },
            {
              type: "image_url",
              image_url: { url: dataUrl }
            }
          ]
        }
      ]
    });

    const text = completion.choices?.[0]?.message?.content ?? null;
    if (!text) return defaultOcrResult();

    try {
      const parsed = JSON.parse(text) as unknown;
      const normalized = sanitizeModelResult(parsed);
      normalized.raw_text = text;
      return normalized;
    } catch {
      return {
        ...defaultOcrResult(),
        raw_text: text
      };
    }
  } catch {
    return defaultOcrResult();
  }
}
