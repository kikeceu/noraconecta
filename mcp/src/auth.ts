interface AuthState {
  token: string;
  expiresAt: number;
}

let authState: AuthState | null = null;

const API_URL = process.env.NORA_API_URL || 'https://api.noraconecta.com';
const EMAIL = process.env.NORA_ADMIN_EMAIL!;
const PASSWORD = process.env.NORA_ADMIN_PASSWORD!;

export async function getToken(): Promise<string> {
  const now = Date.now();

  if (authState && authState.expiresAt - now > 30 * 60 * 1000) {
    return authState.token;
  }

  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  if (!res.ok) {
    throw new Error('NORA login failed');
  }

  const setCookie = res.headers.get('set-cookie');
  const match = setCookie?.match(/admin_token=([^;]+)/);
  const token = match?.[1];

  if (!token) {
    throw new Error('NORA login: token not found in Set-Cookie header');
  }

  authState = {
    token,
    expiresAt: now + 23 * 60 * 60 * 1000,
  };

  return authState.token;
}
