// Amizone verification. Verifies credentials ONCE and returns a sanitized
// profile, or null if the credentials are rejected. NEVER logs or persists the
// password — the caller passes it in and it never leaves this module.

export type AmizoneProfile = {
  amizone_id: string;
  full_name: string;
  role: 'student' | 'faculty' | 'staff';
  batch: string | null;
  department: string | null;
};

const MOCK = process.env.MOCK_AMIZONE === 'true';

export async function verifyAmizone(
  amizoneId: string,
  password: string
): Promise<AmizoneProfile | null> {
  return MOCK ? mockVerify(amizoneId, password) : realVerify(amizoneId, password);
}

// ponytail: mock is the supported MVP path. go-amizone (ditsuke/go-amizone) is
// ARCHIVED as of Nov 2024 and its public instance may be down, so the real path
// below is untestable here. In mock mode any non-empty credentials succeed
// EXCEPT password === 'wrong', which lets a developer exercise both the success
// and the 401 paths without a real Amizone account. Flip MOCK_AMIZONE=false to
// use realVerify against your own deployed amizone-api-server.
export function mockVerify(amizoneId: string, password: string): AmizoneProfile | null {
  if (!amizoneId || !password || password === 'wrong') return null;
  return {
    amizone_id: amizoneId,
    full_name: `Amity Student ${amizoneId}`,
    role: 'student',
    batch: 'B.Tech CSE 2022-26',
    department: 'Computer Science & Engineering',
  };
}

// NOT IMPLEMENTED. Real Amizone verification is deliberately deferred — Amizone's
// login now sits behind Cloudflare bot-protection, which breaks go-amizone's
// server-side form-POST approach. The only viable automation path is a headless
// real browser (Playwright), which must be tested against live Cloudflare before
// it can be trusted; if Cloudflare escalates to a CAPTCHA the fallback is college
// email-OTP verification. This is a separate, timeboxed task — see the repo-root
// notes AMIZONE-MAKE-IT-REAL.md and AMIZONE-CLOUDFLARE-REALITY.md. Until then,
// setting MOCK_AMIZONE=false fails loudly rather than pretending to work.
async function realVerify(_amizoneId: string, _password: string): Promise<AmizoneProfile | null> {
  throw new Error(
    'real Amizone verification not implemented (Cloudflare) — see AMIZONE-CLOUDFLARE-REALITY.md; keep MOCK_AMIZONE=true'
  );
}
