function getSupabaseRestConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  return supabaseUrl && supabaseKey ? { supabaseUrl, supabaseKey } : null;
}

async function getStravaTokenFromSupabase() {
  try {
    const config = getSupabaseRestConfig();
    if (!config) return null;

    const { supabaseUrl, supabaseKey } = config;
    const restUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/app_state`;

    const response = await fetch(`${restUrl}?id=eq.main`, {
      method: 'GET',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data && data.length > 0 && data[0].payload?.strava) {
      return data[0].payload.strava;
    }

    return null;
  } catch {
    return null;
  }
}

async function getStravaActivities(accessToken) {
  try {
    const response = await fetch('https://www.strava.com/api/v3/athlete/activities', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { error: 'Strava token expired', statusCode: 401 };
      }
      return { error: 'Failed to fetch activities', statusCode: response.status };
    }

    const activities = await response.json();
    return { activities };
  } catch (err) {
    return { error: String(err), statusCode: 500 };
  }
}

export default async function handler(req, res) {
  try {
    const stravaToken = await getStravaTokenFromSupabase();

    if (!stravaToken || !stravaToken.access_token) {
      res.status(401).json({ error: 'Not connected to Strava' });
      return;
    }

    const result = await getStravaActivities(stravaToken.access_token);

    if (result.error) {
      res.status(result.statusCode || 500).json({ error: result.error });
      return;
    }

    res.status(200).json({
      ok: true,
      activities: result.activities || [],
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
