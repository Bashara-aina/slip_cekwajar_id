CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.pph21_ter_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('A', 'B', 'C')),
  salary_min BIGINT NOT NULL CHECK (salary_min >= 0),
  salary_max BIGINT CHECK (salary_max IS NULL OR salary_max >= salary_min),
  rate_percent NUMERIC(5,2) NOT NULL CHECK (rate_percent >= 0),
  effective_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (category, salary_min, effective_date)
);

CREATE TABLE IF NOT EXISTS public.bpjs_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('kesehatan', 'jht', 'jp', 'jkk', 'jkm')),
  party TEXT NOT NULL CHECK (party IN ('employee', 'employer')),
  rate_percent NUMERIC(6,3) NOT NULL CHECK (rate_percent >= 0),
  salary_cap BIGINT CHECK (salary_cap IS NULL OR salary_cap >= 0),
  effective_date DATE NOT NULL,
  legal_basis TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (type, party, rate_percent, salary_cap, effective_date)
);

CREATE TABLE IF NOT EXISTS public.slip_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anonymous BOOLEAN NOT NULL DEFAULT TRUE,
  period TEXT NOT NULL CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  gaji_pokok BIGINT NOT NULL DEFAULT 0 CHECK (gaji_pokok >= 0),
  tunjangan_tetap BIGINT NOT NULL DEFAULT 0 CHECK (tunjangan_tetap >= 0),
  tunjangan_tidak_tetap BIGINT NOT NULL DEFAULT 0 CHECK (tunjangan_tidak_tetap >= 0),
  gross_income BIGINT GENERATED ALWAYS AS (gaji_pokok + tunjangan_tetap + tunjangan_tidak_tetap) STORED,
  ptkp_status TEXT NOT NULL CHECK (
    ptkp_status IN ('TK/0','TK/1','TK/2','TK/3','K/0','K/1','K/2','K/3','K/I/0','K/I/1','K/I/2','K/I/3')
  ),
  pph21_charged BIGINT NOT NULL DEFAULT 0 CHECK (pph21_charged >= 0),
  pph21_expected BIGINT NOT NULL DEFAULT 0 CHECK (pph21_expected >= 0),
  bpjs_kesehatan_charged BIGINT NOT NULL DEFAULT 0 CHECK (bpjs_kesehatan_charged >= 0),
  bpjs_kesehatan_expected BIGINT NOT NULL DEFAULT 0 CHECK (bpjs_kesehatan_expected >= 0),
  bpjs_tk_charged BIGINT NOT NULL DEFAULT 0 CHECK (bpjs_tk_charged >= 0),
  bpjs_tk_expected BIGINT NOT NULL DEFAULT 0 CHECK (bpjs_tk_expected >= 0),
  illegal_deductions BIGINT NOT NULL DEFAULT 0 CHECK (illegal_deductions >= 0),
  total_potongan_charged BIGINT NOT NULL DEFAULT 0 CHECK (total_potongan_charged >= 0),
  gaji_bersih BIGINT NOT NULL DEFAULT 0 CHECK (gaji_bersih >= 0),
  verdict TEXT NOT NULL CHECK (verdict IN ('WAJAR', 'ADA_YANG_ANEH', 'POTONGAN_SALAH')),
  discrepancy_amount BIGINT NOT NULL DEFAULT 0 CHECK (discrepancy_amount >= 0),
  issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  premium_unlocked BOOLEAN NOT NULL DEFAULT FALSE,
  image_url TEXT,
  ocr_raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.premium_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tool TEXT NOT NULL DEFAULT 'slip',
  audit_id UUID REFERENCES public.slip_audits(id) ON DELETE SET NULL,
  midtrans_payment_id TEXT NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pph21_ter_lookup
  ON public.pph21_ter_rates (category, salary_min, effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_bpjs_lookup
  ON public.bpjs_rules (type, party, effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_slip_audits_user_created
  ON public.slip_audits (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_slip_audits_period
  ON public.slip_audits (period);
CREATE INDEX IF NOT EXISTS idx_slip_audits_verdict
  ON public.slip_audits (verdict);
CREATE INDEX IF NOT EXISTS idx_premium_unlocks_user_tool
  ON public.premium_unlocks (user_id, tool, status);
CREATE INDEX IF NOT EXISTS idx_premium_unlocks_audit
  ON public.premium_unlocks (audit_id);

ALTER TABLE public.pph21_ter_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bpjs_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slip_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premium_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY pph21_ter_rates_public_read
  ON public.pph21_ter_rates
  FOR SELECT
  USING (true);

CREATE POLICY bpjs_rules_public_read
  ON public.bpjs_rules
  FOR SELECT
  USING (true);

CREATE POLICY slip_audits_owner_select
  ON public.slip_audits
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY slip_audits_owner_insert
  ON public.slip_audits
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY slip_audits_owner_update
  ON public.slip_audits
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY slip_audits_owner_delete
  ON public.slip_audits
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY premium_unlocks_owner_select
  ON public.premium_unlocks
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY premium_unlocks_owner_insert
  ON public.premium_unlocks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY premium_unlocks_owner_update
  ON public.premium_unlocks
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE VIEW public.v_current_ter_rates AS
SELECT t.*
FROM public.pph21_ter_rates t
JOIN (
  SELECT category, MAX(effective_date) AS effective_date
  FROM public.pph21_ter_rates
  GROUP BY category
) latest
  ON latest.category = t.category
 AND latest.effective_date = t.effective_date;

CREATE OR REPLACE VIEW public.v_current_bpjs_rules AS
SELECT b.*
FROM public.bpjs_rules b
JOIN (
  SELECT type, party, MAX(effective_date) AS effective_date
  FROM public.bpjs_rules
  GROUP BY type, party
) latest
  ON latest.type = b.type
 AND latest.party = b.party
 AND latest.effective_date = b.effective_date;

CREATE OR REPLACE FUNCTION public.get_current_ter_rate(cat TEXT, gross BIGINT)
RETURNS NUMERIC
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT rate_percent
      FROM public.v_current_ter_rates
      WHERE category = cat
        AND gross >= salary_min
        AND (salary_max IS NULL OR gross <= salary_max)
      ORDER BY salary_min DESC
      LIMIT 1
    ),
    0
  );
$$;

INSERT INTO public.pph21_ter_rates (category, salary_min, salary_max, rate_percent, effective_date) VALUES
('A', 0, 5400000, 0.00, '2024-01-01'),
('A', 5400001, 5650000, 0.25, '2024-01-01'),
('A', 5650001, 5950000, 0.50, '2024-01-01'),
('A', 5950001, 6300000, 0.75, '2024-01-01'),
('A', 6300001, 6750000, 1.00, '2024-01-01'),
('A', 6750001, 7500000, 1.25, '2024-01-01'),
('A', 7500001, 8550000, 1.50, '2024-01-01'),
('A', 8550001, 9650000, 1.75, '2024-01-01'),
('A', 9650001, 10050000, 2.00, '2024-01-01'),
('A', 10050001, 10350000, 2.25, '2024-01-01'),
('A', 10350001, 10700000, 2.50, '2024-01-01'),
('A', 10700001, 11050000, 3.00, '2024-01-01'),
('A', 11050001, 11600000, 3.50, '2024-01-01'),
('A', 11600001, 12500000, 4.00, '2024-01-01'),
('A', 12500001, 13750000, 5.00, '2024-01-01'),
('A', 13750001, 15100000, 6.00, '2024-01-01'),
('A', 15100001, 16950000, 7.00, '2024-01-01'),
('A', 16950001, 19750000, 8.00, '2024-01-01'),
('A', 19750001, 24150000, 9.00, '2024-01-01'),
('A', 24150001, 26450000, 10.00, '2024-01-01'),
('A', 26450001, 28000000, 11.00, '2024-01-01'),
('A', 28000001, 30050000, 12.00, '2024-01-01'),
('A', 30050001, 32400000, 13.00, '2024-01-01'),
('A', 32400001, 35400000, 14.00, '2024-01-01'),
('A', 35400001, 39100000, 15.00, '2024-01-01'),
('A', 39100001, 43850000, 16.00, '2024-01-01'),
('A', 43850001, 47800000, 17.00, '2024-01-01'),
('A', 47800001, 51400000, 18.00, '2024-01-01'),
('A', 51400001, 56300000, 19.00, '2024-01-01'),
('A', 56300001, 62200000, 20.00, '2024-01-01'),
('A', 62200001, 68600000, 21.00, '2024-01-01'),
('A', 68600001, 77500000, 22.00, '2024-01-01'),
('A', 77500001, 89000000, 23.00, '2024-01-01'),
('A', 89000001, 103000000, 24.00, '2024-01-01'),
('A', 103000001, 125000000, 25.00, '2024-01-01'),
('A', 125000001, 157000000, 26.00, '2024-01-01'),
('A', 157000001, 206000000, 27.00, '2024-01-01'),
('A', 206000001, 337000000, 28.00, '2024-01-01'),
('A', 337000001, 454000000, 29.00, '2024-01-01'),
('A', 454000001, 550000000, 30.00, '2024-01-01'),
('A', 550000001, 695000000, 31.00, '2024-01-01'),
('A', 695000001, 910000000, 32.00, '2024-01-01'),
('A', 910000001, 1400000000, 33.00, '2024-01-01'),
('A', 1400000001, NULL, 34.00, '2024-01-01'),
('B', 0, 6200000, 0.00, '2024-01-01'),
('B', 6200001, 6500000, 0.25, '2024-01-01'),
('B', 6500001, 6850000, 0.50, '2024-01-01'),
('B', 6850001, 7300000, 0.75, '2024-01-01'),
('B', 7300001, 9200000, 1.00, '2024-01-01'),
('B', 9200001, 10750000, 1.50, '2024-01-01'),
('B', 10750001, 11250000, 2.00, '2024-01-01'),
('B', 11250001, 11600000, 2.50, '2024-01-01'),
('B', 11600001, 12600000, 3.00, '2024-01-01'),
('B', 12600001, 13600000, 4.00, '2024-01-01'),
('B', 13600001, 14950000, 5.00, '2024-01-01'),
('B', 14950001, 16400000, 6.00, '2024-01-01'),
('B', 16400001, 18450000, 7.00, '2024-01-01'),
('B', 18450001, 21850000, 8.00, '2024-01-01'),
('B', 21850001, 26000000, 9.00, '2024-01-01'),
('B', 26000001, 27700000, 10.00, '2024-01-01'),
('B', 27700001, 29350000, 11.00, '2024-01-01'),
('B', 29350001, 31450000, 12.00, '2024-01-01'),
('B', 31450001, 33950000, 13.00, '2024-01-01'),
('B', 33950001, 37100000, 14.00, '2024-01-01'),
('B', 37100001, 41100000, 15.00, '2024-01-01'),
('B', 41100001, 45800000, 16.00, '2024-01-01'),
('B', 45800001, 49500000, 17.00, '2024-01-01'),
('B', 49500001, 53800000, 18.00, '2024-01-01'),
('B', 53800001, 58500000, 19.00, '2024-01-01'),
('B', 58500001, 64000000, 20.00, '2024-01-01'),
('B', 64000001, 71000000, 21.00, '2024-01-01'),
('B', 71000001, 80000000, 22.00, '2024-01-01'),
('B', 80000001, 93000000, 23.00, '2024-01-01'),
('B', 93000001, 109000000, 24.00, '2024-01-01'),
('B', 109000001, 129000000, 25.00, '2024-01-01'),
('B', 129000001, 163000000, 26.00, '2024-01-01'),
('B', 163000001, 211000000, 27.00, '2024-01-01'),
('B', 211000001, 374000000, 28.00, '2024-01-01'),
('B', 374000001, 459000000, 29.00, '2024-01-01'),
('B', 459000001, 555000000, 30.00, '2024-01-01'),
('B', 555000001, 704000000, 31.00, '2024-01-01'),
('B', 704000001, 957000000, 32.00, '2024-01-01'),
('B', 957000001, 1405000000, 33.00, '2024-01-01'),
('B', 1405000001, NULL, 34.00, '2024-01-01'),
('C', 0, 6600000, 0.00, '2024-01-01'),
('C', 6600001, 6950000, 0.25, '2024-01-01'),
('C', 6950001, 7350000, 0.50, '2024-01-01'),
('C', 7350001, 7800000, 0.75, '2024-01-01'),
('C', 7800001, 8850000, 1.00, '2024-01-01'),
('C', 8850001, 9800000, 1.25, '2024-01-01'),
('C', 9800001, 10950000, 1.50, '2024-01-01'),
('C', 10950001, 11200000, 1.75, '2024-01-01'),
('C', 11200001, 12050000, 2.00, '2024-01-01'),
('C', 12050001, 12950000, 3.00, '2024-01-01'),
('C', 12950001, 14150000, 4.00, '2024-01-01'),
('C', 14150001, 15550000, 5.00, '2024-01-01'),
('C', 15550001, 17050000, 6.00, '2024-01-01'),
('C', 17050001, 19500000, 7.00, '2024-01-01'),
('C', 19500001, 22700000, 8.00, '2024-01-01'),
('C', 22700001, 26600000, 9.00, '2024-01-01'),
('C', 26600001, 28100000, 10.00, '2024-01-01'),
('C', 28100001, 30100000, 11.00, '2024-01-01'),
('C', 30100001, 32600000, 12.00, '2024-01-01'),
('C', 32600001, 35400000, 13.00, '2024-01-01'),
('C', 35400001, 38900000, 14.00, '2024-01-01'),
('C', 38900001, 43000000, 15.00, '2024-01-01'),
('C', 43000001, 47400000, 16.00, '2024-01-01'),
('C', 47400001, 51200000, 17.00, '2024-01-01'),
('C', 51200001, 55800000, 18.00, '2024-01-01'),
('C', 55800001, 60400000, 19.00, '2024-01-01'),
('C', 60400001, 66700000, 20.00, '2024-01-01'),
('C', 66700001, 74500000, 21.00, '2024-01-01'),
('C', 74500001, 83200000, 22.00, '2024-01-01'),
('C', 83200001, 95600000, 23.00, '2024-01-01'),
('C', 95600001, 110000000, 24.00, '2024-01-01'),
('C', 110000001, 134000000, 25.00, '2024-01-01'),
('C', 134000001, 169000000, 26.00, '2024-01-01'),
('C', 169000001, 221000000, 27.00, '2024-01-01'),
('C', 221000001, 390000000, 28.00, '2024-01-01'),
('C', 390000001, 463000000, 29.00, '2024-01-01'),
('C', 463000001, 561000000, 30.00, '2024-01-01'),
('C', 561000001, 709000000, 31.00, '2024-01-01'),
('C', 709000001, 965000000, 32.00, '2024-01-01'),
('C', 965000001, 1419000000, 33.00, '2024-01-01'),
('C', 1419000001, NULL, 34.00, '2024-01-01')
ON CONFLICT (category, salary_min, effective_date) DO NOTHING;

INSERT INTO public.bpjs_rules (type, party, rate_percent, salary_cap, effective_date, legal_basis) VALUES
('kesehatan', 'employee', 1.000, 12000000, '2020-07-01', 'Perpres 64/2020'),
('kesehatan', 'employer', 4.000, 12000000, '2020-07-01', 'Perpres 64/2020'),
('jht', 'employee', 2.000, NULL, '2015-07-01', 'PP 84/2015'),
('jht', 'employer', 3.700, NULL, '2015-07-01', 'PP 84/2015'),
('jp', 'employee', 1.000, 10547400, '2025-01-01', 'PP 45/2015'),
('jp', 'employer', 2.000, 10547400, '2025-01-01', 'PP 45/2015'),
('jkk', 'employer', 0.240, NULL, '2015-07-01', 'PP 84/2015'),
('jkk', 'employer', 1.740, NULL, '2015-07-01', 'PP 84/2015'),
('jkm', 'employer', 0.300, NULL, '2015-07-01', 'PP 84/2015')
ON CONFLICT (type, party, rate_percent, salary_cap, effective_date) DO NOTHING;
