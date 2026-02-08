// Authenticated HTTP client with session cookie management

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';

export interface HttpResponse {
  status: number;
  body: any;
  ok: boolean;
}

export interface AuthClient {
  get(path: string): Promise<HttpResponse>;
  post(path: string, body?: any): Promise<HttpResponse>;
  put(path: string, body?: any): Promise<HttpResponse>;
  patch(path: string, body?: any): Promise<HttpResponse>;
  delete(path: string): Promise<HttpResponse>;
  getSessionCookie(): string;
  getEmail(): string;
}

function extractSessionCookie(headers: Headers): string | null {
  const setCookie = headers.get('set-cookie');
  if (!setCookie) return null;
  // Handle multiple cookies — find session cookie (sessionId or connect.sid)
  const cookies = setCookie.split(',').map(c => c.trim());
  for (const cookie of cookies) {
    const match = cookie.match(/(sessionId|connect\.sid)=[^;]+/);
    if (match) return match[0];
  }
  return null;
}

async function makeRequest(
  method: string,
  path: string,
  sessionCookie: string,
  body?: any,
): Promise<{ response: HttpResponse; newCookie: string | null }> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    Cookie: sessionCookie,
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });

  const newCookie = extractSessionCookie(res.headers);

  let responseBody: any;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    responseBody = await res.json();
  } else {
    responseBody = await res.text();
  }

  return {
    response: {
      status: res.status,
      body: responseBody,
      ok: res.ok,
    },
    newCookie,
  };
}

export async function createAuthClient(email: string, password: string): Promise<AuthClient> {
  // Login to get session cookie
  const loginRes = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    redirect: 'manual',
  });

  if (!loginRes.ok) {
    const text = await loginRes.text();
    throw new Error(`Login failed for ${email}: ${loginRes.status} ${text}`);
  }

  let sessionCookie = extractSessionCookie(loginRes.headers) || '';
  if (!sessionCookie) {
    throw new Error(`No session cookie returned for ${email}`);
  }

  async function authenticatedRequest(method: string, path: string, body?: any): Promise<HttpResponse> {
    const result = await makeRequest(method, path, sessionCookie, body);

    // Update cookie if server issued a new one
    if (result.newCookie) {
      sessionCookie = result.newCookie;
    }

    // Handle session expiration — re-auth once
    if (result.response.status === 401) {
      const reLoginRes = await fetch(`${BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        redirect: 'manual',
      });

      if (reLoginRes.ok) {
        const newCookie = extractSessionCookie(reLoginRes.headers);
        if (newCookie) {
          sessionCookie = newCookie;
          const retry = await makeRequest(method, path, sessionCookie, body);
          if (retry.newCookie) sessionCookie = retry.newCookie;
          return retry.response;
        }
      }
    }

    return result.response;
  }

  return {
    get: (path: string) => authenticatedRequest('GET', path),
    post: (path: string, body?: any) => authenticatedRequest('POST', path, body),
    put: (path: string, body?: any) => authenticatedRequest('PUT', path, body),
    patch: (path: string, body?: any) => authenticatedRequest('PATCH', path, body),
    delete: (path: string) => authenticatedRequest('DELETE', path),
    getSessionCookie: () => sessionCookie,
    getEmail: () => email,
  };
}

export function getBaseUrl(): string {
  return BASE_URL;
}
