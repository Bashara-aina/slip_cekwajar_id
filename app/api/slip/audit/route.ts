import { NextRequest, NextResponse } from "next/server";
import { auditSlip } from "@/lib/slip/audit";
import type { AuditInput, PTKPStatus } from "@/types/slip";

export const runtime = "nodejs";

const MAX_REQUESTS_PER_HOUR = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000;

type RateBucket = {
  count: number;
  resetAt: number;
};

const rateStore = globalThis as typeof globalThis & {
  __wajarRateStore?: Map<string, RateBucket>;
};

if (!rateStore.__wajarRateStore) {
  rateStore.__wajarRateStore = new Map<string, RateBucket>();
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSec: number } {
  const store = rateStore.__wajarRateStore!;
  const now = Date.now();
  const existing = store.get(ip);
  if (!existing || now > existing.resetAt) {
    store.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { allowed: true, retryAfterSec: Math.ceil(RATE_WINDOW_MS / 1000) };
  }

  if (existing.count >= MAX_REQUESTS_PER_HOUR) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
    };
  }

  existing.count += 1;
  store.set(ip, existing);
  return {
    allowed: true,
    retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
  };
}

function parseJwtUserId(authorizationHeader: string | null): string | null {
  if (!authorizationHeader?.startsWith("Bearer ")) return null;
  const token = authorizationHeader.slice("Bearer ".length);
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      sub?: string;
    };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

function isPTKPStatus(value: string): value is PTKPStatus {
  return [
    "TK/0",
    "TK/1",
    "TK/2",
    "TK/3",
    "K/0",
    "K/1",
    "K/2",
    "K/3",
    "K/I/0",
    "K/I/1",
    "K/I/2",
    "K/I/3"
  ].includes(value);
}

function asNonNegativeNumber(input: unknown): number | null {
  if (typeof input !== "number" || !Number.isFinite(input) || input < 0) return null;
  return Math.round(input);
}

function validateAuditInput(input: unknown): { ok: true; value: AuditInput } | { ok: false; reason: string } {
  if (!input || typeof input !== "object") {
    return { ok: false, reason: "Invalid body" };
  }

  const raw = input as Record<string, unknown>;
  const deductions = raw.deductions as Record<string, unknown> | undefined;
  if (!deductions || typeof deductions !== "object") {
    return { ok: false, reason: "Missing deductions" };
  }

  const gross = asNonNegativeNumber(raw.gross);
  const month = asNonNegativeNumber(raw.month);
  const pph21 = asNonNegativeNumber(deductions.pph21);
  const bpjsKesehatan = asNonNegativeNumber(deductions.bpjs_kesehatan);
  const bpjsJht = asNonNegativeNumber(deductions.bpjs_jht);
  const bpjsJp = asNonNegativeNumber(deductions.bpjs_jp);
  const bpjsJkk = asNonNegativeNumber(deductions.bpjs_jkk);
  const bpjsJkm = asNonNegativeNumber(deductions.bpjs_jkm);
  const potonganLain = asNonNegativeNumber(deductions.potongan_lain);

  if (
    gross === null ||
    month === null ||
    pph21 === null ||
    bpjsKesehatan === null ||
    bpjsJht === null ||
    bpjsJp === null ||
    bpjsJkk === null ||
    bpjsJkm === null ||
    potonganLain === null
  ) {
    return { ok: false, reason: "All numeric fields must be non-negative numbers" };
  }

  if (month < 1 || month > 12) {
    return { ok: false, reason: "month must be between 1 and 12" };
  }

  if (typeof raw.ptkp_status !== "string" || !isPTKPStatus(raw.ptkp_status)) {
    return { ok: false, reason: "Invalid ptkp_status" };
  }

  return {
    ok: true,
    value: {
      gross,
      month,
      ptkp_status: raw.ptkp_status,
      deductions: {
        pph21,
        bpjs_kesehatan: bpjsKesehatan,
        bpjs_jht: bpjsJht,
        bpjs_jp: bpjsJp,
        bpjs_jkk: bpjsJkk,
        bpjs_jkm: bpjsJkm,
        potongan_lain: potonganLain
      }
    }
  };
}

async function insertAuditRow(params: {
  userId: string | null;
  input: AuditInput;
  result: ReturnType<typeof auditSlip>;
}): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;

  const period = `${new Date().getFullYear()}-${String(params.input.month).padStart(2, "0")}`;
  const body = {
    user_id: params.userId,
    anonymous: !params.userId,
    period,
    gaji_pokok: params.input.gross,
    tunjangan_tetap: 0,
    tunjangan_tidak_tetap: 0,
    ptkp_status: params.input.ptkp_status,
    pph21_charged: params.input.deductions.pph21,
    pph21_expected: params.result.expected_breakdown.pph21,
    bpjs_kesehatan_charged: params.input.deductions.bpjs_kesehatan,
    bpjs_kesehatan_expected: params.result.expected_breakdown.bpjs.kesehatan.expected,
    bpjs_tk_charged: params.input.deductions.bpjs_jht + params.input.deductions.bpjs_jp,
    bpjs_tk_expected:
      params.result.expected_breakdown.bpjs.jht.expected + params.result.expected_breakdown.bpjs.jp.expected,
    illegal_deductions: params.input.deductions.bpjs_jkk + params.input.deductions.bpjs_jkm,
    total_potongan_charged:
      params.input.deductions.pph21 +
      params.input.deductions.bpjs_kesehatan +
      params.input.deductions.bpjs_jht +
      params.input.deductions.bpjs_jp +
      params.input.deductions.bpjs_jkk +
      params.input.deductions.bpjs_jkm +
      params.input.deductions.potongan_lain,
    gaji_bersih:
      params.input.gross -
      (params.input.deductions.pph21 +
        params.input.deductions.bpjs_kesehatan +
        params.input.deductions.bpjs_jht +
        params.input.deductions.bpjs_jp +
        params.input.deductions.bpjs_jkk +
        params.input.deductions.bpjs_jkm +
        params.input.deductions.potongan_lain),
    verdict: params.result.verdict,
    discrepancy_amount: params.result.discrepancy_rp,
    issues: params.result.issues,
    premium_unlocked: false
  };

  const response = await fetch(`${supabaseUrl}/rest/v1/slip_audits`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  if (!response.ok) return null;
  const data = (await response.json()) as Array<{ id?: string }>;
  return data[0]?.id ?? null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);
  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validated = validateAuditInput(payload);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.reason }, { status: 400 });
  }

  const result = auditSlip(validated.value);
  const userId = parseJwtUserId(req.headers.get("authorization"));
  const auditId = await insertAuditRow({ userId, input: validated.value, result });

  return NextResponse.json(
    {
      audit_id: auditId,
      ...result
    },
    { status: 200 }
  );
}
