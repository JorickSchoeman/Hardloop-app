import http from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { PDFParse } from 'pdf-parse';

const port = Number(process.env.PORT || 5173);
const maxPdfCharsPerFile = 6000;
const pdfCoachSummary = [
  'TRAININGSPRINCIPES UIT DE GEUPLOADE HALVE-MARATHON PDFs:',
  '',
  'STRUCTUUR:',
  '- 11 weken totaal naar race; 3 trainingen per week; minimaal 1 rustdag tussen trainingen.',
  '- Gebruik per week vooral training 1 en training 3 uit de PDF als basis voor het schema.',
  '- De korte derde sessie is geen "easy run" label maar de echte PDF-herstelrun of progressieve run.',
  '- Jij bepaalt progressie: meer minuten/volume in build fase, piek in week 8-9, taper in week 10-11.',
  '',
  'TRAININGSTYPEN EN INTENSITEITEN:',
  '• DT (Duurloop Tempo): lange, comfortabele afstand waarbij je volle zinnen kunt spreken.',
  '  - Duur: 40-90 min naargelang het doel.',
  '  - Hartslag: Zone 2; tempo: huidigtempo + 0:20 tot +0:30 /km.',
  '• INT (Interval): korte herhalingen hard (buiten adem) + herstel.',
  '  - Voorbeeld: 8-10x 3min hard / 2min rustig; totaal 40-55 min + warm-up.',
  '  - Hartslag: Zone 4-5 (hard delen); tempo: huidigtempo - 0:30 /km.',
  '• Progressief: rustig starten, in 10 min naar harder tempo.',
  '  - Voorbeeld: eerste 15 min rustig, volgende 20 min opbouwen naar DT-tempo, 10 min afkoeling.',
  '  - Duur: 45-60 min; Zone 2-3.',
  '• RD (Rustige Dribbel): zeer ontspannen, bijna wandelen, voor herstel.',
  '  - Duur: 20-35 min.',
  '  - Hartslag: Zone 1-2; tempo: huidigtempo + 0:30 tot +0:45 /km.',
  '',
  'WEEKSCHEMA-OPSTELLING (voor 3 runs/week):',
  '1. LANGE RUN (op veel-tijd dag): DT of Progressief, 50-90 min, basis van de week.',
  '2. KWALITEITS-RUN (ander dag): INT of Tempo-variatie, 40-55 min, sterker lichaam.',
  '3. EASY RUN (op weinig-tijd dag of recovery dag): RD of zeer licht, 25-40 min, rijden + herstel.',
  '',
  'FASES:',
  '- BUILD (wk 1-6): volume + 5-10% per week; intro tempo in week 2-3.',
  '- PEAK (wk 7-9): meeste minuten; hardste trainingen; DT en INT op vol volume.',
  '- TAPER (wk 10-11): volume eraf -30%, intensiteit gelijk, herstel.',
  '',
  '5 PRESTATIENIVEAUS beschikbaar: anpas tempo naargelang hoe je je voelt.',
].join('\n');

const coachSystemPromptPath = path.join(process.cwd(), 'prompts', 'openai', 'coach-system-prompt.md');

const fallbackCoachSystemPrompt = `You are an expert personal running coach. Use the loaded prompt file when available. If it is missing, still produce concrete, practical running advice with durations, intensities, and progressive structure.`;

async function loadCoachSystemPrompt() {
  try {
    const promptFile = await readFile(coachSystemPromptPath, 'utf8');
    return promptFile.trim();
  } catch {
    return fallbackCoachSystemPrompt;
  }
}

