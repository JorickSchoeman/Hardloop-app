function getSupabaseRestConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  return supabaseUrl && supabaseKey ? { supabaseUrl, supabaseKey } : null;
}

function getStravaRedirectUri(req) {
  const configuredValue = process.env.STRAVA_REDIRECT_URI?.trim();

  if (configuredValue) {
    try {
      const configuredUrl = new URL(configuredValue);
      if (!configuredUrl.pathname || configuredUrl.pathname === '/') {
        configuredUrl.pathname = '/api/auth/strava/callback';
      }
      return configuredUrl.toString();
    } catch {
      const host = configuredValue.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
      const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
      return `${protocol}://${host}/api/auth/strava/callback`;
    }
  }

  const host = req.headers?.host || 'localhost:5173';
  const forwardedProto = req.headers?.['x-forwarded-proto'];
  const protocol =
    typeof forwardedProto === 'string' && forwardedProto
      ? forwardedProto.split(',')[0].trim()
      : host.startsWith('localhost') || host.startsWith('127.0.0.1')
        ? 'http'
        : 'https';

  return `${protocol}://${host}/api/auth/strava/callback`;
}

async function storeStravaTokensToSupabase(tokenPayload) {
  try {
    const config = getSupabaseRestConfig();

    if (!config) {
      return false;
    }

    const { supabaseUrl, supabaseKey } = config;
    const restUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/app_state`;

    await fetch(`${restUrl}?id=eq.main`, {
      method: 'PATCH',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ payload: { strava: tokenPayload } }),
    }).catch(() => null);

    return true;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  const sendJson = (statusCode, payload) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
  };

  try {
    const url = new URL(req.url || '/api/auth/strava/callback', `http://${req.headers?.host || 'localhost:5173'}`);
    const code = url.searchParams.get('code');

    if (!code) {
      sendJson(400, { error: 'Missing code' });
      return;
    }

    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;
    const redirectUri = getStravaRedirectUri(req);
    if (!clientId || !clientSecret) {
      sendJson(500, { error: 'STRAVA client config missing' });
      return;
    }

    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: Number(clientId),
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const error = await tokenRes.text();
      sendJson(tokenRes.status, { error: `Strava API error: ${error}` });
      return;
    }

    const tokenData = await tokenRes.json();
    const stored = await storeStravaTokensToSupabase(tokenData);
    const redirectUrl = stored ? '/?strava=connected' : '/?strava=storage_failed';

    res.writeHead(302, { Location: redirectUrl });
    res.end();
  } catch (err) {
    console.error('Strava callback error:', err);
    sendJson(500, { error: String(err) });
  }
}
