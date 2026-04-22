/**
 * Safeway/Albertsons authentication.
 *
 * The unofficial API used by community projects:
 *   POST https://www.safeway.com/abs/pub/web/j4u/api/reward/v1/web/logon
 *
 * Returns access_token + refresh_token (JWT).
 */

const LOGON_URL =
  'https://www.safeway.com/abs/pub/web/j4u/api/reward/v1/web/logon';
const REFRESH_URL =
  'https://www.safeway.com/abs/pub/web/j4u/api/reward/v1/web/token/refresh';

const BASE_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Origin: 'https://www.safeway.com',
  Referer: 'https://www.safeway.com/',
};

/**
 * Log in with email + password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ accessToken: string, refreshToken: string, expiresIn: number }>}
 */
export async function login(email, password) {
  const response = await fetch(LOGON_URL, {
    method: 'POST',
    headers: BASE_HEADERS,
    body: JSON.stringify({
      email,
      password,
      rememberMe: false,
      source: 'web',
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Safeway login failed (${response.status}): ${text}`);
  }

  const data = await response.json();

  // The response shape varies; normalise to accessToken / refreshToken
  const accessToken =
    data.access_token || data.accessToken || data.token || null;
  const refreshToken =
    data.refresh_token || data.refreshToken || null;
  const expiresIn = data.expires_in || data.expiresIn || 3600;

  if (!accessToken) {
    throw new Error(
      `Safeway login succeeded but no access_token in response: ${JSON.stringify(data)}`
    );
  }

  return { accessToken, refreshToken, expiresIn };
}

/**
 * Refresh an expired access token.
 * @param {string} refreshToken
 * @returns {Promise<{ accessToken: string, refreshToken: string, expiresIn: number }>}
 */
export async function refreshAccessToken(refreshToken) {
  const response = await fetch(REFRESH_URL, {
    method: 'POST',
    headers: BASE_HEADERS,
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Safeway token refresh failed (${response.status}): ${text}`);
  }

  const data = await response.json();

  const accessToken =
    data.access_token || data.accessToken || data.token || null;
  const newRefreshToken =
    data.refresh_token || data.refreshToken || refreshToken;
  const expiresIn = data.expires_in || data.expiresIn || 3600;

  if (!accessToken) {
    throw new Error(
      `Token refresh succeeded but no access_token in response: ${JSON.stringify(data)}`
    );
  }

  return { accessToken, refreshToken: newRefreshToken, expiresIn };
}
