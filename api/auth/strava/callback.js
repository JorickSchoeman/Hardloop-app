import fetch from 'node-fetch';

export default async function handler(req, res) {
  try {
    const { code } = req.query || {};
    if (!code) {
      res.status(400).send('Missing code');
      return;
    }

    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      res.status(500).send('STRAVA client config missing');
      return;
    }

    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: Number(clientId),
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();

    // store to Supabase via REST
    const supabaseUrl = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && anonKey) {
      const restUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/app_state`;
      // try patch existing
      await fetch(`${restUrl}?id=eq.main`, {
        method: 'PATCH',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ payload: { strava: tokenData } }),
      }).catch(() => null);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<html><body><h1>Strava gekoppeld</h1><pre>${JSON.stringify(tokenData, null, 2)}</pre></body></html>`);
  } catch (err) {
    res.status(500).send(String(err));
  }
}
