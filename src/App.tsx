import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase, supabaseAppStateId, supabaseAppStateTable } from './lib/supabase';

type ActivityType = 'run';
type PageKey = 'home' | 'run' | 'coach' | 'plan' | 'history';
type CoachGoal = '5k' | '10k' | 'half-marathon' | 'build-consistency' | 'comeback';
type CoachStepKey = 'goal' | 'raceDate' | 'availableDays' | 'highTimeDay' | 'lowTimeDay' | 'currentPace' | 'runsPerWeek' | 'weeklyDistance' | 'injuryNotes';
type TrainingIntensity = 'easy' | 'steady' | 'quality' | 'long';
type CoachOptionValue = CoachGoal | number;

type ActivityEntry = {
  id: number;
  title: string;
  type: ActivityType;
  date: string;
  durationMin: number;
  distanceKm: number;
  effort: number;
  notes: string;
};

type CoachProfile = {
  goal: CoachGoal | '';
  raceDate: string;
  availableDays: number[];
  highTimeDay: number | '';
  lowTimeDay: number | '';
  currentPace: number | '';
  runsPerWeek: number | '';
  weeklyDistance: number | '';
  injuryNotes: string;
};

type CoachQuestion = {
  key: CoachStepKey;
  title: string;
  question: string;
  type: 'select' | 'number' | 'text' | 'date' | 'day-multi' | 'day-single';
  options?: Array<{ label: string; value: CoachOptionValue }>;
  placeholder?: string;
  min?: number;
  max?: number;
};

type TrainingSession = {
  id: string;
  weekdayIndex: number;
  weekIndex: number;
  pdfWeekNumber: number;
  pdfTrainingNumber: 1 | 3;
  dayLabel: string;
  date: string;
  title: string;
  focus: string;
  durationMin: number;
  paceTarget: string;
  heartRateZone: string;
  intensity: TrainingIntensity;
};

type TrainingPlan = {
  createdAt: string;
  raceDate: string;
  summary: string;
  sessions: TrainingSession[];
};

type AppStatePayload = {
  activities: ActivityEntry[];
  coachProfile: CoachProfile;
  trainingPlan: TrainingPlan;
};

type PdfTrainingKind = 'RD' | 'DT' | 'INT' | 'Progressief' | 'Heuvel';

type PdfSessionTemplate = {
  title: string;
  kind: PdfTrainingKind;
  durationMin: number;
  focus: string;
};

type PdfWeekPlan = {
  first: PdfSessionTemplate;
  third: PdfSessionTemplate;
};

const pdfWeekPlans: Record<number, PdfWeekPlan> = {
  1: {
    first: { title: 'Rustige dribbel', kind: 'RD', durationMin: 25, focus: 'Rustig opstarten met een ontspannen pas, bijna wandelen.' },
    third: { title: 'Duurloop tempo', kind: 'DT', durationMin: 35, focus: 'Rustig duurtempo waarbij je nog makkelijk zinnen kunt spreken.' },
  },
  2: {
    first: { title: 'Duurloop tempo', kind: 'DT', durationMin: 30, focus: 'Duurlooptempo om je lichaam aan langer bewegen te laten wennen.' },
    third: { title: 'Progressief', kind: 'Progressief', durationMin: 45, focus: 'Rustig starten en per blok iets sneller.' },
  },
  3: {
    first: { title: 'Duurloop tempo', kind: 'DT', durationMin: 45, focus: 'Langer duurtempo: ontspannen en gecontroleerd.' },
    third: { title: 'Progressief', kind: 'Progressief', durationMin: 50, focus: 'Opbouwen in tempo, zodat je ook op vermoeide benen kunt versnellen.' },
  },
  4: {
    first: { title: 'Duurloop tempo', kind: 'DT', durationMin: 60, focus: 'Stevige duurloop op gecontroleerd tempo voor meer uithoudingsvermogen.' },
    third: { title: 'Rustige dribbel', kind: 'RD', durationMin: 45, focus: 'Herstelrun op een heel rustig tempo.' },
  },
  5: {
    first: { title: 'Duurloop tempo', kind: 'DT', durationMin: 70, focus: 'Langere duurloop richting piekbelasting.' },
    third: { title: 'Progressief', kind: 'Progressief', durationMin: 50, focus: 'Opbouwen in tempo om je wedstrijdgevoel te trainen.' },
  },
  6: {
    first: { title: 'Duurloop tempo', kind: 'DT', durationMin: 80, focus: 'Zware maar rustige duurloop. Goed eten en drinken is belangrijk.' },
    third: { title: 'Rustige dribbel', kind: 'RD', durationMin: 45, focus: 'Rustige dribbel om tussendoor goed te herstellen.' },
  },
  7: {
    first: { title: 'Duurloop tempo', kind: 'DT', durationMin: 80, focus: 'Zelfde duurlooptempo als vorige week. Volhouden zonder te forceren.' },
    third: { title: 'Progressief', kind: 'Progressief', durationMin: 60, focus: 'Rustig opbouwen naar een sneller tweede deel.' },
  },
  8: {
    first: { title: 'Duurloop tempo', kind: 'DT', durationMin: 90, focus: 'Langste opbouwweek. Rustig beginnen en je tempo vasthouden.' },
    third: { title: 'Intervaltraining', kind: 'INT', durationMin: 50, focus: 'Korte, krachtige blokken met herstel.' },
  },
  9: {
    first: { title: 'Duurloop tempo', kind: 'DT', durationMin: 100, focus: 'Langste duurloop in de voorbereiding.' },
    third: { title: 'Rustige dribbel', kind: 'RD', durationMin: 45, focus: 'Herstelrun na de zwaarste inspanning van de week.' },
  },
  10: {
    first: { title: 'Progressief', kind: 'Progressief', durationMin: 90, focus: 'Opbouwen richting wedstrijdgevoel met een gecontroleerde start.' },
    third: { title: 'Rustige dribbel', kind: 'RD', durationMin: 30, focus: 'Rustige herstelrun in een zware week.' },
  },
  11: {
    first: { title: 'Duurloop tempo', kind: 'DT', durationMin: 40, focus: 'Ritme en frisheid vlak voor de wedstrijd.' },
    third: { title: 'Rustige dribbel', kind: 'RD', durationMin: 30, focus: 'Alleen als je nog wilt bewegen; anders overslaan.' },
  },
};

const storageKey = 'runpulse-activities-v1';
const coachProfileKey = 'runpulse-coach-profile-v1';
const coachPlanKey = 'runpulse-coach-plan-v1';

const initialActivities: ActivityEntry[] = [
  {
    id: 1,
    title: 'Rustige duurloop',
    type: 'run',
    date: '2026-04-20',
    durationMin: 42,
    distanceKm: 8.1,
    effort: 5,
    notes: 'Cadans rustig gehouden en eindigde sterk.',
  },
  {
    id: 3,
    title: 'Intervaltraining',
    type: 'run',
    date: '2026-04-16',
    durationMin: 36,
    distanceKm: 6.4,
    effort: 8,
    notes: '5 x 800 meter op tempo.',
  },
];

