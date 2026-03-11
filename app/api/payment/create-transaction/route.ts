import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type CreatePaymentBody = {
  audit_id: string;
  user_id?: string;
};

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

function getMidtransBaseUrl(): string {
  return process.env.MIDTRANS_SANDBOX === "true"
    ? "https://app.sandbox.midtrans.com/snap/v1/transactions"
    : "https://app.midtrans.com/snap/v1/transactions";
}

function basicAuthServerKey(serverKey: string): string {
  return `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`;
}

async function insertPendingUnlock(data: {
  userId: string | null;
  auditId: string;
  midtransPaymentId: string;
  amount: number;
}): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return;

  await fetch(`${supabaseUrl}/rest/v1/premium_unlocks`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      user_id: data.userId,
      tool: "slip",
      audit_id: data.auditId,
      midtrans_payment_id: data.midtransPaymentId,
      amount: data.amount,
      status: "pending",
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    }),
    cache: "no-store"
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    return NextResponse.json({ error: "MIDTRANS_SERVER_KEY is not configured" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = body as Partial<CreatePaymentBody>;
  if (!payload.audit_id || typeof payload.audit_id !== "string") {
    return NextResponse.json({ error: "audit_id is required" }, { status: 400 });
  }

  const authUserId = parseJwtUserId(req.headers.get("authorization"));
  const userId = payload.user_id ?? authUserId ?? null;
  const timestamp = Date.now();
  const orderId = `slip-${payload.audit_id}-${timestamp}`;
  const amount = 20_000;
  const email = userId ? `${userId}@cekwajar.id` : "anon@cekwajar.id";

  const midtransBody = {
    transaction_details: {
      order_id: orderId,
      gross_amount: amount
    },
    item_details: [
      {
        id: "wajar-slip-premium-report",
        price: amount,
        quantity: 1,
        name: "Unlock Laporan Lengkap Wajar Slip"
      }
    ],
    customer_details: {
      email
    },
    expiry: {
      unit: "hour",
      duration: 24
    }
  };

  const response = await fetch(getMidtransBaseUrl(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: basicAuthServerKey(serverKey)
    },
    body: JSON.stringify(midtransBody),
    cache: "no-store"
  });

  if (!response.ok) {
    const midtransError = await response.text();
    return NextResponse.json({ error: "Failed to create Midtrans transaction", midtransError }, { status: 502 });
  }

  const snap = (await response.json()) as {
    token?: string;
    redirect_url?: string;
  };

  if (!snap.token || !snap.redirect_url) {
    return NextResponse.json({ error: "Invalid Midtrans response" }, { status: 502 });
  }

  await insertPendingUnlock({
    userId,
    auditId: payload.audit_id,
    midtransPaymentId: orderId,
    amount
  });

  return NextResponse.json(
    {
      token: snap.token,
      redirect_url: snap.redirect_url
    },
    { status: 200 }
  );
}
