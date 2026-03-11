import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type MidtransNotification = {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  signature_key?: string;
  transaction_status?: string;
  fraud_status?: string;
};

type PremiumUnlockRow = {
  id: string;
  status: string;
  audit_id: string | null;
};

function sha512(input: string): string {
  return createHash("sha512").update(input).digest("hex");
}

function isValidMidtransSignature(payload: MidtransNotification, serverKey: string): boolean {
  if (!payload.order_id || !payload.status_code || !payload.gross_amount || !payload.signature_key) {
    return false;
  }
  const expected = sha512(`${payload.order_id}${payload.status_code}${payload.gross_amount}${serverKey}`);
  return expected === payload.signature_key;
}

async function getUnlockByMidtransId(orderId: string): Promise<PremiumUnlockRow | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;

  const response = await fetch(
    `${supabaseUrl}/rest/v1/premium_unlocks?midtrans_payment_id=eq.${encodeURIComponent(
      orderId
    )}&select=id,status,audit_id&limit=1`,
    {
      method: "GET",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`
      },
      cache: "no-store"
    }
  );

  if (!response.ok) return null;
  const rows = (await response.json()) as PremiumUnlockRow[];
  return rows[0] ?? null;
}

async function markUnlockSuccess(id: string): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return;

  await fetch(`${supabaseUrl}/rest/v1/premium_unlocks?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({ status: "success" }),
    cache: "no-store"
  });
}

async function markAuditPremiumUnlocked(auditId: string): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return;

  await fetch(`${supabaseUrl}/rest/v1/slip_audits?id=eq.${auditId}`, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({ premium_unlocked: true }),
    cache: "no-store"
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  let payload: MidtransNotification;
  try {
    payload = (await req.json()) as MidtransNotification;
  } catch {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (!isValidMidtransSignature(payload, serverKey)) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (payload.status_code !== "200" || !payload.order_id) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const unlock = await getUnlockByMidtransId(payload.order_id);
  if (!unlock) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (unlock.status !== "success") {
    await markUnlockSuccess(unlock.id);
    if (unlock.audit_id) {
      await markAuditPremiumUnlocked(unlock.audit_id);
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
