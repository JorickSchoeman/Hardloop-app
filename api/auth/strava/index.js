export default function handler(req, res) {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = process.env.STRAVA_REDIRECT_URI || `https://${req.headers.host}/api/auth/strava/callback`;
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
