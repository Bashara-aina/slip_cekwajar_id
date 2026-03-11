import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 60 * 60 * 24;

async function fetchView<T>(path: string): Promise<T[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return [];

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: "GET",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`
    },
    next: { revalidate }
  });

  if (!response.ok) return [];
  return (await response.json()) as T[];
}

export async function GET(): Promise<NextResponse> {
  const [terRates, bpjsRules] = await Promise.all([
    fetchView<Record<string, unknown>>("v_current_ter_rates?select=*"),
    fetchView<Record<string, unknown>>("v_current_bpjs_rules?select=*")
  ]);

  return NextResponse.json(
    {
      ter_rates: terRates,
      bpjs_rules: bpjsRules
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=86400"
      }
    }
  );
}