const menuItems: Array<{ label: string; key: PageKey }> = [
  { label: 'Home', key: 'home' },
  { label: 'Run', key: 'run' },
  { label: 'Coach', key: 'coach' },
  { label: 'Plan', key: 'plan' },
  { label: 'History', key: 'history' },
];

const weekdayOptions: Array<{ label: string; value: number }> = [
  { label: 'MA', value: 1 },
  { label: 'DI', value: 2 },
  { label: 'WO', value: 3 },
  { label: 'DO', value: 4 },
  { label: 'VR', value: 5 },
  { label: 'ZA', value: 6 },
  { label: 'ZO', value: 0 },
];

const coachQuestions: CoachQuestion[] = [
  {
    key: 'goal',
    title: 'Hoofddoel',
    question: 'Waar wil je de komende periode vooral naartoe trainen?',
    type: 'select',
    options: [
      { label: 'Snellere 5 km', value: '5k' },
      { label: 'Snellere 10 km', value: '10k' },
      { label: 'Halve marathon', value: 'half-marathon' },
      { label: 'Meer structuur en consistentie', value: 'build-consistency' },
      { label: 'Rustig terug opbouwen', value: 'comeback' },
    ],
  },
  {
    key: 'raceDate',
    title: 'Wedstrijddatum',
    question: 'Wanneer is je wedstrijd waar je naartoe wilt trainen?',
    type: 'date',
    placeholder: 'Kies je wedstrijddatum',
  },
  {
    key: 'availableDays',
    title: 'Beschikbare dagen',
    question: 'Op welke dagen kun je in principe lopen?',
    type: 'day-multi',
    options: weekdayOptions,
  },
  {
    key: 'highTimeDay',
    title: 'Meer tijd',
    question: 'Welke dag heb je meestal de meeste tijd om te rennen?',
    type: 'day-single',
    options: weekdayOptions,
  },
  {
    key: 'lowTimeDay',
    title: 'Minder tijd',
    question: 'Welke dag heb je meestal minder tijd?',
    type: 'day-single',
    options: weekdayOptions,
  },
  {
    key: 'currentPace',
    title: 'Huidig tempo',
    question: 'Wat is je huidige comfortabele tempo per kilometer in minuten?',
    type: 'number',
    min: 3,
    max: 15,
    placeholder: 'Bijv. 6.15',
  },
  {
    key: 'runsPerWeek',
    title: 'Beschikbaarheid',
    question: 'Hoeveel keer per week wil je realistisch kunnen lopen?',
    type: 'number',
    min: 2,
    max: 6,
    placeholder: 'Bijv. 4',
  },
  {
    key: 'weeklyDistance',
    title: 'Huidige belasting',
    question: 'Hoeveel kilometer loop je nu ongeveer per week?',
    type: 'number',
    min: 0,
    max: 200,
    placeholder: 'Bijv. 18',
  },
  {
    key: 'injuryNotes',
    title: 'Beperkingen',
    question: 'Zijn er blessures, pijntjes of andere beperkingen waar de coach rekening mee moet houden?',
    type: 'text',
    placeholder: 'Bijv. lichte knieklachten, verder geen beperkingen',
  },
];

// coachNotes removed; use coach advice from other sources or UI components when needed.

const stravaAuthHref = import.meta.env.DEV ? '/auth/strava' : '/api/auth/strava';

function getDefaultCoachProfile(): CoachProfile {
  return {
    goal: '',
    raceDate: '',
    availableDays: [1, 3, 6],
    highTimeDay: 6,
    lowTimeDay: 2,
    currentPace: '',
    runsPerWeek: '',
    weeklyDistance: '',
    injuryNotes: '',
  };
}

function getEmptyTrainingPlan(): TrainingPlan {
  return { createdAt: '', raceDate: '', summary: '', sessions: [] };
}

function formatPace(minutesPerKm: number) {
  if (!Number.isFinite(minutesPerKm) || minutesPerKm <= 0) {
    return '-';
  }

  const wholeMinutes = Math.floor(minutesPerKm);
  const seconds = Math.round((minutesPerKm - wholeMinutes) * 60)
    .toString()
    .padStart(2, '0');

  return `${wholeMinutes}:${seconds} / km`;
}

function formatDate(dateValue: string | Date) {
  return new Intl.DateTimeFormat('nl-NL', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(new Date(dateValue));
}

function formatLongDate(dateValue: string | Date) {
  return new Intl.DateTimeFormat('nl-NL', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
  }).format(new Date(dateValue));
}

function getStoredJson<T>(key: string, fallback: T) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const storedValue = window.localStorage.getItem(key);
  if (!storedValue) {
    return fallback;
  }

  try {
    return JSON.parse(storedValue) as T;
  } catch {
    return fallback;
  }
}

function getNextWeekdayDate(targetDayIndex: number, fromDate = new Date()) {
  const result = new Date(fromDate);
  result.setHours(0, 0, 0, 0);

  const currentDayIndex = result.getDay();
  let daysUntilTarget = targetDayIndex - currentDayIndex;
  if (daysUntilTarget <= 0) {
    daysUntilTarget += 7;
  }

  result.setDate(result.getDate() + daysUntilTarget);
  return result;
}

function getLocalDateKey(dateValue: string | Date) {
  const date = new Date(dateValue);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getStartOfWeek(fromDate = new Date()) {
  const result = new Date(fromDate);
  result.setHours(0, 0, 0, 0);
  const dayIndex = result.getDay();
  const offset = (dayIndex + 6) % 7;
  result.setDate(result.getDate() - offset);
  return result;
}

function getHomeWeekDays(fromDate = new Date()) {
  const startOfWeek = getStartOfWeek(fromDate);
  const labels = ['MA', 'DI', 'WO', 'DO', 'VR', 'ZA', 'ZO'];

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + index);
    return {
      dayIndex: day.getDay(),
      label: labels[index],
      longLabel: new Intl.DateTimeFormat('nl-NL', { weekday: 'long' }).format(day),
      dateNumber: day.getDate(),
      date: day,
    };
  });
}

function getGoalLabel(goal: CoachGoal | '') {
  switch (goal) {
    case '5k':
      return 'Snellere 5 km';
    case '10k':
      return 'Snellere 10 km';
    case 'half-marathon':
      return 'Halve marathon';
    case 'build-consistency':
      return 'Meer structuur en consistentie';
    case 'comeback':
      return 'Rustig terug opbouwen';
    default:
      return 'Nog niet gekozen';
  }
}

function getDayLabel(dayIndex: number) {
  return weekdayOptions.find((option) => option.value === dayIndex)?.label ?? '-';
}

function formatTempo(minutesPerKm: number) {
  if (!Number.isFinite(minutesPerKm) || minutesPerKm <= 0) {
    return 'n.v.t.';
  }

  const wholeMinutes = Math.floor(minutesPerKm);
  const seconds = Math.round((minutesPerKm - wholeMinutes) * 60)
    .toString()
    .padStart(2, '0');

  return `${wholeMinutes}:${seconds} / km`;
}

function getPaceValue(profile: CoachProfile) {
  if (typeof profile.currentPace === 'number' && profile.currentPace > 0) {
    return profile.currentPace;
  }

  return null;
}