function cleanPdfText(text) {
  return text
    .replace(/\r/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

async function loadPdfSourcesContext() {
  try {
    const entries = await readdir(process.cwd(), { withFileTypes: true });
    const pdfFiles = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf'))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));

    if (!pdfFiles.length) {
      return 'Geen PDF-bronnen gevonden.';
    }

    const sourceBlocks = [];

    for (const fileName of pdfFiles) {
      const filePath = path.join(process.cwd(), fileName);

      try {
        const fileBuffer = await readFile(filePath);
        const parser = new PDFParse({ data: fileBuffer });
        const parsedPdf = await parser.getText();
        await parser.destroy();
        const cleanedText = cleanPdfText(parsedPdf.text || '');
        const excerpt = cleanedText.slice(0, maxPdfCharsPerFile);

        sourceBlocks.push(`Bron: ${fileName}\n${excerpt || 'Geen uitleesbare tekst gevonden.'}`);
      } catch (error) {
        sourceBlocks.push(`Bron: ${fileName}\nKon PDF niet verwerken: ${error instanceof Error ? error.message : 'onbekende fout'}`);
      }
    }

    return sourceBlocks.join('\n\n---\n\n');
  } catch {
    return 'PDF-bronnen konden niet worden geladen.';
  }
}

function loadEnvFile() {
  const envFile = '.env.local';

  return readFile(envFile, 'utf8')
    .then((content) => {
      for (const line of content.split('\n')) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#') || !trimmedLine.includes('=')) {
          continue;
        }

        const separatorIndex = trimmedLine.indexOf('=');
        const key = trimmedLine.slice(0, separatorIndex).trim();
        const value = trimmedLine.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');

        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    })
    .catch(() => {
      // No local env file; continue with existing environment.
    });
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? JSON.parse(rawBody) : {};
}

function createCoachPrompt(payload) {
  const metrics = payload.metrics ?? {};
  const activities = Array.isArray(payload.activities) ? payload.activities : [];
  const profile = payload.profile ?? {};
  const plan = payload.plan ?? {};
  const sessions = Array.isArray(plan.sessions) ? plan.sessions : [];

  const activitySummary = activities
    .map((activity) => {
      return `${activity.date}: ${activity.title} (run, ${activity.durationMin} min)`;
    })
    .join('\n');

  const agendaSummary = sessions
    .map((session) => {
      return `${session.dayLabel}: ${session.title} - ${session.focus} (${session.durationMin} min)`;
    })
    .join('\n');

  const dayNames = {
    1: 'ma',
    2: 'di',
    3: 'wo',
    4: 'do',
    5: 'vr',
    6: 'za',
    0: 'zo',
  };

  const availableDays = Array.isArray(profile.availableDays)
    ? profile.availableDays
        .map((day) => dayNames[day] ?? String(day))
        .join(', ')
    : 'n.v.t.';
  const highTimeDay = dayNames[profile.highTimeDay] ?? profile.highTimeDay ?? 'n.v.t.';
  const lowTimeDay = dayNames[profile.lowTimeDay] ?? profile.lowTimeDay ?? 'n.v.t.';

  // Build targeted follow-up questions for any missing critical info
  const followUps = [];
  if (!profile.goal) followUps.push('Wat is je doel (bijv. afstand of streeftijd voor de race)?');
  if (!profile.currentPace && !metrics.currentPace) followUps.push('Wat is je huidige tempo in min/km (of geef een recent tempo)?');
  if (!profile.weeklyDistance && !metrics.weeklyDistance) followUps.push('Wat is je huidige wekelijkse afstand in km?');
  if (!profile.runsPerWeek) followUps.push('Hoeveel keer per week kun/tip je trainen (runs per week)?');
  if (!profile.highTimeDay) followUps.push('Op welke dag heb je de meeste tijd voor de lange run (ma, di, wo, do, vr, za, zo)?');
  if (!profile.raceDate) followUps.push('Wat is je wedstrijddatum (YYYY-MM-DD) of binnen hoeveel weken is de race?');

  const followUpBlock = followUps.length
    ? ['', 'BELANGRIJK - ONTBREKENDE INFORMATIE:', 'Voordat je een volledig schema maakt, stel eerst de volgende gerichte vragen aan de gebruiker (stel ze als afzonderlijke, korte vragen):', '']
        .concat(followUps.map((q) => `- ${q}`))
        .join('\n')
    : '';

  return [
    'Je bent een expert hardloopcoach die zelf trainingsschema\'s bepaalt. Niet standaard advies, maar ACTIEVE PLANNING.',
    '',
    'JOUW TAAK:',
    '1. Definieer trainingen in concrete minuten (niet "ongeveer" of "rond").',
    '2. Bepaal trainingtype per dag: DT (duurloop), INT (interval), Progressief, RD (rustige dribbel).',
    '3. Stel harde- en zachte intensiteiten in op basis van huidigtempo.',
    '4. Volg progressie: starten laag, opbouwen lineair, piek 2-3 weken voor race, dan taper.',
    '',
    'PROFIEL VAN DE LOPER:',
    `Doel: ${profile.goal ?? 'n.v.t.'}`,
    `Wedstrijddatum: ${profile.raceDate ?? 'n.v.t.'}`,
    `Beschikbare loopdagen: ${availableDays}`,
    `Veel tijd: ${highTimeDay} | Weinig tijd: ${lowTimeDay}`,
    `Loopmomenten per week: ${profile.runsPerWeek ?? 3}`,
    `Huidigtempo: ${profile.currentPace ? `${profile.currentPace.toFixed(2)} min/km` : 'onbekend (gebruik gevoel)'}`,
    `Huidige weekse distantie: ${profile.weeklyDistance ?? 'onbekend'}`,
    `Recente gelopen: ${metrics.runCount ?? 0} runs, ${metrics.weeklyDistance ?? 0} km/week`,
    `Beperkingen/pijntjes: ${profile.injuryNotes || 'geen'}`,
    '',
    'SCHEMA STRUCTUUR (huidige agenda):',
    agendaSummary || 'Geen agenda beschikbaar. Jij bepaalt het schema.',
    '',
    'GEMAAKTE RUNS (ter referentie):',
    activitySummary || 'Geen recente runs.',
    '',
    'PDF TRAININGSBRONNEN (VOLGEN):',
    pdfCoachSummary,
    '',
    'GEUPLOADE DOCUMENTEN:',
    pdfSourcesContext,
    '',
    'VRAAG / TAAK VOOR JOU:',
    `${payload.prompt ?? 'Maak een praktisch trainingsschema dat naar de wedstrijddatum leidt.'}`,
    '',
    'ANTWOORD FORMAAT:',
    'Wees SPECIFIEK: geef concrete trainingen met duur, trainingtype en intensiteit.',
    'Voorbeeld goede output: "Maandag: DT 45 min op 5:20 /km (zone 2) · Woensdag: INT 50 min (warm-up 10min + 8x3min hard/2min rustig) · Zaterdag: RD 30 min zeer rustig"',
    followUpBlock,
  ].join('\n');
}

async function handleCoachRequest(request, response) {
  if (request.method !== 'POST') {
    response.writeHead(405, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'Only POST is supported.' }));
    return;
  }

  try {
    const payload = await readJsonBody(request);
    const prompt = createCoachPrompt(payload);
    const systemPrompt = await loadCoachSystemPrompt();
    const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
    const openAiApiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;

    if (!openAiApiKey) {
      response.writeHead(500, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'OPENAI_API_KEY ontbreekt in de omgeving.' }));
      return;
    }

    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!openAiResponse.ok) {
      const errorText = await openAiResponse.text();
      response.writeHead(openAiResponse.status, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: errorText || 'OpenAI request failed.' }));
      return;
    }

    const data = await openAiResponse.json();
    const advice = data?.choices?.[0]?.message?.content?.trim();

    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ advice: advice || 'Geen advies ontvangen.' }));
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Serverfout.' }));
  }
}

await loadEnvFile();
const pdfSourcesContext = await loadPdfSourcesContext();

const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: 'custom',
});

const server = http.createServer(async (request, response) => {
  if (request.url?.startsWith('/api/coach')) {
    await handleCoachRequest(request, response);
    return;
  }

  if (request.method === 'GET' && (request.url === '/' || request.url?.startsWith('/index.html'))) {
    try {
      const template = await readFile(path.join(process.cwd(), 'index.html'), 'utf8');
      const html = await vite.transformIndexHtml(request.url, template);

      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(html);
      return;
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(error instanceof Error ? error.message : 'Kon index.html niet laden.');
      return;
    }
  }

  vite.middlewares(request, response, () => {
    response.statusCode = 404;
    response.end('Not found');
  });
});

server.listen(port, () => {
  console.log(`PDF coach sources loaded: ${pdfSourcesContext === 'Geen PDF-bronnen gevonden.' ? 0 : 'yes'}`);
  console.log(`RunPulse Coach running at http://127.0.0.1:${port}`);
});
