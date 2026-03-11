import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { extractSlipData } from "@/lib/slip/ocr";
import type { OcrExtractedData } from "@/types/slip";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);

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

function pickExt(contentType: string): string {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  return "pdf";
}

async function uploadToSupabaseStorage(file: File, path: string): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;

  const arrayBuffer = await file.arrayBuffer();
  const response = await fetch(`${supabaseUrl}/storage/v1/object/slip-images/${path}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": file.type,
      "x-upsert": "false",
      "x-metadata": JSON.stringify({
        delete_after: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })
    },
    body: arrayBuffer,
    cache: "no-store"
  });

  if (!response.ok) return null;
  return `${supabaseUrl}/storage/v1/object/public/slip-images/${path}`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "image file is required" }, { status: 400 });
    }

    if (!ACCEPTED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Only JPEG, PNG, and PDF are allowed" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File exceeds 5MB maximum size" }, { status: 400 });
    }

    const ext = pickExt(file.type);
    const path = `${randomUUID()}.${ext}`;
    const storageUrl = await uploadToSupabaseStorage(file, path);
    const base64Data = Buffer.from(await file.arrayBuffer()).toString("base64");
    const ocr = await extractSlipData(base64Data, file.type);

    return NextResponse.json(
      {
        ...ocr,
        image_url: storageUrl
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(defaultOcrResult(), { status: 200 });
  }
}