function getSessionIntensityPlan(intensity: TrainingIntensity, currentPaceValue: number | null) {
  if (intensity === 'quality') {
    return {
      paceTarget: currentPaceValue ? formatTempo(Math.max(3.5, currentPaceValue - 0.35)) : 'tempo / interval volgens gevoel',
      heartRateZone: 'Zone 4-5',
    };
  }

  if (intensity === 'steady') {
    return {
      paceTarget: currentPaceValue ? formatTempo(currentPaceValue + 0.1) : 'comfortabel stevig',
      heartRateZone: 'Zone 3',
    };
  }

  if (intensity === 'long') {
    return {
      paceTarget: currentPaceValue ? formatTempo(currentPaceValue + 0.25) : 'rustig duurlooptempo',
      heartRateZone: 'Zone 2',
    };
  }

  return {
    paceTarget: currentPaceValue ? formatTempo(currentPaceValue + 0.3) : 'heel rustig',
    heartRateZone: 'Zone 2',
  };
}




function buildTrainingPlan(profile: CoachProfile): TrainingPlan {
  const dayOrder = [1, 2, 3, 4, 5, 6, 0];
  const availableDays = Array.from(new Set((Array.isArray(profile.availableDays) ? profile.availableDays : [1, 3, 5]).filter((day) => dayOrder.includes(day))));
  const orderedAvailableDays = dayOrder.filter((day) => availableDays.includes(day));
  const weeklyDistance = typeof profile.weeklyDistance === 'number' ? profile.weeklyDistance : 0;
  const paceValue = getPaceValue(profile);
  const goalFactor = profile.goal === 'comeback' ? 0.85 : profile.goal === 'build-consistency' ? 0.95 : 1;

  const today = new Date();
  const raceDate = profile.raceDate ? new Date(profile.raceDate) : getNextWeekdayDate(6, new Date(today.getTime() + 10 * 7 * 24 * 60 * 60 * 1000));
  const raceWeekStart = getStartOfWeek(raceDate);
  const currentWeekStart = getStartOfWeek(today);
  const totalWeeks = Math.min(11, Math.max(1, Math.ceil((raceWeekStart.getTime() - currentWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1));

  const firstRunDay = typeof profile.highTimeDay === 'number' && orderedAvailableDays.includes(profile.highTimeDay)
    ? profile.highTimeDay
    : orderedAvailableDays[0] ?? 6;
  const thirdRunDay = typeof profile.lowTimeDay === 'number' && orderedAvailableDays.includes(profile.lowTimeDay) && profile.lowTimeDay !== firstRunDay
    ? profile.lowTimeDay
    : orderedAvailableDays.find((day) => day !== firstRunDay) ?? ((firstRunDay + 2) % 7);

  const sessions: TrainingSession[] = [];

  for (let weekIndex = 0; weekIndex < totalWeeks; weekIndex += 1) {
    const weekNumber = Math.min(weekIndex + 1, 11);
    const weekPlan = pdfWeekPlans[weekNumber] ?? pdfWeekPlans[11];
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(currentWeekStart.getDate() + weekIndex * 7);

    const weekSessions = [
      { template: weekPlan.first, dayIndex: firstRunDay, slot: 1 },
      { template: weekPlan.third, dayIndex: thirdRunDay, slot: 3 },
    ];

    weekSessions.forEach(({ template, dayIndex, slot }) => {
      const date = new Date(weekStart);
      const offset = (dayIndex + 6) % 7;
      date.setDate(weekStart.getDate() + offset);

      if (date > raceDate) {
        return;
      }

      const typeToIntensity: Record<PdfTrainingKind, TrainingIntensity> = {
        RD: 'easy',
        DT: 'long',
        INT: 'quality',
        Progressief: 'steady',
        Heuvel: 'quality',
      };
      const intensity = typeToIntensity[template.kind];
      const durationMin = Math.max(20, Math.round(template.durationMin * goalFactor));
      const intensityPlan = getSessionIntensityPlan(intensity, paceValue);

      sessions.push({
        id: `${getLocalDateKey(date)}-${weekIndex}-${slot}`,
        weekdayIndex: dayIndex,
        weekIndex,
        pdfWeekNumber: weekNumber,
        pdfTrainingNumber: slot as 1 | 3,
        dayLabel: formatLongDate(date),
        date: date.toISOString(),
        title: weekNumber === 11 && slot === 3 ? 'Vrije raceweek / herstel' : template.title,
        focus: weekNumber === 11 && slot === 3
          ? 'Als je nog wilt bewegen, houd dit heel rustig. Anders rust nemen om fris aan de start te staan.'
          : template.focus,
        durationMin,
        paceTarget: intensityPlan.paceTarget,
        heartRateZone: intensityPlan.heartRateZone,
        intensity,
      });
    });
  }

  const summaryParts = [
    `${getGoalLabel(profile.goal)} als doel`,
    `PDF-schema met training 1 en 3 per week`,
    `loopdagen ${[firstRunDay, thirdRunDay].map((day) => getDayLabel(day)).join(' en ')}`,
    `huidige belasting ${weeklyDistance > 0 ? `${weeklyDistance} km/week` : 'nog onbekend'}`,
    `wedstrijddatum ${formatDate(raceDate)}`,
  ];

  if (profile.injuryNotes.trim()) {
    summaryParts.push(`aandachtspunt: ${profile.injuryNotes.trim()}`);
  }

  return {
    createdAt: new Date().toISOString(),
    raceDate: raceDate.toISOString(),
    summary: summaryParts.join(' · '),
    sessions,
  };
}

function App() {
  const storedActivities = getStoredJson<ActivityEntry[]>(storageKey, initialActivities);
  const storedProfile = getStoredJson<CoachProfile>(coachProfileKey, getDefaultCoachProfile());
  const storedPlan = getStoredJson<TrainingPlan>(coachPlanKey, getEmptyTrainingPlan());

  const [activePage, setActivePage] = useState<PageKey>('home');
  const [homeCollapsed, setHomeCollapsed] = useState(false);
  const [homeNoteExpanded, setHomeNoteExpanded] = useState(false);
  const [coachMode, setCoachMode] = useState<'intake' | 'result'>(storedPlan.sessions.length ? 'result' : 'intake');
  const [coachStepIndex, setCoachStepIndex] = useState(0);
  const [selectedHomeDay, setSelectedHomeDay] = useState<number>(() => new Date().getDay());
  const [coachProfile, setCoachProfile] = useState<CoachProfile>(storedProfile);
  const [trainingPlan, setTrainingPlan] = useState<TrainingPlan>(storedPlan);
  const [coachPrompt, setCoachPrompt] = useState('');
  const [coachResponse, setCoachResponse] = useState('');
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState('');
  const [supabaseHydrated, setSupabaseHydrated] = useState(!isSupabaseConfigured);
  const [stravaActivities, setStravaActivities] = useState<any[]>([]);
  const [stravaLoading, setStravaLoading] = useState(false);
  const [stravaError, setStravaError] = useState('');
  const [activities, setActivities] = useState<ActivityEntry[]>(() => {
    if (typeof window === 'undefined') {
      return storedActivities;
    }

    return storedActivities;
  });

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(activities));
  }, [activities]);

  useEffect(() => {
    window.localStorage.setItem(coachProfileKey, JSON.stringify(coachProfile));
  }, [coachProfile]);

  useEffect(() => {
    window.localStorage.setItem(coachPlanKey, JSON.stringify(trainingPlan));
  }, [trainingPlan]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const stravaStatus = params.get('strava');

    if (stravaStatus === 'connected') {
      setActivePage('run');
      setStravaError('');
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (stravaStatus === 'storage_failed') {
      setActivePage('run');
      setStravaError('Strava is gekoppeld, maar opslaan in Supabase mislukte. Controleer de server-env vars.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    async function loadStravaActivities() {
      if (activePage !== 'run' && activePage !== 'history') return;
      setStravaLoading(true);
      setStravaError('');

      try {
        const res = await fetch('/api/strava/activities');
        if (res.status === 401) {
          setStravaActivities([]);
          setStravaError('Niet gekoppeld met Strava. Klik op "Connect Strava".');
          setStravaLoading(false);
          return;
        }

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Kon activiteiten niet laden' }));
          setStravaError(err?.error || 'Kon activiteiten niet laden');
          setStravaActivities([]);
          setStravaLoading(false);
          return;
        }

        const data = await res.json();
        setStravaActivities(Array.isArray(data.activities) ? data.activities : []);
      } catch (err) {
        setStravaError(err instanceof Error ? err.message : String(err));
      } finally {
        setStravaLoading(false);
      }
    }

    void loadStravaActivities();
  }, [activePage]);

  useEffect(() => {
    const supabaseClient = supabase;

    if (!supabaseClient) {
      setSupabaseHydrated(true);
      return;
    }

    const client = supabaseClient as NonNullable<typeof supabaseClient>;

    let isCancelled = false;

    async function hydrateSupabaseState() {
      try {
        const { data, error } = await client
          .from(supabaseAppStateTable)
          .select('payload')
          .eq('id', supabaseAppStateId)
          .maybeSingle();

        if (isCancelled) {
          return;
        }

        if (!error && data?.payload && typeof data.payload === 'object') {
          const payload = data.payload as Partial<AppStatePayload>;

          if (Array.isArray(payload.activities)) {
            setActivities(payload.activities as ActivityEntry[]);
          }

          if (payload.coachProfile && typeof payload.coachProfile === 'object') {
            setCoachProfile({
              ...getDefaultCoachProfile(),
              ...(payload.coachProfile as Partial<CoachProfile>),
            });
          }

          if (payload.trainingPlan && typeof payload.trainingPlan === 'object') {
            setTrainingPlan({
              ...getEmptyTrainingPlan(),
              ...(payload.trainingPlan as Partial<TrainingPlan>),
            });
          }
        }
      } catch {
        // Keep the local fallback when Supabase is unreachable.
      } finally {
        if (!isCancelled) {
          setSupabaseHydrated(true);
        }
      }
    }

    void hydrateSupabaseState();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const supabaseClient = supabase;

    if (!supabaseClient || !supabaseHydrated) {
      return;
    }

    const client = supabaseClient as NonNullable<typeof supabaseClient>;

    const payload: AppStatePayload = {
      activities,
      coachProfile,
      trainingPlan,
    };

    void client.from(supabaseAppStateTable).upsert(
      {
        id: supabaseAppStateId,
        payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
  }, [activities, coachProfile, supabaseHydrated, trainingPlan]);

  const runEntries = activities.filter((activity) => activity.type === 'run');

  const weeklyDistance = runEntries
    .filter((activity) => {
      const activityDate = new Date(activity.date);
      const today = new Date();
      const difference = today.getTime() - activityDate.getTime();
      return difference <= 7 * 24 * 60 * 60 * 1000;
    })
    .reduce((sum, activity) => sum + activity.distanceKm, 0);

  const totalDuration = activities.reduce((sum, activity) => sum + activity.durationMin, 0);
  const averageEffort = activities.length
    ? activities.reduce((sum, activity) => sum + activity.effort, 0) / activities.length
    : 0;
  const bestRunPace = runEntries.reduce((bestPace, activity) => {
    if (!activity.distanceKm) {
      return bestPace;
    }

    const pace = activity.durationMin / activity.distanceKm;
    return pace < bestPace ? pace : bestPace;
  }, Number.POSITIVE_INFINITY);

  const stravaPersonalRecords = (() => {
    if (!stravaActivities || stravaActivities.length === 0) {
      return null;
    }

    const records: Record<string, any> = {
      fastestPace: null,
      longestDistance: null,
      highestElevation: null,
      highestAvgHR: null,
      fastestMaxSpeed: null,
    };

    stravaActivities.forEach((act: any) => {
      const distanceKm = act.distance ? act.distance / 1000 : 0;
      const pace = act.moving_time && distanceKm ? (act.moving_time / 60) / distanceKm : null;

      if (pace && (!records.fastestPace || pace < records.fastestPace.pace)) {
        records.fastestPace = { pace, name: act.name, date: act.start_date };
      }

      if (!records.longestDistance || distanceKm > records.longestDistance.distance) {
        records.longestDistance = { distance: distanceKm, name: act.name, date: act.start_date };
      }

      if (act.total_elevation_gain && (!records.highestElevation || act.total_elevation_gain > records.highestElevation.elevation)) {
        records.highestElevation = { elevation: act.total_elevation_gain, name: act.name, date: act.start_date };
      }

      if (act.average_heartrate && (!records.highestAvgHR || act.average_heartrate > records.highestAvgHR.hr)) {
        records.highestAvgHR = { hr: act.average_heartrate, name: act.name, date: act.start_date };
      }

      if (act.max_speed && (!records.fastestMaxSpeed || act.max_speed > records.fastestMaxSpeed.speed)) {
        records.fastestMaxSpeed = { speed: act.max_speed, name: act.name, date: act.start_date };
      }
    });

    return records;
  })();

  const currentQuestion = coachQuestions[coachStepIndex];
  const homeWeekDays = getHomeWeekDays();
  const selectedHomeDayInfo = homeWeekDays.find((day) => day.dayIndex === selectedHomeDay) ?? homeWeekDays[0];
  const selectedDaySessions = trainingPlan.sessions
    .filter((session) => session.weekdayIndex === selectedHomeDay)
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
  const selectedHomeDaySession =
    selectedDaySessions.find((session) => new Date(session.date).getTime() >= Date.now()) ?? selectedDaySessions[0];

  function openWorkoutPage() {
    setActivePage('run');
  }

  function addSelectedSessionToSchedule() {
    if (!selectedHomeDaySession) {
      return;
    }

    const scheduledRun: ActivityEntry = {
      id: Date.now(),
      title: selectedHomeDaySession.title,
      type: 'run',
      date: selectedHomeDaySession.date,
      durationMin: selectedHomeDaySession.durationMin,
      distanceKm: Math.max(3, Math.round((selectedHomeDaySession.durationMin / 6) * 10) / 10),
      effort: selectedHomeDaySession.intensity === 'long' ? 7 : selectedHomeDaySession.intensity === 'quality' ? 8 : 5,
      notes: selectedHomeDaySession.focus,
    };

    setActivities((currentActivities) => [scheduledRun, ...currentActivities]);
    setActivePage('history');
  }

  function updateCoachProfile(key: CoachStepKey, value: CoachGoal | number | string | number[]) {
    setCoachProfile((currentProfile) => ({
      ...currentProfile,
      [key]: value,
    }));
  }

  function resetCoachFlow() {
    setCoachMode('intake');
    setCoachStepIndex(0);
    setCoachProfile({
      goal: '',
      raceDate: '',
      availableDays: [1, 3, 6],
      highTimeDay: 6,
      lowTimeDay: 2,
      currentPace: '',
      runsPerWeek: '',
      weeklyDistance: '',
      injuryNotes: '',
    });
    setTrainingPlan({ createdAt: '', raceDate: '', summary: '', sessions: [] });
    setCoachPrompt('');
    setCoachResponse('');
    setCoachError('');
  }

  function advanceCoachStep() {
    if (!currentQuestion) {
      return;
    }

    const currentValue = coachProfile[currentQuestion.key];

    if (currentQuestion.type === 'select' && !currentValue) {
      return;
    }

    if (currentQuestion.type === 'number' && typeof currentValue !== 'number') {
      return;
    }

    if (currentQuestion.type === 'date' && !String(currentValue ?? '').trim()) {
      return;
    }

    if (currentQuestion.type === 'day-multi' && (!Array.isArray(currentValue) || currentValue.length === 0)) {
      return;
    }

    if (currentQuestion.type === 'day-single' && typeof currentValue !== 'number') {
      return;
    }

    if (currentQuestion.type === 'text' && !String(currentValue ?? '').trim()) {
      return;
    }

    const nextStepIndex = coachStepIndex + 1;

    if (nextStepIndex >= coachQuestions.length) {
      const plan = buildTrainingPlan(coachProfile);
      setTrainingPlan(plan);
      setCoachMode('result');
      setCoachStepIndex(nextStepIndex);
      setActivePage('plan');
      return;
    }

    setCoachStepIndex(nextStepIndex);
  }

  async function requestCoachAdvice() {
    const prompt = coachPrompt.trim();
    if (!prompt || coachLoading) {
      return;
    }

    setCoachLoading(true);
    setCoachError('');

    try {
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          metrics: {
            weeklyDistance,
            totalDuration,
            averageEffort,
            runCount: runEntries.length,
            bestRunPace: Number.isFinite(bestRunPace) ? bestRunPace : null,
          },
          currentPace: coachProfile.currentPace,
          profile: coachProfile,
          plan: trainingPlan,
          activities: activities.slice(0, 8),
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorData?.error ?? 'Coach kon niet worden geladen.');
      }

      const data = (await response.json()) as { advice?: string };
      setCoachResponse(data.advice ?? 'Geen advies ontvangen.');
    } catch (error) {
      setCoachError(error instanceof Error ? error.message : 'Er ging iets mis bij de coach.');
    } finally {
      setCoachLoading(false);
    }
  }

  function renderCoachIntake() {
    if (!currentQuestion) {
      return null;
    }

    const currentValue = coachProfile[currentQuestion.key];

    return (
      <section className="coach-wizard">
        <div className="card page-card page-card--coach">
          <div className="card__heading">
            <div>
              <p className="eyebrow">
                Stap {coachStepIndex + 1} van {coachQuestions.length}
              </p>
              <h2>{currentQuestion.title}</h2>
            </div>
            <button className="button button--secondary button--compact" type="button" onClick={resetCoachFlow}>
              Opnieuw
            </button>
          </div>

          <p className="page-copy">{currentQuestion.question}</p>

          {currentQuestion.type === 'select' ? (
            <div className="coach-choice-list" role="listbox" aria-label={currentQuestion.title}>
              {currentQuestion.options?.map((option) => (
                <button
                  key={option.value}
                  className={coachProfile.goal === option.value ? 'coach-choice coach-choice--active' : 'coach-choice'}
                  type="button"
                  onClick={() => updateCoachProfile(currentQuestion.key, option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}

          {currentQuestion.type === 'number' ? (
            <label className="coach-input">
              Antwoord
              <input
                type="number"
                min={currentQuestion.min}
                max={currentQuestion.max}
                value={typeof currentValue === 'number' ? currentValue : ''}
                placeholder={currentQuestion.placeholder}
                onChange={(event) => updateCoachProfile(currentQuestion.key, Number(event.target.value))}
              />
            </label>
          ) : null}

          {currentQuestion.type === 'text' ? (
            <label className="coach-input">
              Antwoord
              <textarea
                value={typeof currentValue === 'string' ? currentValue : ''}
                onChange={(event) => updateCoachProfile(currentQuestion.key, event.target.value)}
                placeholder={currentQuestion.placeholder}
                rows={4}
              />
            </label>
          ) : null}

          {currentQuestion.type === 'date' ? (
            <label className="coach-input">
              Wedstrijddatum
              <input
                type="date"
                value={typeof currentValue === 'string' ? currentValue : ''}
                onChange={(event) => updateCoachProfile(currentQuestion.key, event.target.value)}
              />
            </label>
          ) : null}

          {currentQuestion.type === 'day-multi' ? (
            <div className="coach-choice-list" role="listbox" aria-label={currentQuestion.title}>
              {currentQuestion.options?.map((option) => {
                const numericValue = Number(option.value);
                const selectedDays = Array.isArray(currentValue) ? currentValue : [];
                const isActive = selectedDays.includes(numericValue);

                return (
                  <button
                    key={option.label}
                    className={isActive ? 'coach-choice coach-choice--active' : 'coach-choice'}
                    type="button"
                    onClick={() => {
                      const nextDays = isActive
                        ? selectedDays.filter((day) => day !== numericValue)
                        : [...selectedDays, numericValue];
                      updateCoachProfile(currentQuestion.key, nextDays);
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          ) : null}

          {currentQuestion.type === 'day-single' ? (
            <div className="coach-choice-list" role="listbox" aria-label={currentQuestion.title}>
              {currentQuestion.options
                ?.filter((option) => {
                  const availableDayValues = coachProfile.availableDays;
                  if (availableDayValues.length && !availableDayValues.includes(Number(option.value))) {
                    return false;
                  }

                  if (currentQuestion.key === 'lowTimeDay' && typeof coachProfile.highTimeDay === 'number') {
                    return Number(option.value) !== coachProfile.highTimeDay;
                  }

                  return true;
                })
                .map((option) => {
                  const numericValue = Number(option.value);
                  const isActive = typeof currentValue === 'number' && currentValue === numericValue;

                  return (
                    <button
                      key={option.label}
                      className={isActive ? 'coach-choice coach-choice--active' : 'coach-choice'}
                      type="button"
                      onClick={() => updateCoachProfile(currentQuestion.key, numericValue)}
                    >
                      {option.label}
                    </button>
                  );
                })}
            </div>
          ) : null}

          <div className="coach-actions">
            {coachStepIndex > 0 ? (
              <button className="button button--secondary" type="button" onClick={() => setCoachStepIndex((index) => index - 1)}>
                Vorige
              </button>
            ) : (
              <span />
            )}
            <button className="button" type="button" onClick={advanceCoachStep}>
              Volgende vraag
            </button>
          </div>
        </div>

        <div className="card page-card coach-summary-card">
          <h3>Huidige coachinput</h3>
          <ul className="coach-list coach-list--summary">
            <li>Doel: {getGoalLabel(coachProfile.goal)}</li>
            <li>Wedstrijd: {coachProfile.raceDate ? formatDate(coachProfile.raceDate) : 'nog niet ingevuld'}</li>
            <li>
              Huidig tempo: {typeof coachProfile.currentPace === 'number' ? formatTempo(coachProfile.currentPace) : 'nog niet ingevuld'}
            </li>
            <li>
              Loopdagen: {coachProfile.availableDays.length ? coachProfile.availableDays.map((day) => getDayLabel(day)).join(', ') : 'nog niet ingevuld'}
            </li>
            <li>
              Meer tijd: {typeof coachProfile.highTimeDay === 'number' ? getDayLabel(coachProfile.highTimeDay) : 'nog niet ingevuld'}
            </li>
            <li>
              Minder tijd: {typeof coachProfile.lowTimeDay === 'number' ? getDayLabel(coachProfile.lowTimeDay) : 'nog niet ingevuld'}
            </li>
            <li>
              Tempo: {typeof coachProfile.currentPace === 'number' ? formatTempo(coachProfile.currentPace) : 'nog niet ingevuld'}
            </li>
            <li>
              Per week:{' '}
              {typeof coachProfile.runsPerWeek === 'number' ? `${coachProfile.runsPerWeek} loopmomenten` : 'nog niet ingevuld'}
            </li>
            <li>
              Huidige belasting:{' '}
              {typeof coachProfile.weeklyDistance === 'number' ? `${coachProfile.weeklyDistance} km` : 'nog niet ingevuld'}
            </li>
          </ul>
        </div>
      </section>
    );
  }

  function renderCoachResult() {
    return (
      <section className="coach-result-grid">
        <div className="card page-card page-card--coach">
          <p className="eyebrow">Gemaakt coachplan</p>
          <h2>Jouw agenda is gevuld</h2>
          <p className="page-copy">Dit schema is gebaseerd op je antwoorden en vormt nu de basis voor je loopweek.</p>

          <div className="coach-result__summary">
            <strong>Wedstrijddatum</strong>
            <p>{trainingPlan.raceDate ? formatDate(trainingPlan.raceDate) : 'Nog niet ingesteld'}</p>
          </div>

          <div className="coach-result__summary">
            <strong>Samenvatting</strong>
            <p>{trainingPlan.summary || 'Nog geen plan gegenereerd.'}</p>
          </div>

          <div className="plan-grid">
            {trainingPlan.sessions.map((session) => (
              <article className="plan-item plan-item--agenda" key={session.id}>
                <div className="plan-item__top">
                  <strong>{session.dayLabel}</strong>
                  <span>{session.durationMin > 0 ? `${session.durationMin} min` : 'wedstrijd'}</span>
                </div>
                <span className="plan-item__meta">PDF week {session.pdfWeekNumber} · training {session.pdfTrainingNumber}</span>
                <strong>{session.title}</strong>
                <span>{session.focus}</span>
              </article>
            ))}
          </div>

          <div className="coach-actions coach-actions--stacked">
            <button className="button" type="button" onClick={() => setActivePage('plan')}>
              Bekijk agenda
            </button>
            <button className="button button--secondary" type="button" onClick={resetCoachFlow}>
              Plan aanpassen
            </button>
          </div>
        </div>

        <div className="card page-card">
          <h3>Extra coachvraag</h3>
          <p className="page-copy">Vraag de coach om extra uitleg of een aanpassing op basis van je nieuwe plan.</p>

          <label className="coach-input">
            Jouw vraag
            <textarea
              value={coachPrompt}
              onChange={(event) => setCoachPrompt(event.target.value)}
              placeholder="Bijv. Pas mijn plan aan omdat ik doordeweeks minder tijd heb."
              rows={5}
            />
          </label>

          <button className="button" type="button" onClick={requestCoachAdvice} disabled={coachLoading}>
            {coachLoading ? 'Coach denkt na...' : 'Vraag coach'}
          </button>

          {coachError ? <p className="coach-status coach-status--error">{coachError}</p> : null}
          {coachResponse ? (
            <div className="coach-response">
              <p className="eyebrow">Advies</p>
              <p>{coachResponse}</p>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  function renderPage() {
    switch (activePage) {
      case 'run':
        return (
          <section className="page page--single">
            <div className="card page-card page-card--run">
              <p className="eyebrow">Coach voor hardlopen</p>
              <h2>Mijn hardloopsessies</h2>
              <p className="page-copy">Een overzicht van je lokale sessies en Strava-activiteiten.</p>
              <div className="run-header-stats">
                <div className="run-header-stat">
                  <strong>{runEntries.length}</strong>
                  <span>Sessies</span>
                </div>
                <div className="run-header-stat">
                  <strong>{weeklyDistance.toFixed(1)}</strong>
                  <span>km deze week</span>
                </div>
                <div className="run-header-stat">
                  <strong>{Number.isFinite(bestRunPace) ? formatPace(bestRunPace) : '—'}</strong>
                  <span>Beste pace</span>
                </div>
              </div>
              <button className="button button--secondary" type="button" onClick={openWorkoutPage}>
                Nieuwe hardloopsessie
              </button>
            </div>

            {stravaPersonalRecords && (
              <div className="card page-card">
                <div className="strava-section-header">
                  <h3>Personal Records (Strava)</h3>
                </div>
                <div className="strava-records">
                  {stravaPersonalRecords.fastestPace && (
                    <div className="strava-record-item">
                      <strong>Snelste tempo</strong>
                      <span className="value">{formatPace(stravaPersonalRecords.fastestPace.pace)}</span>
                      <small>
                        {stravaPersonalRecords.fastestPace.name} · {new Date(stravaPersonalRecords.fastestPace.date).toLocaleDateString()}
                      </small>
                    </div>
                  )}
                  
                  {stravaPersonalRecords.longestDistance && (
                    <div className="strava-record-item">
                      <strong>Langste afstand</strong>
                      <span className="value">{stravaPersonalRecords.longestDistance.distance.toFixed(2)} km</span>
                      <small>
                        {stravaPersonalRecords.longestDistance.name} · {new Date(stravaPersonalRecords.longestDistance.date).toLocaleDateString()}
                      </small>
                    </div>
                  )}
                  
                  {stravaPersonalRecords.fastestMaxSpeed && (
                    <div className="strava-record-item">
                      <strong>Snelste snelheid</strong>
                      <span className="value">{(stravaPersonalRecords.fastestMaxSpeed.speed * 3.6).toFixed(1)} km/h</span>
                      <small>
                        {stravaPersonalRecords.fastestMaxSpeed.name} · {new Date(stravaPersonalRecords.fastestMaxSpeed.date).toLocaleDateString()}
                      </small>
                    </div>
                  )}
                  
                  {stravaPersonalRecords.highestElevation && (
                    <div className="strava-record-item">
                      <strong>Meeste hoogtemeters</strong>
                      <span className="value">{stravaPersonalRecords.highestElevation.elevation.toFixed(0)} m</span>
                      <small>
                        {stravaPersonalRecords.highestElevation.name} · {new Date(stravaPersonalRecords.highestElevation.date).toLocaleDateString()}
                      </small>
                    </div>
                  )}

                  {stravaPersonalRecords.highestAvgHR && (
                    <div className="strava-record-item">
                      <strong>Hoogste gem. hartslag</strong>
                      <span className="value">{stravaPersonalRecords.highestAvgHR.hr.toFixed(0)} bpm</span>
                      <small>
                        {stravaPersonalRecords.highestAvgHR.name} · {new Date(stravaPersonalRecords.highestAvgHR.date).toLocaleDateString()}
                      </small>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="card page-card">
              <div className="strava-section-header">
                <h3>Strava activiteiten</h3>
              </div>
              {stravaLoading ? (
                <p className="page-copy">Laadt activiteiten...</p>
              ) : stravaError ? (
                <div>
                  <p className="coach-status coach-status--error">{stravaError}</p>
                  <a className="button" href={stravaAuthHref}>Connect Strava</a>
                </div>
              ) : stravaActivities.length ? (
                <ul className="coach-list">
                  {stravaActivities.map((act) => (
                    <li key={act.id}>
                      <strong>{act.name}</strong> · {(act.distance/1000).toFixed(2)} km · {Math.round(act.moving_time/60)} min · {new Date(act.start_date).toLocaleDateString()}
                      {' '}
                      <a href={`https://www.strava.com/activities/${act.id}`} target="_blank" rel="noreferrer">Open</a>
                    </li>
                  ))}
                </ul>
              ) : (
                <div>
                  <p className="page-copy">Geen Strava-activiteiten gevonden.</p>
                  <a className="button" href={stravaAuthHref}>Connect Strava</a>
                </div>
              )}
            </div>
          </section>
        );

      case 'coach':
        return coachMode === 'intake' ? renderCoachIntake() : renderCoachResult();

      case 'plan':
        return (
          <section className="page page--single">
            <div className="card page-card">
              <p className="eyebrow">Weekplan</p>
              <h2>Coachplan</h2>
              <p className="page-copy">Een rustige opbouw zonder commerciële prikkels. De agenda hieronder is gegenereerd vanuit je intake.</p>

              {trainingPlan.sessions.length ? (
                <div className="coach-result__summary coach-result__summary--compact">
                  <strong>Plan samenvatting</strong>
                  <p>{trainingPlan.summary}</p>
                </div>
              ) : null}

              <div className="plan-grid">
                {trainingPlan.sessions.length ? (
                  trainingPlan.sessions.map((session) => (
                    <article className="plan-item plan-item--agenda" key={session.id}>
                      <div className="plan-item__top">
                        <strong>{session.dayLabel}</strong>
                        <span>{session.durationMin} min</span>
                      </div>
                      <span className="plan-item__meta">PDF week {session.pdfWeekNumber} · training {session.pdfTrainingNumber}</span>
                      <strong>{session.title}</strong>
                      <span>{session.focus}</span>
                    </article>
                  ))
                ) : (
                  <article className="plan-item">
                    <strong>Nog geen agenda</strong>
                    <span>Ga naar de coach en vul eerst de intake in om je loopweek automatisch te laten maken.</span>
                  </article>
                )}
              </div>
            </div>
          </section>
        );

      case 'history':
        const allActivities = [
          ...activities,
          ...(stravaActivities || []).map((act: any) => ({
            id: `strava-${act.id}`,
            title: act.name || 'Strava activiteit',
            type: 'run',
            date: act.start_date || new Date().toISOString(),
            durationMin: Math.round(act.moving_time ? act.moving_time / 60 : 0),
            distanceKm: act.distance ? act.distance / 1000 : 0,
            effort: 5,
            notes: `Strava: ${act.type || 'Run'} · Cadans: ${act.average_cadence || 'n.v.t.'} · HR: ${act.average_heartrate || 'n.v.t.'}`,
          })),
        ];
        
        const sortedActivities = allActivities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return (
          <section className="page page--single">
            <div className="card page-card">
              <p className="eyebrow">Historie</p>
              <h2>Recente sessies</h2>
              {stravaLoading ? (
                <p>Strava-activiteiten laden...</p>
              ) : (
                <>
                  {stravaError && (
                    <div className="coach-status coach-status--error" style={{marginBottom: '1em'}}>
                      {stravaError}
                      <br />
                      <a className="button button--small" href={stravaAuthHref}>
                        ↳ Connect Strava
                      </a>
                    </div>
                  )}
                  {sortedActivities.length ? (
                    <div className="timeline timeline--compact">
                      {sortedActivities.map((activity) => (
                        <article className="timeline-item" key={activity.id}>
                          <div className={`timeline-item__dot timeline-item__dot--${activity.type}`} />
                          <div className="timeline-item__content">
                            <div className="timeline-item__top">
                              <strong>{activity.title}</strong>
                              <span>{formatDate(activity.date)}</span>
                              {String(activity.id).startsWith('strava-') && <span style={{fontSize: '0.85em', color: '#ff7a00', fontWeight: 'bold'}}>Strava</span>}
                            </div>
                            <div className="timeline-item__meta">
                              <span>{activity.distanceKm.toFixed(1)} km</span>
                              <span>{activity.durationMin} min</span>
                              {!String(activity.id).startsWith('strava-') && <span>Effort {activity.effort}/10</span>}
                            </div>
                            {String(activity.id).startsWith('strava-') && (
                              <div className="timeline-item__notes" style={{fontSize: '0.9em', color: '#666', marginTop: '0.5em'}}>
                                {activity.notes}
                              </div>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <p className="page-copy">Geen activiteiten gevonden. Start je eerste hardloopsessie!</p>
                      {stravaError && (
                        <a className="button" href={stravaAuthHref}>
                          Connect Strava
                        </a>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        );

      case 'home':
      default:
        return (
          <section className="home-screen">
            <header className="home-header">
              <div className="home-header__icon-group" aria-hidden="true">
                <span className="home-icon home-icon--ghost">◦</span>
                <span className="home-icon home-icon--ghost">◦</span>
              </div>
              <div className="home-header__brand home-header__brand--empty" aria-hidden="true" />
              <button className="home-header__square" type="button" aria-label="Open coach" onClick={() => setActivePage('coach')}>
                <span />
                <span />
                <span />
                <span />
              </button>
            </header>

            <section className="home-goal-banner">
              <button className="card home-goal-banner__button" type="button" onClick={() => {
                setCoachMode('intake');
                setCoachStepIndex(0);
                setActivePage('coach');
              }}>
                <div className="home-goal-banner__top">
                  <p className="eyebrow">Doel</p>
                  <span className="home-goal-banner__icon" aria-hidden="true">+</span>
                </div>
                <h2>{coachProfile.goal ? getGoalLabel(coachProfile.goal) : 'Stel je doel in'}</h2>
                <p>
                  {coachProfile.raceDate
                    ? `Wedstrijd: ${formatDate(coachProfile.raceDate)} · tik om je coachschema aan te passen`
                    : 'Kies je doel en wedstrijddatum. De coach maakt dan je schema tot aan de wedstrijd.'}
                </p>
                <div className="home-goal-banner__chips">
                  <span>{coachProfile.goal ? 'Doel gekozen' : 'Nog geen doel'}</span>
                  <span>{coachProfile.raceDate ? `Race ${formatDate(coachProfile.raceDate)}` : 'Voeg wedstrijddatum toe'}</span>
                </div>
              </button>
            </section>

            <section className="home-week" aria-label="Weekoverzicht">
              {homeWeekDays.map((day) => (
                <button
                  className="home-week__day"
                  key={day.label}
                  type="button"
                  aria-pressed={selectedHomeDay === day.dayIndex}
                  onClick={() => setSelectedHomeDay(day.dayIndex)}
                >
                  <span>{day.label}</span>
                  <strong className={selectedHomeDay === day.dayIndex ? 'home-week__date home-week__date--active' : 'home-week__date'}>{day.dateNumber}</strong>
                  {selectedHomeDay === day.dayIndex ? <span className="home-week__dot" /> : <span className="home-week__spacer" />}
                </button>
              ))}
            </section>

            <section className="home-agenda-strip" aria-label="Agenda bovenaan">
              <article className="card home-agenda-strip__card">
                <div className="home-agenda-strip__top">
                  <p className="eyebrow">Agenda</p>
                  <button className="home-collapse" type="button" onClick={() => setActivePage('plan')}>
                    Open plan
                  </button>
                </div>
                <p className="home-agenda-strip__day">{selectedHomeDayInfo?.longLabel ?? 'Vandaag'}</p>
                <h2>{selectedHomeDaySession ? selectedHomeDaySession.title : 'Geen sessie op deze dag'}</h2>
                <p className="page-copy">
                  {selectedHomeDaySession
                    ? `${selectedHomeDaySession.dayLabel} · ${selectedHomeDaySession.durationMin} min · ${selectedHomeDaySession.focus}`
                    : 'Selecteer een andere dag of open je plan om de weekindeling te bekijken.'}
                </p>
                {selectedHomeDaySession ? (
                  <div className="home-agenda-strip__meta">
                    <span>{selectedHomeDaySession.durationMin} min</span>
                    <span>{selectedHomeDaySession.focus}</span>
                  </div>
                ) : null}
              </article>
            </section>

            <section className="home-section-title">
              <h1>Jouw resultaten op {selectedHomeDayInfo?.label ?? 'deze dag'}</h1>
            </section>

            <section className="home-day-focus" aria-label="Dagfocus">
              <article className="card home-day-focus__card">
                <p className="eyebrow">Dagfocus</p>
                <h2>{selectedHomeDayInfo?.longLabel ?? 'Dag'} · {selectedHomeDaySession ? selectedHomeDaySession.title : 'Geen sessie gepland'}</h2>
                <p className="page-copy">
                  {selectedHomeDaySession
                    ? `Deze dag laat je agenda ${selectedHomeDaySession.durationMin} minuten hardlopen zien met tempo ${selectedHomeDaySession.paceTarget} in ${selectedHomeDaySession.heartRateZone}.`
                    : 'Kies een andere dag bovenin om direct het bijbehorende plan te zien.'}
                </p>
                <div className="home-day-focus__meta">
                  <span>{selectedHomeDayInfo?.dateNumber ?? '--'}</span>
                  <span>{selectedHomeDaySession ? selectedHomeDaySession.paceTarget : 'geen sessie'}</span>
                  <span>{selectedHomeDaySession ? selectedHomeDaySession.heartRateZone : ''}</span>
                </div>
                <button className="button" type="button" onClick={addSelectedSessionToSchedule} disabled={!selectedHomeDaySession}>
                  {selectedHomeDaySession ? 'Voeg run toe aan schema' : 'Geen run om toe te voegen'}
                </button>
              </article>
            </section>

            <section className="home-section-title home-section-title--spaced">
              <h1>Hardloopsessie toevoegen</h1>
              <button className="home-collapse" type="button" onClick={() => setHomeCollapsed((currentValue) => !currentValue)}>
                {homeCollapsed ? 'UITVOUWEN' : 'SAMENVOUWEN'} <span>{homeCollapsed ? '⌃' : '⌄'}</span>
              </button>
            </section>

            {!homeCollapsed ? (
              <section className="home-grid" aria-label="Hardloopopties">
                <button className="home-card home-card--green" type="button" onClick={() => setActivePage('run')}>
                  <span className="home-card__label">Rustige loop</span>
                </button>
                <button className="home-card home-card--orange" type="button" onClick={() => setActivePage('run')}>
                  <span className="home-card__label">Tempo</span>
                </button>
                <button className="home-card home-card--red" type="button" onClick={() => setActivePage('run')}>
                  <span className="home-card__label">Intervallen</span>
                </button>
                <button className="home-card home-card--green-dark" type="button" onClick={() => setActivePage('run')}>
                  <span className="home-card__label">Heuvels</span>
                </button>
                <button className="home-card home-card--purple" type="button" onClick={() => setActivePage('run')}>
                  <span className="home-card__label">Lange hardloopsessie</span>
                </button>
                <button className="home-card home-card--crimson" type="button" onClick={() => setActivePage('run')}>
                  <span className="home-card__label">Wedstrijd</span>
                </button>
                <button className="home-card home-card--teal home-card--full" type="button" onClick={() => setActivePage('run')}>
                  <span className="home-card__label">parkrun</span>
                </button>
              </section>
            ) : null}

            <section className="home-note">
              <div className="home-note__avatar" aria-hidden="true">
                <span />
              </div>
              <p>
                {homeNoteExpanded
                  ? 'Je resultaten worden bovenaan bijgehouden. Gebruik de tabs hieronder om naar run, coach of plan te gaan.'
                  : 'Klaar om verder te gaan waar je was gebleven?'}
              </p>
              <button className="home-note__toggle" type="button" aria-label="Toggle informatie" onClick={() => setHomeNoteExpanded((currentValue) => !currentValue)}>
                {homeNoteExpanded ? '⌄' : '⌃'}
              </button>
            </section>

            <button className="home-register" type="button" onClick={() => setActivePage('coach')}>
              <span className="home-register__icon">▶</span>
              <span>Start coachintake</span>
            </button>
          </section>
        );
    }
  }

  return (
    <main className="shell">
      {renderPage()}

      <nav className="mobile-nav" aria-label="Mobiele navigatie">
        {menuItems.map((item) => (
          <button
            key={item.key}
            className={`mobile-nav__item ${activePage === item.key ? 'mobile-nav__item--active' : ''}`}
            type="button"
            onClick={() => setActivePage(item.key)}
          >
            <span className="mobile-nav__label">{item.label}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}

export default App;