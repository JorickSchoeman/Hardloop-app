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

export default function handler(req, res) {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = getStravaRedirectUri(req);
  const scopes = encodeURIComponent('activity:read_all,profile:read_all');

  if (!clientId) {
    res.status(500).send('STRAVA_CLIENT_ID not configured');
    return;
  }

  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(
    redirectUri,
  )}&approval_prompt=auto&scope=${scopes}`;

  res.writeHead(302, { Location: authUrl });
  res.end();
}
