import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type Competition = {
  id: string;
  name: string;
  shortName: string | null;
  countryCode: string | null;
  regionName: string | null;
  active: boolean;
};

type Team = {
  id: string;
  name: string;
  shortName: string | null;
  countryCode: string | null;
  active: boolean;
  aliases: Array<{ id: string; value: string }>;
  competitions: Competition[];
};

type Market = {
  id: string;
  code: string;
  name: string;
  category: string | null;
  active: boolean;
  autoEvaluable: boolean;
  evaluatorKey: string | null;
  parameters: unknown;
};

type FixtureOption = {
  fixture: {
    id: string;
    kickoffAt: string | null;
    status: string;
    homeScore: number | null;
    awayScore: number | null;
    liveMinute: number | null;
    sourceType?: string;
  };
  homeTeam: Team;
  awayTeam: Team;
  competition: Competition | null;
};

type BulletinSelectionDto = {
  selection: {
    id: string;
    position: number;
    fixtureId: string | null;
    marketId: string | null;
    odd: string;
    calculatedStatus: string;
    manualStatus: string | null;
  };
  snapshot: {
    homeTeamName: string;
    awayTeamName: string;
    competitionName: string | null;
    marketCode: string;
    marketName: string;
    kickoffAt: string | null;
  };
  fixture: FixtureOption | null;
  market: Market | null;
  effectiveStatus: string;
};

type BulletinDto = {
  bulletin: {
    id: string;
    publicCode: string;
    type: 'SINGLE' | 'MULTI';
    mode: 'PRE_MATCH' | 'LIVE';
    status: string;
    stake: string | null;
    totalOdd: string | null;
    renderConfig: Record<string, boolean>;
  };
  selections: BulletinSelectionDto[];
};

type BulletinListItem = {
  id: string;
  publicCode: string;
  type: string;
  mode: string;
  status: string;
  totalOdd: string | null;
  selectionCount: number;
  updatedAt: string;
};

type HistoryRenderSummary = {
  id: string;
  fileName: string | null;
  format: string;
  templateVersion: number;
  rendererVersion: string | null;
  dimensions: string | null;
  fingerprint: string | null;
  createdAt: string;
  downloadUrl: string;
};

type HistoryListItem = BulletinListItem & {
  createdAt: string;
  latestRender: HistoryRenderSummary | null;
};

type HistoryTimelineEvent =
  | {
      type: 'CALCULATED';
      status: string | null;
      fixtureStatus: string | null;
      score: string | null;
      evaluationVersion: string | null;
      resultSource: string | null;
      createdAt: string;
    }
  | {
      type: 'OVERRIDE';
      previousStatus: string | null;
      newStatus: string | null;
      reason: string | null;
      createdAt: string;
    };

type HistorySelectionDetail = BulletinSelectionDto & {
  calculatedStatus: string;
  manualStatus: string | null;
  currentResult: {
    homeScore: number | null;
    awayScore: number | null;
    fixtureStatus: string | null;
    evaluatedAt: string | null;
    evaluationVersion: string | null;
    resultSource: string | null;
  } | null;
  fixture: {
    fixture: FixtureOption['fixture'];
    details: {
      homeCorners: number | null;
      awayCorners: number | null;
      halfTimeHomeScore: number | null;
      halfTimeAwayScore: number | null;
    } | null;
  } | null;
  timeline: HistoryTimelineEvent[];
};

type HistoryDetail = {
  bulletin: BulletinDto['bulletin'] & {
    createdAt: string;
    updatedAt: string;
    templateVersion: number;
  };
  selections: HistorySelectionDetail[];
  renders: HistoryRenderSummary[];
};

type RenderResult = {
  renderId: string;
  bulletinId: string;
  fingerprint: string;
  format: 'FEED';
  width: number;
  height: number;
  fileName: string;
  downloadUrl: string;
};

type ProviderStatus = {
  code: string;
  displayName: string;
  configured: boolean;
  lastSuccessfulSyncAt: string | null;
};

type SyncResult = {
  status: string;
  processed: number;
  created: number;
  updated: number;
  unresolved: number;
  failed: number;
  message: string | null;
};

type EvaluatedSelection = {
  selectionId: string;
  calculatedStatus: string;
  manualStatus: string | null;
  effectiveStatus: string;
  result: {
    evaluatorKey: string | null;
    evaluatorVersion: number | null;
    reasonCode: string;
  };
  resultSnapshot: {
    homeScore: number | null;
    awayScore: number | null;
    fixtureStatus: string | null;
    evaluatedAt: string;
    resultSource: string | null;
  };
};

type BulletinEvaluationResult = {
  bulletinId: string;
  status: string;
  selections: EvaluatedSelection[];
};

type Tab =
  | 'bulletins'
  | 'history'
  | 'competitions'
  | 'teams'
  | 'markets'
  | 'fixtures'
  | 'settlement';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (options?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(path, {
    ...options,
    headers,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
      message?: string;
    } | null;
    throw new Error(body?.error?.message ?? body?.message ?? 'Request failed');
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function App() {
  const [tab, setTab] = useState<Tab>('bulletins');
  const [builderOpenId, setBuilderOpenId] = useState<string | null>(null);
  const clearBuilderOpenId = useCallback(() => setBuilderOpenId(null), []);
  const editBulletinInBuilder = useCallback((id: string) => {
    setBuilderOpenId(id);
    setTab('bulletins');
  }, []);

  return (
    <main className="min-h-screen bg-studio-ink text-white">
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-studio-lime">
              Bet Studio
            </p>
            <h1 className="mt-3 text-3xl font-bold">Catalog Management</h1>
          </div>
          <nav className="flex gap-2" aria-label="Catalog sections">
            {(
              [
                'bulletins',
                'history',
                'competitions',
                'teams',
                'markets',
                'fixtures',
                'settlement',
              ] as const
            ).map((item) => (
              <button
                key={item}
                className={`rounded border px-4 py-2 text-sm font-medium capitalize focus:outline focus:outline-2 focus:outline-studio-lime ${
                  tab === item
                    ? 'border-studio-lime bg-studio-lime text-black'
                    : 'border-white/10 bg-studio-panel text-slate-200'
                }`}
                onClick={() => setTab(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </nav>
        </header>
        {tab === 'competitions' && <CompetitionsPanel />}
        {tab === 'bulletins' && (
          <BulletinsPanel
            openBulletinId={builderOpenId}
            onOpened={clearBuilderOpenId}
          />
        )}
        {tab === 'history' && <HistoryPanel onEdit={editBulletinInBuilder} />}
        {tab === 'teams' && <TeamsPanel />}
        {tab === 'markets' && <MarketsPanel />}
        {tab === 'fixtures' && <FixturesPanel />}
        {tab === 'settlement' && <SettlementPanel />}
      </div>
    </main>
  );
}

function Toolbar(props: {
  search: string;
  setSearch: (value: string) => void;
  active: string;
  setActive: (value: string) => void;
  competitions?: Competition[];
  competitionId?: string;
  setCompetitionId?: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row">
      <TextInput
        label="Search"
        value={props.search}
        onChange={props.setSearch}
      />
      <label className="text-sm text-slate-300">
        Status
        <select
          className="mt-1 w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-white"
          value={props.active}
          onChange={(event) => props.setActive(event.target.value)}
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      {props.competitions && props.setCompetitionId && (
        <label className="text-sm text-slate-300">
          Competition
          <select
            className="mt-1 w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-white"
            value={props.competitionId ?? ''}
            onChange={(event) => props.setCompetitionId?.(event.target.value)}
          >
            <option value="">All competitions</option>
            {props.competitions.map((competition) => (
              <option key={competition.id} value={competition.id}>
                {competition.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

type DraftSelection = {
  id?: string;
  fixtureId: string;
  marketId: string;
  odd: string;
};

type BulletinDraft = {
  id?: string;
  type: 'SINGLE' | 'MULTI';
  mode: 'PRE_MATCH' | 'LIVE';
  stake: string;
  renderConfig: Record<string, boolean>;
  selections: DraftSelection[];
};

const defaultDraft: BulletinDraft = {
  type: 'SINGLE',
  mode: 'PRE_MATCH',
  stake: '',
  renderConfig: {
    showCompetition: true,
    showDate: true,
    showTime: true,
    showStake: true,
    showTotalOdd: true,
    showResult: true,
    showBulletinCode: true,
  },
  selections: [{ fixtureId: '', marketId: '', odd: '1.50' }],
};

function BulletinsPanel(props: {
  openBulletinId: string | null;
  onOpened: () => void;
}) {
  const [items, setItems] = useState<BulletinListItem[]>([]);
  const [fixtures, setFixtures] = useState<FixtureOption[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [draft, setDraft] = useState<BulletinDraft>(defaultDraft);
  const [saved, setSaved] = useState<BulletinDto | null>(null);
  const [saveState, setSaveState] = useState('Unsaved');
  const [renderState, setRenderState] = useState('No export yet');
  const [lastRender, setLastRender] = useState<RenderResult | null>(null);
  const [includeOldFixtures, setIncludeOldFixtures] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [
      bulletins,
      fixtureResult,
      marketResult,
      teamResult,
      competitionResult,
    ] = await Promise.all([
      request<{ items: BulletinListItem[] }>('/api/bulletins'),
      request<{ items: FixtureOption[] }>(
        `/api/builder/fixtures?limit=100&upcomingOnly=${includeOldFixtures ? 'false' : 'true'}`,
      ),
      request<{ items: Market[] }>(
        '/api/builder/markets?activeOnly=false&limit=200',
      ),
      request<{ items: Team[] }>('/api/teams?active=all'),
      request<{ items: Competition[] }>('/api/competitions?active=all'),
    ]);
    setItems(bulletins.items);
    setFixtures(fixtureResult.items);
    setMarkets(marketResult.items);
    setTeams(teamResult.items);
    setCompetitions(competitionResult.items);
  }, [includeOldFixtures]);

  const openBulletin = useCallback(async (id: string) => {
    const result = await request<BulletinDto>(`/api/bulletins/${id}`);
    setSaved(result);
    setDraft(fromBulletin(result));
    setSaveState(`Opened ${result.bulletin.publicCode}`);
    clearRenderState();
  }, []);

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, [load]);

  useEffect(() => {
    if (!props.openBulletinId) return;
    void openBulletin(props.openBulletinId)
      .then(props.onOpened)
      .catch((err: Error) => setError(err.message));
  }, [openBulletin, props.openBulletinId, props.onOpened]);

  const totalOdd = useMemo(
    () => calculateDraftTotalOdd(draft.type, draft.selections),
    [draft],
  );
  const potentialReturn = useMemo(
    () => calculateDraftPotentialReturn(draft.stake, totalOdd),
    [draft.stake, totalOdd],
  );
  const canAdd = draft.type === 'MULTI' && draft.selections.length < 10;

  async function saveDraft() {
    setError(null);
    const incompleteSelectionIndex = draft.selections.findIndex(
      (selection) =>
        !selection.fixtureId || !selection.marketId || !selection.odd.trim(),
    );
    if (incompleteSelectionIndex >= 0) {
      setError(
        `Complete fixture, market and odd for selection ${incompleteSelectionIndex + 1}`,
      );
      setSaveState('Unsaved');
      return;
    }
    const duplicateFixtureId = findDuplicateFixtureId(draft.selections);
    if (duplicateFixtureId) {
      setError('Each fixture can only be used once in the same bulletin');
      setSaveState('Unsaved');
      return;
    }
    setSaveState('Saving');
    const payload = {
      type: draft.type,
      mode: draft.mode,
      stake: draft.stake || null,
      renderConfig: draft.renderConfig,
      selections: draft.selections,
    };
    const result = await request<BulletinDto>(
      draft.id ? `/api/bulletins/${draft.id}` : '/api/bulletins',
      {
        method: draft.id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      },
    );
    setSaved(result);
    setDraft(fromBulletin(result));
    setSaveState(`Saved ${result.bulletin.publicCode}`);
    await load();
  }

  async function duplicateBulletin() {
    if (!draft.id) return;
    const result = await request<BulletinDto>(
      `/api/bulletins/${draft.id}/duplicate`,
      { method: 'POST' },
    );
    setSaved(result);
    setDraft(fromBulletin(result));
    setSaveState(`Duplicated as ${result.bulletin.publicCode}`);
    clearRenderState();
    await load();
  }

  function clearRenderState() {
    setRenderState('No export yet');
    setLastRender(null);
  }

  async function renderSavedBulletin() {
    if (!draft.id) {
      setError('Save the bulletin before exporting PNG');
      return;
    }
    setError(null);
    setRenderState('Rendering');
    const result = await request<RenderResult>(
      `/api/bulletins/${draft.id}/render`,
      {
        method: 'POST',
        body: JSON.stringify({ format: 'FEED' }),
      },
    );
    setLastRender(result);
    setRenderState(`Rendered ${result.fileName}`);
  }

  return (
    <CatalogSection title="Bulletins" error={error}>
      <section className="grid gap-4 rounded border border-white/10 bg-studio-panel p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-slate-300">
            Type
            <select
              className="mt-1 w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-white"
              value={draft.type}
              onChange={(event) => {
                const value = event.target.value as BulletinDraft['type'];
                if (value === 'SINGLE' && draft.selections.length > 1) {
                  setError('Remove extra selections before changing to SINGLE');
                  return;
                }
                setDraft({ ...draft, type: value });
                setSaveState('Unsaved');
              }}
            >
              <option value="SINGLE">SINGLE</option>
              <option value="MULTI">MULTI</option>
            </select>
          </label>
          <label className="text-sm text-slate-300">
            Mode
            <select
              className="mt-1 w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-white"
              value={draft.mode}
              onChange={(event) => {
                setDraft({
                  ...draft,
                  mode: event.target.value as BulletinDraft['mode'],
                });
                setSaveState('Unsaved');
              }}
            >
              <option value="PRE_MATCH">PRE_MATCH</option>
              <option value="LIVE">LIVE</option>
            </select>
          </label>
          <TextInput
            label="Stake"
            value={draft.stake}
            onChange={(value) => {
              setDraft({ ...draft, stake: value });
              setSaveState('Unsaved');
            }}
          />
          <div className="text-sm text-slate-300">
            <p>Total odd</p>
            <strong className="text-xl text-white">{totalOdd}</strong>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {Object.keys(defaultDraft.renderConfig).map((key) => (
            <label
              key={key}
              className="flex items-center gap-2 text-sm text-slate-300"
            >
              <input
                type="checkbox"
                checked={draft.renderConfig[key] ?? true}
                onChange={(event) => {
                  setDraft({
                    ...draft,
                    renderConfig: {
                      ...draft.renderConfig,
                      [key]: event.target.checked,
                    },
                  });
                  setSaveState('Unsaved');
                }}
              />
              {key}
            </label>
          ))}
        </div>
      </section>
      <section className="flex flex-wrap items-center justify-between gap-3 rounded border border-white/10 bg-black/20 p-3">
        <div>
          <p className="text-sm font-semibold text-white">Fixture dropdown</p>
          <p className="text-xs text-slate-400">
            Showing upcoming/live fixtures by default.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={includeOldFixtures}
            onChange={(event) => setIncludeOldFixtures(event.target.checked)}
          />
          Show old and finished fixtures
        </label>
      </section>
      <CreateFixtureForm
        teams={teams}
        competitions={competitions}
        onCreated={async (fixture) => {
          await load();
          setDraft((current) => ({
            ...current,
            selections: assignFixtureToDraftSelections(current, fixture),
          }));
          setSaveState('Unsaved');
        }}
      />
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-3">
          {draft.selections.map((selection, index) => (
            <SelectionEditor
              key={selection.id ?? index}
              selection={selection}
              index={index}
              fixtures={fixtures}
              markets={markets}
              selectedFixtureIds={draft.selections
                .filter((_, itemIndex) => itemIndex !== index)
                .map((item) => item.fixtureId)
                .filter(Boolean)}
              canRemove={draft.selections.length > 1}
              onChange={(next) => {
                setDraft({
                  ...draft,
                  selections: draft.selections.map((item, itemIndex) =>
                    itemIndex === index ? next : item,
                  ),
                });
                setSaveState('Unsaved');
              }}
              onRemove={() => {
                setDraft({
                  ...draft,
                  selections: draft.selections.filter(
                    (_, itemIndex) => itemIndex !== index,
                  ),
                });
                setSaveState('Unsaved');
              }}
              onMove={(direction) => {
                const next = [...draft.selections];
                const target = index + direction;
                if (target < 0 || target >= next.length) return;
                [next[index], next[target]] = [next[target], next[index]];
                setDraft({ ...draft, selections: next });
                setSaveState('Unsaved');
              }}
            />
          ))}
          <button
            type="button"
            disabled={!canAdd}
            className="rounded border border-studio-lime px-4 py-2 font-semibold text-studio-lime disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-500"
            onClick={() => {
              setDraft({
                ...draft,
                selections: [
                  ...draft.selections,
                  { fixtureId: '', marketId: '', odd: '1.50' },
                ],
              });
              setSaveState('Unsaved');
            }}
          >
            {draft.selections.length >= 10
              ? 'Selection limit reached'
              : 'Add selection'}
          </button>
        </div>
        <BulletinPreview
          draft={draft}
          saved={saved}
          fixtures={fixtures}
          markets={markets}
          totalOdd={totalOdd}
          potentialReturn={potentialReturn}
        />
      </section>
      <section className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded bg-studio-lime px-4 py-2 font-semibold text-black"
          onClick={() =>
            void saveDraft().catch((err: Error) => {
              setError(err.message);
              setSaveState('Error');
            })
          }
        >
          Save bulletin
        </button>
        <button
          type="button"
          disabled={!draft.id}
          className="rounded border border-white/10 px-4 py-2 font-semibold text-slate-200 disabled:cursor-not-allowed disabled:text-slate-500"
          onClick={() =>
            void duplicateBulletin().catch((err: Error) =>
              setError(err.message),
            )
          }
        >
          Duplicate
        </button>
        <button
          type="button"
          disabled={!draft.id || renderState === 'Rendering'}
          className="rounded border border-studio-lime px-4 py-2 font-semibold text-studio-lime disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-500"
          onClick={() =>
            void renderSavedBulletin().catch((err: Error) => {
              setError(err.message);
              setRenderState('Render error');
            })
          }
        >
          Export PNG
        </button>
        <button
          type="button"
          className="rounded border border-white/10 px-4 py-2 font-semibold text-slate-200"
          onClick={() => {
            setDraft(defaultDraft);
            setSaved(null);
            setSaveState('Unsaved');
            clearRenderState();
          }}
        >
          New
        </button>
        <span className="text-sm text-slate-400">{saveState}</span>
        <span className="text-sm text-slate-400">{renderState}</span>
        {lastRender && (
          <a
            className="text-sm font-semibold text-studio-lime underline"
            href={lastRender.downloadUrl}
          >
            Download PNG
          </a>
        )}
      </section>
      <section className="grid gap-3">
        <h3 className="text-lg font-semibold">Saved bulletins</h3>
        {items.length === 0 && (
          <p className="text-sm text-slate-500">No bulletins saved yet.</p>
        )}
        {items.map((item) => (
          <article
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded border border-white/10 bg-black/20 p-4"
          >
            <div>
              <h4 className="font-semibold">{item.publicCode}</h4>
              <p className="text-sm text-slate-400">
                {item.type} | {item.mode} | {item.selectionCount} selections |{' '}
                {item.status} | {item.totalOdd ?? 'No odd'}
              </p>
            </div>
            <button
              type="button"
              className="rounded border border-white/10 px-3 py-2 text-sm"
              onClick={() =>
                void openBulletin(item.id).catch((err: Error) =>
                  setError(err.message),
                )
              }
            >
              Open
            </button>
          </article>
        ))}
      </section>
    </CatalogSection>
  );
}

function CreateFixtureForm(props: {
  teams: Team[];
  competitions: Competition[];
  onCreated: (fixture: FixtureOption) => Promise<void>;
}) {
  const [competitionId, setCompetitionId] = useState('');
  const [homeTeamId, setHomeTeamId] = useState('');
  const [awayTeamId, setAwayTeamId] = useState('');
  const [kickoffAt, setKickoffAt] = useState('');
  const [status, setStatus] = useState('SCHEDULED');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const availableTeams = useMemo(
    () =>
      competitionId
        ? props.teams.filter((team) =>
            team.competitions.some(
              (competition) => competition.id === competitionId,
            ),
          )
        : props.teams,
    [competitionId, props.teams],
  );

  useEffect(() => {
    if (homeTeamId && !availableTeams.some((team) => team.id === homeTeamId)) {
      setHomeTeamId('');
    }
    if (awayTeamId && !availableTeams.some((team) => team.id === awayTeamId)) {
      setAwayTeamId('');
    }
  }, [availableTeams, awayTeamId, homeTeamId]);

  return (
    <section className="grid gap-4 rounded border border-white/10 bg-studio-panel p-4">
      <h3 className="font-semibold">Create local fixture</h3>
      <div className="grid gap-3 md:grid-cols-5">
        <label className="text-sm text-slate-300">
          Competition
          <select
            className="mt-1 w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-white"
            value={competitionId}
            onChange={(event) => setCompetitionId(event.target.value)}
          >
            <option value="">None</option>
            {props.competitions.map((competition) => (
              <option key={competition.id} value={competition.id}>
                {competition.name}
              </option>
            ))}
          </select>
        </label>
        <TeamSelect
          label="Home"
          value={homeTeamId}
          teams={availableTeams}
          onChange={setHomeTeamId}
        />
        <TeamSelect
          label="Away"
          value={awayTeamId}
          teams={availableTeams}
          onChange={setAwayTeamId}
        />
        <TextInput
          label="Kickoff UTC"
          value={kickoffAt}
          onChange={setKickoffAt}
        />
        <label className="text-sm text-slate-300">
          Status
          <select
            className="mt-1 w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-white"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            {[
              'SCHEDULED',
              'LIVE',
              'FINISHED',
              'POSTPONED',
              'CANCELLED',
              'ABANDONED',
              'UNKNOWN',
            ].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="text-sm text-red-200">{error}</p>}
      {competitionId && availableTeams.length === 0 && (
        <p className="text-sm text-amber-200">
          No teams are linked to this competition yet.
        </p>
      )}
      <button
        type="button"
        className="w-fit rounded border border-studio-lime px-4 py-2 font-semibold text-studio-lime disabled:cursor-not-allowed disabled:opacity-60"
        disabled={
          creating || !homeTeamId || !awayTeamId || homeTeamId === awayTeamId
        }
        onClick={() => {
          setError(null);
          setCreating(true);
          void request<FixtureOption>('/api/builder/fixtures', {
            method: 'POST',
            body: JSON.stringify({
              competitionId: competitionId || null,
              homeTeamId,
              awayTeamId,
              kickoffAt: kickoffAt || null,
              status,
            }),
          })
            .then(async (fixture) => {
              setHomeTeamId('');
              setAwayTeamId('');
              setKickoffAt('');
              await props.onCreated(fixture);
            })
            .catch((err: Error) => setError(err.message))
            .finally(() => setCreating(false));
        }}
      >
        {creating ? 'Creating fixture' : 'Create fixture'}
      </button>
    </section>
  );
}

function TeamSelect(props: {
  label: string;
  value: string;
  teams: Team[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm text-slate-300">
      {props.label}
      <select
        className="mt-1 w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-white"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      >
        <option value="">Select team</option>
        {props.teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function SelectionEditor(props: {
  selection: DraftSelection;
  index: number;
  fixtures: FixtureOption[];
  markets: Market[];
  selectedFixtureIds: string[];
  canRemove: boolean;
  onChange: (selection: DraftSelection) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <article className="grid gap-4 rounded border border-white/10 bg-studio-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">Selection {props.index + 1}</h3>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border border-white/10 px-3 py-2 text-sm"
            onClick={() => props.onMove(-1)}
          >
            Up
          </button>
          <button
            type="button"
            className="rounded border border-white/10 px-3 py-2 text-sm"
            onClick={() => props.onMove(1)}
          >
            Down
          </button>
          <button
            type="button"
            disabled={!props.canRemove}
            className="rounded border border-white/10 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:text-slate-500"
            onClick={props.onRemove}
          >
            Remove
          </button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_120px]">
        <label className="text-sm text-slate-300">
          Fixture
          <select
            className="mt-1 w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-white"
            value={props.selection.fixtureId}
            onChange={(event) =>
              props.onChange({
                ...props.selection,
                fixtureId: event.target.value,
              })
            }
          >
            <option value="">Select fixture</option>
            {props.fixtures.map((item) => (
              <option
                key={item.fixture.id}
                value={item.fixture.id}
                disabled={props.selectedFixtureIds.includes(item.fixture.id)}
              >
                {formatFixtureDateTime(item.fixture.kickoffAt)} |{' '}
                {item.homeTeam.name} vs {item.awayTeam.name} |{' '}
                {item.competition?.name ?? 'No competition'} |{' '}
                {item.fixture.status}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-300">
          Market
          <select
            className="mt-1 w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-white"
            value={props.selection.marketId}
            onChange={(event) =>
              props.onChange({
                ...props.selection,
                marketId: event.target.value,
              })
            }
          >
            <option value="">Select market</option>
            {props.markets.map((market) => (
              <option key={market.id} value={market.id}>
                {market.category ? `${market.category} - ` : ''}
                {market.name} | {market.active ? 'Active' : 'Inactive'} |{' '}
                {market.autoEvaluable ? 'Automatic' : 'Manual'}
              </option>
            ))}
          </select>
          {props.markets.length === 0 && (
            <span className="mt-1 block text-xs text-amber-200">
              No markets available. Create or activate markets first.
            </span>
          )}
        </label>
        <TextInput
          label="Odd"
          value={props.selection.odd}
          onChange={(odd) => props.onChange({ ...props.selection, odd })}
          required
        />
      </div>
    </article>
  );
}

function BulletinPreview(props: {
  draft: BulletinDraft;
  saved: BulletinDto | null;
  fixtures: FixtureOption[];
  markets: Market[];
  totalOdd: string;
  potentialReturn: string;
}) {
  const code = props.saved?.bulletin.publicCode ?? 'Unsaved';
  const status = props.saved?.bulletin.status ?? 'PENDING';
  const selections =
    props.saved?.selections ??
    props.draft.selections.map((selection, index) => {
      const fixture = props.fixtures.find(
        (item) => item.fixture.id === selection.fixtureId,
      );
      const market =
        props.markets.find((item) => item.id === selection.marketId) ?? null;
      return {
        selection: {
          id: `draft-${index}`,
          position: index + 1,
          fixtureId: selection.fixtureId || null,
          marketId: selection.marketId || null,
          odd: selection.odd,
          calculatedStatus: 'PENDING',
          manualStatus: null,
        },
        snapshot: {
          homeTeamName: fixture?.homeTeam.name ?? 'Home team',
          awayTeamName: fixture?.awayTeam.name ?? 'Away team',
          competitionName: fixture?.competition?.name ?? null,
          marketCode: market?.code ?? '',
          marketName: market?.name ?? 'Market',
          kickoffAt: fixture?.fixture.kickoffAt ?? null,
        },
        fixture: fixture ?? null,
        market,
        effectiveStatus: 'PENDING',
      };
    });

  return (
    <aside className="grid content-start gap-3 rounded border border-white/10 bg-black/30 p-4">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          {props.draft.renderConfig.showBulletinCode && (
            <p className="text-sm text-studio-lime">{code}</p>
          )}
          <h3 className="text-xl font-bold">
            {props.draft.type} | {props.draft.mode}
          </h3>
        </div>
        <span className="rounded border border-white/10 px-3 py-1 text-sm">
          {status}
        </span>
      </div>
      <div className="grid gap-2">
        {selections.map((item) => (
          <article
            key={item.selection.id}
            className="grid gap-2 rounded border border-white/10 bg-studio-panel p-3"
          >
            <div className="flex justify-between gap-3 text-sm text-slate-400">
              {props.draft.renderConfig.showCompetition && (
                <span>{item.snapshot.competitionName ?? 'No competition'}</span>
              )}
              {props.draft.renderConfig.showResult && (
                <span>{item.effectiveStatus}</span>
              )}
            </div>
            <p className="font-semibold">
              {item.snapshot.homeTeamName} vs {item.snapshot.awayTeamName}
            </p>
            <p className="text-sm text-slate-300">{item.snapshot.marketName}</p>
            <div className="flex justify-between gap-3 text-sm">
              <span>Odd {item.selection.odd}</span>
              {props.draft.renderConfig.showDate && item.snapshot.kickoffAt && (
                <span>
                  {new Date(item.snapshot.kickoffAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
      <div className="flex justify-between border-t border-white/10 pt-3 text-sm">
        {props.draft.renderConfig.showStake && (
          <span>Stake {props.draft.stake || '-'}</span>
        )}
        <div className="text-right">
          {props.draft.renderConfig.showTotalOdd && (
            <strong className="block">Total odd {props.totalOdd}</strong>
          )}
          {props.draft.renderConfig.showStake && (
            <span className="block text-slate-300">
              Potential return {props.potentialReturn}
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}

function fromBulletin(input: BulletinDto): BulletinDraft {
  return {
    id: input.bulletin.id,
    type: input.bulletin.type,
    mode: input.bulletin.mode,
    stake: input.bulletin.stake ?? '',
    renderConfig: {
      ...defaultDraft.renderConfig,
      ...input.bulletin.renderConfig,
    },
    selections: input.selections.map((item) => ({
      id: item.selection.id,
      fixtureId: item.selection.fixtureId ?? '',
      marketId: item.selection.marketId ?? '',
      odd: item.selection.odd,
    })),
  };
}

function calculateDraftTotalOdd(
  type: BulletinDraft['type'],
  selections: DraftSelection[],
) {
  const values = selections.map((selection) =>
    Number(selection.odd.replace(',', '.')),
  );
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) return '-';
  if (type === 'SINGLE') return values[0]?.toFixed(2) ?? '-';
  return values.reduce((total, value) => total * value, 1).toFixed(2);
}

function calculateDraftPotentialReturn(
  stake: string,
  totalOdd: string,
): string {
  const stakeValue = Number(stake.replace(',', '.'));
  const oddValue = Number(totalOdd);
  if (
    !Number.isFinite(stakeValue) ||
    stakeValue <= 0 ||
    !Number.isFinite(oddValue) ||
    oddValue <= 0
  ) {
    return '-';
  }
  return (stakeValue * oddValue).toFixed(2);
}

function findDuplicateFixtureId(selections: DraftSelection[]): string | null {
  const seen = new Set<string>();
  for (const selection of selections) {
    if (!selection.fixtureId) continue;
    if (seen.has(selection.fixtureId)) return selection.fixtureId;
    seen.add(selection.fixtureId);
  }
  return null;
}

function assignFixtureToDraftSelections(
  draft: BulletinDraft,
  fixture: FixtureOption,
): DraftSelection[] {
  const selections = [...draft.selections];
  const emptyIndex = selections.findIndex((selection) => !selection.fixtureId);
  const targetIndex =
    emptyIndex >= 0
      ? emptyIndex
      : draft.type === 'SINGLE'
        ? 0
        : selections.length < 10
          ? selections.length
          : -1;

  if (targetIndex === -1) return selections;

  const current = selections[targetIndex] ?? {
    fixtureId: '',
    marketId: '',
    odd: '1.50',
  };
  selections[targetIndex] = {
    ...current,
    fixtureId: fixture.fixture.id,
  };

  return selections;
}

function formatFixtureDateTime(value: string | null): string {
  if (!value) return 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return date.toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function HistoryPanel(props: { onEdit: (id: string) => void }) {
  const [items, setItems] = useState<HistoryListItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<HistoryDetail | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [mode, setMode] = useState('all');
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status !== 'all') params.set('status', status);
    if (type !== 'all') params.set('type', type);
    if (mode !== 'all') params.set('mode', mode);
    params.set('limit', '50');
    const response = await request<{ items: HistoryListItem[] }>(
      `/api/history/bulletins?${params.toString()}`,
    );
    setItems(response.items);
  }, [mode, search, status, type]);

  const loadDetail = useCallback(async (id: string) => {
    if (!id) {
      setDetail(null);
      return;
    }
    setDetail(await request<HistoryDetail>(`/api/history/bulletins/${id}`));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    void loadList()
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [loadList]);

  useEffect(() => {
    void loadDetail(selectedId).catch((err: Error) => setError(err.message));
  }, [loadDetail, selectedId]);

  async function runAction(label: string, callback: () => Promise<void>) {
    setAction(label);
    setError(null);
    setMessage(null);
    try {
      await callback();
      await loadList();
      if (selectedId) await loadDetail(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setAction(null);
    }
  }

  return (
    <CatalogSection title="History" error={error}>
      <section className="grid gap-3 rounded border border-white/10 bg-studio-panel p-4 md:grid-cols-4">
        <TextInput label="Search code" value={search} onChange={setSearch} />
        <SelectInput
          label="Status"
          value={status}
          onChange={setStatus}
          options={['all', 'PENDING', 'GREEN', 'RED', 'VOID', 'MANUAL']}
        />
        <SelectInput
          label="Type"
          value={type}
          onChange={setType}
          options={['all', 'SINGLE', 'MULTI']}
        />
        <SelectInput
          label="Mode"
          value={mode}
          onChange={setMode}
          options={['all', 'PRE_MATCH', 'LIVE']}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="grid content-start gap-3">
          {loading && (
            <p className="text-sm text-slate-400">Loading history...</p>
          )}
          {!loading && items.length === 0 && (
            <p className="rounded border border-white/10 bg-studio-panel p-4 text-sm text-slate-300">
              No bulletins found.
            </p>
          )}
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`rounded border p-4 text-left focus:outline focus:outline-2 focus:outline-studio-lime ${
                selectedId === item.id
                  ? 'border-studio-lime bg-studio-lime/10'
                  : 'border-white/10 bg-studio-panel'
              }`}
              onClick={() => setSelectedId(item.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <strong>{item.publicCode}</strong>
                <StatusBadge status={item.status} />
              </div>
              <p className="mt-2 text-sm text-slate-300">
                {item.type} | {item.mode} | {item.selectionCount} selections
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Updated {formatFixtureDateTime(item.updatedAt)}
              </p>
              {item.latestRender && (
                <p className="mt-2 text-xs text-studio-lime">
                  Latest render{' '}
                  {formatFixtureDateTime(item.latestRender.createdAt)}
                </p>
              )}
            </button>
          ))}
        </div>

        {detail ? (
          <section className="grid gap-4 rounded border border-white/10 bg-studio-panel p-4">
            <div className="flex flex-col gap-3 border-b border-white/10 pb-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm text-studio-lime">
                  {detail.bulletin.publicCode}
                </p>
                <h3 className="text-2xl font-bold">
                  {detail.bulletin.type} {detail.bulletin.mode}
                </h3>
                <p className="mt-1 text-sm text-slate-300">
                  Total odd {detail.bulletin.totalOdd ?? '-'} | Stake{' '}
                  {detail.bulletin.stake ?? '-'} | Template v
                  {detail.bulletin.templateVersion}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded border border-white/10 px-3 py-2 text-sm font-semibold"
                  title="Open this saved bulletin in the Bulletins builder so you can edit it."
                  onClick={() => props.onEdit(detail.bulletin.id)}
                >
                  Edit in Builder
                </button>
                <button
                  type="button"
                  className="rounded border border-white/10 px-3 py-2 text-sm font-semibold"
                  disabled={action !== null}
                  title="Create a new editable bulletin using this bulletin as the starting point."
                  onClick={() =>
                    void runAction('Duplicate', async () => {
                      const duplicated = await request<BulletinDto>(
                        `/api/bulletins/${detail.bulletin.id}/duplicate`,
                        { method: 'POST' },
                      );
                      setSelectedId(duplicated.bulletin.id);
                    })
                  }
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className="rounded bg-studio-lime px-3 py-2 text-sm font-semibold text-black"
                  disabled={action !== null}
                  title="Recalculate all selections in this bulletin using the current fixture results and manual overrides."
                  onClick={() =>
                    void runAction('Re-evaluate bulletin', async () => {
                      await request<BulletinEvaluationResult>(
                        `/api/bulletins/${detail.bulletin.id}/evaluate`,
                        { method: 'POST' },
                      );
                    })
                  }
                >
                  Re-evaluate bulletin
                </button>
                <button
                  type="button"
                  className="rounded bg-studio-lime px-3 py-2 text-sm font-semibold text-black"
                  disabled={action !== null}
                  title="Generate a fresh PNG from the current saved state and start the download."
                  onClick={() =>
                    void runAction('Render current', async () => {
                      const render = await request<RenderResult>(
                        `/api/bulletins/${detail.bulletin.id}/render`,
                        {
                          method: 'POST',
                          body: JSON.stringify({ format: 'FEED' }),
                        },
                      );
                      downloadFile(render.downloadUrl);
                      setMessage(`Rendered and downloading ${render.fileName}`);
                    })
                  }
                >
                  Render current PNG
                </button>
              </div>
            </div>

            {action && <p className="text-sm text-slate-300">{action}...</p>}
            {message && <p className="text-sm text-studio-lime">{message}</p>}

            <div className="grid gap-3">
              {detail.selections.map((item) => (
                <HistorySelectionCard
                  key={item.selection.id}
                  item={item}
                  disabled={action !== null}
                  onAction={(label, callback) =>
                    void runAction(label, callback)
                  }
                  setMessage={setMessage}
                />
              ))}
            </div>

            <section className="grid gap-2 border-t border-white/10 pt-4">
              <h3 className="font-semibold">Render history</h3>
              <p className="text-sm text-slate-400">
                Use Render current PNG above to create and download a new
                export. Older generated files stay available here.
              </p>
              {detail.renders.length === 0 && (
                <p className="text-sm text-slate-400">No renders yet.</p>
              )}
              {detail.renders.map((render) => (
                <article
                  key={render.id}
                  className="flex flex-col gap-2 rounded border border-white/10 bg-black/20 p-3 text-sm md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-semibold">
                      {render.fileName ?? 'Render'} | {render.format}{' '}
                      {render.dimensions ?? ''}
                    </p>
                    <p className="text-slate-400">
                      {formatFixtureDateTime(render.createdAt)} | renderer{' '}
                      {render.rendererVersion ?? 'N/A'} | fp{' '}
                      {render.fingerprint ?? 'N/A'}
                    </p>
                  </div>
                  <a
                    className="rounded border border-white/10 px-3 py-2 text-center font-semibold"
                    href={render.downloadUrl}
                    title="Download this previously generated PNG render."
                  >
                    Download
                  </a>
                </article>
              ))}
            </section>
          </section>
        ) : (
          <section className="rounded border border-white/10 bg-studio-panel p-4 text-sm text-slate-300">
            Select a bulletin to inspect results, overrides and renders.
          </section>
        )}
      </section>
    </CatalogSection>
  );
}

function HistorySelectionCard(props: {
  item: HistorySelectionDetail;
  disabled: boolean;
  onAction: (label: string, callback: () => Promise<void>) => void;
  setMessage: (value: string) => void;
}) {
  const [manualStatus, setManualStatus] = useState('GREEN');
  const [reason, setReason] = useState('');
  const fixture = props.item.fixture?.fixture ?? null;
  const details = props.item.fixture?.details ?? null;
  const [fixtureStatus, setFixtureStatus] = useState(
    fixture?.status ?? 'SCHEDULED',
  );
  const [homeScore, setHomeScore] = useState(
    fixture?.homeScore === null || fixture?.homeScore === undefined
      ? ''
      : String(fixture.homeScore),
  );
  const [awayScore, setAwayScore] = useState(
    fixture?.awayScore === null || fixture?.awayScore === undefined
      ? ''
      : String(fixture.awayScore),
  );
  const [homeCorners, setHomeCorners] = useState(
    details?.homeCorners === null || details?.homeCorners === undefined
      ? ''
      : String(details.homeCorners),
  );
  const [awayCorners, setAwayCorners] = useState(
    details?.awayCorners === null || details?.awayCorners === undefined
      ? ''
      : String(details.awayCorners),
  );

  useEffect(() => {
    setFixtureStatus(fixture?.status ?? 'SCHEDULED');
    setHomeScore(
      fixture?.homeScore === null || fixture?.homeScore === undefined
        ? ''
        : String(fixture.homeScore),
    );
    setAwayScore(
      fixture?.awayScore === null || fixture?.awayScore === undefined
        ? ''
        : String(fixture.awayScore),
    );
    setHomeCorners(
      details?.homeCorners === null || details?.homeCorners === undefined
        ? ''
        : String(details.homeCorners),
    );
    setAwayCorners(
      details?.awayCorners === null || details?.awayCorners === undefined
        ? ''
        : String(details.awayCorners),
    );
  }, [details, fixture]);

  return (
    <article className="grid gap-3 rounded border border-white/10 bg-black/20 p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm text-slate-400">
            #{props.item.selection.position} |{' '}
            {props.item.snapshot.competitionName ?? 'No competition'}
          </p>
          <h4 className="text-lg font-semibold">
            {props.item.snapshot.homeTeamName} vs{' '}
            {props.item.snapshot.awayTeamName}
          </h4>
          <p className="text-sm text-slate-300">
            {props.item.snapshot.marketName} | Odd {props.item.selection.odd}
          </p>
          {props.item.market && !props.item.market.autoEvaluable && (
            <p className="mt-1 text-sm text-amber-300">
              Manual market: this selection needs a manual override because it
              has no automatic evaluator.
            </p>
          )}
          {props.item.market?.autoEvaluable &&
            !props.item.market.evaluatorKey && (
              <p className="mt-1 text-sm text-amber-300">
                Automatic evaluation is enabled, but this market has no
                evaluator configured.
              </p>
            )}
        </div>
        <div className="grid gap-1 text-sm">
          <span>Calculated: {props.item.calculatedStatus}</span>
          <span>Manual: {props.item.manualStatus ?? '-'}</span>
          <span>
            Effective: <StatusBadge status={props.item.effectiveStatus} />
          </span>
        </div>
      </div>

      <div className="grid gap-3 rounded border border-white/10 p-3 md:grid-cols-5">
        <SelectInput
          label="Fixture status"
          value={fixtureStatus}
          onChange={setFixtureStatus}
          options={[
            'SCHEDULED',
            'LIVE',
            'FINISHED',
            'POSTPONED',
            'CANCELLED',
            'ABANDONED',
            'UNKNOWN',
          ]}
        />
        <TextInput
          label="Home score"
          value={homeScore}
          onChange={setHomeScore}
        />
        <TextInput
          label="Away score"
          value={awayScore}
          onChange={setAwayScore}
        />
        <TextInput
          label="Home corners"
          value={homeCorners}
          onChange={setHomeCorners}
        />
        <TextInput
          label="Away corners"
          value={awayCorners}
          onChange={setAwayCorners}
        />
        <button
          type="button"
          className="rounded bg-studio-lime px-3 py-2 text-sm font-semibold text-black md:col-span-2"
          disabled={props.disabled || !fixture}
          title="Save the result fields shown here, then recalculate this selection with those values."
          onClick={() =>
            props.onAction('Save result & re-evaluate', async () => {
              if (!fixture) return;
              await request(`/api/fixtures/${fixture.id}/result`, {
                method: 'PATCH',
                body: JSON.stringify({
                  status: fixtureStatus,
                  homeScore: optionalInteger(homeScore),
                  awayScore: optionalInteger(awayScore),
                  homeCorners: optionalInteger(homeCorners),
                  awayCorners: optionalInteger(awayCorners),
                  liveMinute: fixture.liveMinute,
                }),
              });
              await request(
                `/api/selections/${props.item.selection.id}/evaluate`,
                {
                  method: 'POST',
                },
              );
            })
          }
        >
          Save result & re-evaluate
        </button>
        {fixture?.sourceType === 'SYNCED' && (
          <button
            type="button"
            className="rounded border border-white/10 px-3 py-2 text-sm font-semibold"
            disabled={props.disabled}
            title="Ask the configured GOAL API provider for the latest result for this synced fixture, then recalculate this selection."
            onClick={() =>
              props.onAction('Refresh provider result', async () => {
                const sync = await request<SyncResult>(
                  `/api/sync/fixtures/${fixture.id}/result`,
                  {
                    method: 'POST',
                  },
                );
                const evaluated = await request<EvaluatedSelection>(
                  `/api/selections/${props.item.selection.id}/evaluate`,
                  {
                    method: 'POST',
                  },
                );
                props.setMessage(providerResultMessage(sync, evaluated));
              })
            }
          >
            Refresh provider result
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <SelectInput
          label="Manual status"
          value={manualStatus}
          onChange={setManualStatus}
          options={['GREEN', 'RED', 'VOID', 'PENDING', 'MANUAL']}
        />
        <TextInput label="Reason" value={reason} onChange={setReason} />
        <button
          type="button"
          className="rounded border border-white/10 px-3 py-2 text-sm font-semibold"
          disabled={props.disabled}
          title="Force this selection to use the manual status chosen here instead of the calculated status."
          onClick={() =>
            props.onAction('Set manual override', async () => {
              await request(
                `/api/selections/${props.item.selection.id}/settlement-override`,
                {
                  method: 'PATCH',
                  body: JSON.stringify({
                    status: manualStatus,
                    reason: reason || undefined,
                  }),
                },
              );
            })
          }
        >
          Set manual override
        </button>
        <button
          type="button"
          className="rounded border border-white/10 px-3 py-2 text-sm font-semibold"
          disabled={props.disabled}
          title="Remove the manual override and return this selection to its calculated status."
          onClick={() =>
            props.onAction('Reset override', async () => {
              await request(
                `/api/selections/${props.item.selection.id}/settlement-override`,
                { method: 'DELETE' },
              );
            })
          }
        >
          Reset to automatic
        </button>
        <button
          type="button"
          className="rounded border border-white/10 px-3 py-2 text-sm font-semibold"
          disabled={props.disabled}
          title="Recalculate only this selection using the current saved fixture result and market."
          onClick={() =>
            props.onAction('Re-evaluate selection', async () => {
              await request(
                `/api/selections/${props.item.selection.id}/evaluate`,
                {
                  method: 'POST',
                },
              );
            })
          }
        >
          Re-evaluate selection
        </button>
      </div>

      <details className="rounded border border-white/10 p-3 text-sm text-slate-300">
        <summary className="cursor-pointer font-semibold text-white">
          Result timeline
        </summary>
        <div className="mt-3 grid gap-2">
          {props.item.timeline.length === 0 && <p>No result events yet.</p>}
          {props.item.timeline.map((event, index) => (
            <p key={`${event.createdAt}-${index}`}>
              {formatFixtureDateTime(event.createdAt)} |{' '}
              {event.type === 'CALCULATED'
                ? `Calculated ${event.status ?? '-'} (${event.score ?? 'no score'}, ${event.fixtureStatus ?? '-'})`
                : `Override ${event.previousStatus ?? '-'} -> ${event.newStatus ?? 'automatic'}${event.reason ? ` | ${event.reason}` : ''}`}
            </p>
          ))}
        </div>
      </details>
    </article>
  );
}

function SelectInput(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="text-sm text-slate-300">
      {props.label}
      <select
        className="mt-1 w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-white"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      >
        {props.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusBadge(props: { status: string }) {
  return (
    <span className="inline-flex rounded border border-white/10 px-2 py-1 text-xs font-semibold">
      {props.status}
    </span>
  );
}

function optionalInteger(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error('Scores and corners must be non-negative integers');
  }
  return parsed;
}

function downloadFile(url: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.rel = 'noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function providerResultMessage(
  sync: SyncResult,
  evaluated: EvaluatedSelection,
): string {
  const snapshot = evaluated.resultSnapshot;
  const score =
    snapshot.homeScore !== null && snapshot.awayScore !== null
      ? `${snapshot.homeScore}-${snapshot.awayScore}`
      : 'score unavailable';
  return `Provider refresh ${sync.status.toLowerCase()}: ${sync.updated} updated, ${sync.unresolved} unresolved, ${sync.failed} failed. Saved status ${snapshot.fixtureStatus ?? 'UNKNOWN'}, ${score}. Selection is ${evaluated.effectiveStatus}.`;
}

function CompetitionsPanel() {
  const [items, setItems] = useState<Competition[]>([]);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Competition | null>(null);
  const load = useCallback(async () => {
    const result = await request<{ items: Competition[] }>(
      `/api/competitions?search=${encodeURIComponent(search)}&active=${active}`,
    );
    setItems(result.items);
  }, [active, search]);

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, [load]);

  return (
    <CatalogSection title="Competitions" error={error}>
      <SyncPanel
        actionLabel="Refresh GOAL API competitions"
        onSync={() =>
          request<SyncResult>('/api/sync/competitions', {
            method: 'POST',
            body: JSON.stringify({
              maxPages: 100,
            }),
          })
        }
        onSynced={load}
      />
      <Toolbar
        search={search}
        setSearch={setSearch}
        active={active}
        setActive={setActive}
      />
      <CompetitionForm
        current={editing}
        onSaved={() => {
          setEditing(null);
          void load();
        }}
      />
      <div className="grid gap-3">
        {items.map((item) => (
          <CatalogCard
            key={item.id}
            title={item.name}
            subtitle={
              [item.shortName, item.countryCode, item.regionName]
                .filter(Boolean)
                .join(' | ') || 'No metadata'
            }
            active={item.active}
            onEdit={() => setEditing(item)}
            onToggle={() =>
              void request(`/api/competitions/${item.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ active: !item.active }),
              }).then(load)
            }
          />
        ))}
      </div>
    </CatalogSection>
  );
}

function CompetitionForm(props: {
  current: Competition | null;
  onSaved: () => void;
}) {
  const current = props.current;
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [regionName, setRegionName] = useState('');

  useEffect(() => {
    setName(current?.name ?? '');
    setShortName(current?.shortName ?? '');
    setCountryCode(current?.countryCode ?? '');
    setRegionName(current?.regionName ?? '');
  }, [current]);

  return (
    <EntityForm
      title={current ? 'Edit competition' : 'Create competition'}
      onSubmit={async () => {
        await request(
          current ? `/api/competitions/${current.id}` : '/api/competitions',
          {
            method: current ? 'PATCH' : 'POST',
            body: JSON.stringify({ name, shortName, countryCode, regionName }),
          },
        );
        props.onSaved();
      }}
    >
      <TextInput label="Name" value={name} onChange={setName} required />
      <TextInput label="Short name" value={shortName} onChange={setShortName} />
      <TextInput
        label="Country"
        value={countryCode}
        onChange={setCountryCode}
      />
      <TextInput label="Region" value={regionName} onChange={setRegionName} />
    </EntityForm>
  );
}

function TeamsPanel() {
  const [items, setItems] = useState<Team[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('all');
  const [competitionId, setCompetitionId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [allSyncLoading, setAllSyncLoading] = useState(false);
  const [allSyncStatus, setAllSyncStatus] = useState<string | null>(null);
  const [allSyncError, setAllSyncError] = useState<string | null>(null);
  const [allSyncResult, setAllSyncResult] = useState<SyncResult | null>(null);
  const [editing, setEditing] = useState<Team | null>(null);
  const [syncCompetitionId, setSyncCompetitionId] = useState('');
  const groupedTeams = useMemo(() => {
    const groups = new Map<string, Team[]>();
    for (const team of items) {
      const names = team.competitions.map((competition) => competition.name);
      const groupNames = names.length > 0 ? names : ['Unassigned'];
      for (const name of groupNames) {
        const group = groups.get(name) ?? [];
        group.push(team);
        groups.set(name, group);
      }
    }
    return [...groups.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    );
  }, [items]);
  const load = useCallback(async () => {
    const [teamsResult, competitionsResult] = await Promise.all([
      request<{ items: Team[] }>(
        `/api/teams?search=${encodeURIComponent(search)}&active=${active}${competitionId ? `&competitionId=${encodeURIComponent(competitionId)}` : ''}`,
      ),
      request<{ items: Competition[] }>('/api/competitions?active=all'),
    ]);
    setItems(teamsResult.items);
    setCompetitions(competitionsResult.items);
  }, [active, competitionId, search]);
  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, [load]);
  return (
    <CatalogSection title="Teams" error={error}>
      <SyncPanel
        actionLabel="Refresh selected GOAL API competition"
        disabled={!syncCompetitionId}
        onSync={() =>
          syncCompetitionId
            ? request<SyncResult>(
                `/api/sync/competitions/${syncCompetitionId}/teams`,
                {
                  method: 'POST',
                },
              )
            : Promise.reject(new Error('Select a competition first'))
        }
        onSynced={load}
      >
        <button
          type="button"
          disabled={allSyncLoading}
          className="rounded border border-studio-lime px-4 py-2 font-semibold text-studio-lime disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => {
            setAllSyncError(null);
            setAllSyncLoading(true);
            setAllSyncResult(null);
            void (async () => {
              const targets = competitions.filter(
                (competition) => competition.active,
              );
              const results: SyncResult[] = [];
              for (const [index, competition] of targets.entries()) {
                setAllSyncStatus(
                  `Syncing ${competition.name} (${index + 1}/${targets.length})...`,
                );
                try {
                  results.push(
                    await request<SyncResult>(
                      `/api/sync/competitions/${competition.id}/teams`,
                      { method: 'POST' },
                    ),
                  );
                } catch (err) {
                  setAllSyncError(
                    err instanceof Error
                      ? err.message
                      : 'Synchronization failed',
                  );
                }
              }
              setAllSyncStatus('All competitions synchronized');
              setAllSyncResult({
                status: results.some((result) => result.status !== 'SUCCESS')
                  ? 'PARTIAL'
                  : 'SUCCESS',
                processed: results.reduce(
                  (sum, result) => sum + result.processed,
                  0,
                ),
                created: results.reduce(
                  (sum, result) => sum + result.created,
                  0,
                ),
                updated: results.reduce(
                  (sum, result) => sum + result.updated,
                  0,
                ),
                unresolved: results.reduce(
                  (sum, result) => sum + result.unresolved,
                  0,
                ),
                failed: results.reduce((sum, result) => sum + result.failed, 0),
                message: null,
              });
              await load();
            })().finally(() => setAllSyncLoading(false));
          }}
        >
          {allSyncLoading
            ? 'Syncing all competitions...'
            : 'Sync all competitions'}
        </button>
        <label className="text-sm text-slate-300">
          Competition
          <select
            className="mt-1 w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-white"
            value={syncCompetitionId}
            onChange={(event) => setSyncCompetitionId(event.target.value)}
          >
            <option value="">Select competition</option>
            {competitions.map((competition) => (
              <option key={competition.id} value={competition.id}>
                {competition.name}
              </option>
            ))}
          </select>
        </label>
        {allSyncError && <p className="text-sm text-red-200">{allSyncError}</p>}
        {allSyncStatus && (
          <p className="text-sm text-slate-300">{allSyncStatus}</p>
        )}
        {allSyncResult && (
          <p className="text-sm text-slate-300">
            {allSyncResult.status}: {allSyncResult.processed} processed,{' '}
            {allSyncResult.created} created, {allSyncResult.updated} updated
          </p>
        )}
      </SyncPanel>
      <Toolbar
        search={search}
        setSearch={setSearch}
        active={active}
        setActive={setActive}
        competitions={competitions}
        competitionId={competitionId}
        setCompetitionId={setCompetitionId}
      />
      <TeamForm
        current={editing}
        competitions={competitions}
        onSaved={() => {
          setEditing(null);
          void load();
        }}
      />
      <div className="grid gap-6">
        {groupedTeams.map(([competitionName, teams]) => (
          <section key={competitionName} className="grid gap-3">
            <div className="flex items-baseline justify-between border-b border-white/10 pb-2">
              <h3 className="text-lg font-semibold">{competitionName}</h3>
              <span className="text-sm text-slate-500">
                {teams.length} {teams.length === 1 ? 'team' : 'teams'}
              </span>
            </div>
            {teams.map((item) => (
              <TeamCard
                key={`${competitionName}-${item.id}`}
                team={item}
                onEdit={() => setEditing(item)}
                onToggle={() =>
                  void request(`/api/teams/${item.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ active: !item.active }),
                  }).then(load)
                }
                onRemoveAlias={(aliasId) =>
                  void request(`/api/teams/${item.id}/aliases/${aliasId}`, {
                    method: 'DELETE',
                  }).then(load)
                }
                onRemoveCompetition={(competitionId) =>
                  void request(
                    `/api/teams/${item.id}/competitions/${competitionId}`,
                    { method: 'DELETE' },
                  ).then(load)
                }
              />
            ))}
          </section>
        ))}
      </div>
    </CatalogSection>
  );
}

function TeamForm(props: {
  current: Team | null;
  competitions: Competition[];
  onSaved: () => void;
}) {
  const current = props.current;
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [alias, setAlias] = useState('');
  const [competitionId, setCompetitionId] = useState('');
  useEffect(() => {
    setName(current?.name ?? '');
    setShortName(current?.shortName ?? '');
    setCountryCode(current?.countryCode ?? '');
  }, [current]);
  return (
    <EntityForm
      title={current ? 'Edit team' : 'Create team'}
      onSubmit={async () => {
        const team = await request<Team>(
          current ? `/api/teams/${current.id}` : '/api/teams',
          {
            method: current ? 'PATCH' : 'POST',
            body: JSON.stringify({ name, shortName, countryCode }),
          },
        );
        if (alias)
          await request(`/api/teams/${team.id}/aliases`, {
            method: 'POST',
            body: JSON.stringify({ value: alias }),
          });
        if (competitionId)
          await request(`/api/teams/${team.id}/competitions/${competitionId}`, {
            method: 'POST',
          });
        setAlias('');
        setCompetitionId('');
        props.onSaved();
      }}
    >
      <TextInput label="Name" value={name} onChange={setName} required />
      <TextInput label="Short name" value={shortName} onChange={setShortName} />
      <TextInput
        label="Country"
        value={countryCode}
        onChange={setCountryCode}
      />
      <TextInput label="Add alias" value={alias} onChange={setAlias} />
      <label className="text-sm text-slate-300">
        Assign competition
        <select
          className="mt-1 w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-white"
          value={competitionId}
          onChange={(event) => setCompetitionId(event.target.value)}
        >
          <option value="">None</option>
          {props.competitions.map((competition) => (
            <option key={competition.id} value={competition.id}>
              {competition.name}
            </option>
          ))}
        </select>
      </label>
    </EntityForm>
  );
}

function MarketsPanel() {
  const [items, setItems] = useState<Market[]>([]);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Market | null>(null);
  const load = useCallback(
    async () =>
      setItems(
        (
          await request<{ items: Market[] }>(
            `/api/markets?search=${encodeURIComponent(search)}&active=${active}`,
          )
        ).items,
      ),
    [active, search],
  );
  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, [load]);
  return (
    <CatalogSection title="Markets" error={error}>
      <Toolbar
        search={search}
        setSearch={setSearch}
        active={active}
        setActive={setActive}
      />
      <MarketForm
        current={editing}
        onSaved={() => {
          setEditing(null);
          void load();
        }}
      />
      <div className="grid gap-3">
        {items.map((item) => (
          <CatalogCard
            key={item.id}
            title={item.name}
            subtitle={`${item.code} | ${item.autoEvaluable ? item.evaluatorKey : 'Manual'}`}
            active={item.active}
            onEdit={() => setEditing(item)}
            onToggle={() =>
              void request(`/api/markets/${item.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ active: !item.active }),
              }).then(load)
            }
          />
        ))}
      </div>
    </CatalogSection>
  );
}

function MarketForm(props: { current: Market | null; onSaved: () => void }) {
  const current = props.current;
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [autoEvaluable, setAutoEvaluable] = useState(false);
  const [evaluatorKey, setEvaluatorKey] = useState('TOTAL_GOALS');
  const [line, setLine] = useState('2.5');
  const [choice, setChoice] = useState('OVER');
  useEffect(() => {
    setCode(current?.code ?? '');
    setName(current?.name ?? '');
    setCategory(current?.category ?? '');
    setAutoEvaluable(current?.autoEvaluable ?? false);
    setEvaluatorKey(current?.evaluatorKey ?? 'TOTAL_GOALS');
    setChoice(defaultChoice(current?.evaluatorKey ?? 'TOTAL_GOALS'));
  }, [current]);
  const parameters = useMemo(() => {
    if (evaluatorKey === 'MATCH_RESULT') return { result: choice };
    if (evaluatorKey === 'DOUBLE_CHANCE') return { outcome: choice };
    if (evaluatorKey === 'BTTS') return { selection: choice };
    if (evaluatorKey === 'COMPOSITE')
      return {
        operator: 'AND',
        conditions: [
          { evaluatorKey: 'MATCH_RESULT', parameters: { result: 'HOME' } },
          {
            evaluatorKey: 'TOTAL_GOALS',
            parameters: { direction: 'OVER', line: 1.5 },
          },
        ],
      };
    return { direction: choice, line: Number(line) };
  }, [choice, evaluatorKey, line]);
  return (
    <EntityForm
      title={current ? 'Edit market' : 'Create market'}
      onSubmit={async () => {
        await request(current ? `/api/markets/${current.id}` : '/api/markets', {
          method: current ? 'PATCH' : 'POST',
          body: JSON.stringify({
            code,
            name,
            category,
            autoEvaluable,
            evaluatorKey: autoEvaluable ? evaluatorKey : null,
            parameters: autoEvaluable ? parameters : null,
          }),
        });
        if (!current) {
          setCode('');
          setName('');
          setCategory('');
          setAutoEvaluable(false);
          setEvaluatorKey('TOTAL_GOALS');
          setLine('2.5');
          setChoice('OVER');
        }
        props.onSaved();
      }}
    >
      <TextInput
        label="Code"
        value={code}
        onChange={(value) =>
          setCode(value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))
        }
        required
      />
      <TextInput label="Name" value={name} onChange={setName} required />
      <TextInput label="Category" value={category} onChange={setCategory} />
      <label className="flex items-center gap-2 text-sm text-slate-200">
        <input
          type="checkbox"
          checked={autoEvaluable}
          onChange={(event) => setAutoEvaluable(event.target.checked)}
        />
        Auto evaluation
      </label>
      {autoEvaluable && (
        <>
          <label className="text-sm text-slate-300">
            Evaluator
            <select
              className="mt-1 w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-white"
              value={evaluatorKey}
              onChange={(event) => {
                const value = event.target.value;
                setEvaluatorKey(value);
                setChoice(defaultChoice(value));
              }}
            >
              <option value="MATCH_RESULT">Match Result</option>
              <option value="TOTAL_GOALS">Total Goals</option>
              <option value="DOUBLE_CHANCE">Double Chance</option>
              <option value="BTTS">Both Teams To Score</option>
              <option value="TOTAL_CORNERS">Total Corners</option>
              <option value="COMPOSITE">Composite</option>
            </select>
          </label>
          {evaluatorKey !== 'COMPOSITE' && (
            <ChoiceSelect
              evaluatorKey={evaluatorKey}
              value={choice}
              onChange={setChoice}
            />
          )}
          {evaluatorKey === 'TOTAL_GOALS' && (
            <LineSelect
              label="Line"
              values={['0.5', '1.5', '2.5', '3.5', '4.5']}
              value={line}
              onChange={setLine}
            />
          )}
          {evaluatorKey === 'TOTAL_CORNERS' && (
            <LineSelect
              label="Line"
              values={['7.5', '8.5', '9.5', '10.5', '11.5']}
              value={line}
              onChange={setLine}
            />
          )}
        </>
      )}
    </EntityForm>
  );
}

function FixturesPanel() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  return (
    <CatalogSection title="Fixtures" error={null}>
      <SyncPanel
        actionLabel="Refresh GOAL API fixtures"
        onSync={() =>
          request<SyncResult>('/api/sync/fixtures', {
            method: 'POST',
            body: JSON.stringify({ date }),
          })
        }
      >
        <TextInput label="Date" value={date} onChange={setDate} required />
      </SyncPanel>
    </CatalogSection>
  );
}

function SettlementPanel() {
  const [selectionId, setSelectionId] = useState('');
  const [bulletinId, setBulletinId] = useState('');
  const [overrideStatus, setOverrideStatus] = useState('GREEN');
  const [overrideReason, setOverrideReason] = useState('');
  const [selectionResult, setSelectionResult] =
    useState<EvaluatedSelection | null>(null);
  const [bulletinResult, setBulletinResult] =
    useState<BulletinEvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setError(null);
    await action().catch((err: Error) => setError(err.message));
  }

  return (
    <CatalogSection title="Settlement" error={error}>
      <section className="grid gap-4 rounded border border-white/10 bg-studio-panel p-4 md:grid-cols-3">
        <TextInput
          label="Selection ID"
          value={selectionId}
          onChange={setSelectionId}
        />
        <label className="text-sm text-slate-300">
          Manual status
          <select
            className="mt-1 w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-white"
            value={overrideStatus}
            onChange={(event) => setOverrideStatus(event.target.value)}
          >
            {['GREEN', 'RED', 'VOID', 'PENDING', 'MANUAL'].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <TextInput
          label="Reason"
          value={overrideReason}
          onChange={setOverrideReason}
        />
        <div className="flex flex-wrap gap-2 md:col-span-3">
          <button
            type="button"
            className="rounded bg-studio-lime px-4 py-2 font-semibold text-black"
            onClick={() =>
              void run(async () => {
                setSelectionResult(
                  await request<EvaluatedSelection>(
                    `/api/selections/${selectionId}/evaluate`,
                    { method: 'POST' },
                  ),
                );
              })
            }
          >
            Re-evaluate selection
          </button>
          <button
            type="button"
            className="rounded border border-white/10 px-4 py-2 font-semibold text-slate-200"
            onClick={() =>
              void run(async () => {
                setSelectionResult(
                  await request<EvaluatedSelection>(
                    `/api/selections/${selectionId}/settlement-override`,
                    {
                      method: 'PATCH',
                      body: JSON.stringify({
                        status: overrideStatus,
                        reason: overrideReason || undefined,
                      }),
                    },
                  ),
                );
              })
            }
          >
            Set manual override
          </button>
          <button
            type="button"
            className="rounded border border-white/10 px-4 py-2 font-semibold text-slate-200"
            onClick={() =>
              void run(async () => {
                setSelectionResult(
                  await request<EvaluatedSelection>(
                    `/api/selections/${selectionId}/settlement-override`,
                    { method: 'DELETE' },
                  ),
                );
              })
            }
          >
            Reset to automatic
          </button>
        </div>
      </section>
      <section className="grid gap-4 rounded border border-white/10 bg-studio-panel p-4 md:grid-cols-[1fr_auto]">
        <TextInput
          label="Bulletin ID"
          value={bulletinId}
          onChange={setBulletinId}
        />
        <button
          type="button"
          className="self-end rounded bg-studio-lime px-4 py-2 font-semibold text-black"
          onClick={() =>
            void run(async () => {
              setBulletinResult(
                await request<BulletinEvaluationResult>(
                  `/api/bulletins/${bulletinId}/evaluate`,
                  { method: 'POST' },
                ),
              );
            })
          }
        >
          Re-evaluate bulletin
        </button>
      </section>
      {selectionResult && <SettlementResultCard result={selectionResult} />}
      {bulletinResult && (
        <section className="grid gap-3 rounded border border-white/10 bg-black/20 p-4">
          <h3 className="font-semibold">
            Bulletin status: {bulletinResult.status}
          </h3>
          {bulletinResult.selections.map((selection) => (
            <SettlementResultCard
              key={selection.selectionId}
              result={selection}
            />
          ))}
        </section>
      )}
    </CatalogSection>
  );
}

function SettlementResultCard(props: { result: EvaluatedSelection }) {
  return (
    <article className="grid gap-2 rounded border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
      <h3 className="font-semibold text-white">{props.result.selectionId}</h3>
      <p>Calculated: {props.result.calculatedStatus}</p>
      <p>Manual override: {props.result.manualStatus ?? 'None'}</p>
      <p>Effective: {props.result.effectiveStatus}</p>
      <p>
        Engine: {props.result.result.evaluatorKey ?? 'N/A'}@
        {props.result.result.evaluatorVersion ?? 'N/A'} |{' '}
        {props.result.result.reasonCode}
      </p>
    </article>
  );
}

function SyncPanel(props: {
  actionLabel: string;
  children?: React.ReactNode;
  disabled?: boolean;
  onSync: () => Promise<SyncResult>;
  onSynced?: () => Promise<void>;
}) {
  const [provider, setProvider] = useState<ProviderStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void request<ProviderStatus | null>('/api/providers/goal/status')
      .then(setProvider)
      .catch(() => setProvider(null));
  }, []);

  return (
    <section className="grid gap-3 rounded border border-white/10 bg-studio-panel p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className="font-semibold">GOAL API</h3>
          <p className="mt-1 text-sm text-slate-400">
            {provider?.configured
              ? `Available${provider.lastSuccessfulSyncAt ? ` | Last sync ${provider.lastSuccessfulSyncAt}` : ''}`
              : 'Not configured'}
          </p>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          {props.children}
          <button
            type="button"
            disabled={loading || props.disabled}
            className="rounded bg-studio-lime px-4 py-2 font-semibold text-black disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
            onClick={() => {
              setLoading(true);
              setError(null);
              void props
                .onSync()
                .then(async (nextResult) => {
                  setResult(nextResult);
                  await props.onSynced?.();
                })
                .catch((err: Error) => setError(err.message))
                .finally(() => setLoading(false));
            }}
          >
            {loading ? 'Refreshing' : props.actionLabel}
          </button>
        </div>
      </div>
      {result && (
        <p className="text-sm text-slate-300">
          {result.status}: {result.processed} processed, {result.created}{' '}
          created, {result.updated} updated, {result.unresolved} unresolved,{' '}
          {result.failed} failed
        </p>
      )}
      {error && <p className="text-sm text-red-200">{error}</p>}
    </section>
  );
}

function defaultChoice(evaluatorKey: string): string {
  if (evaluatorKey === 'MATCH_RESULT') return 'HOME';
  if (evaluatorKey === 'DOUBLE_CHANCE') return '1X';
  if (evaluatorKey === 'BTTS') return 'YES';
  return 'OVER';
}

function ChoiceSelect(props: {
  evaluatorKey: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const options =
    props.evaluatorKey === 'MATCH_RESULT'
      ? ['HOME', 'DRAW', 'AWAY']
      : props.evaluatorKey === 'DOUBLE_CHANCE'
        ? ['1X', 'X2', '12']
        : props.evaluatorKey === 'BTTS'
          ? ['YES', 'NO']
          : ['OVER', 'UNDER'];

  return (
    <label className="text-sm text-slate-300">
      Selection
      <select
        className="mt-1 w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-white"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function LineSelect(props: {
  label: string;
  values: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm text-slate-300">
      {props.label}
      <select
        className="mt-1 w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-white"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      >
        {props.values.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </label>
  );
}

function CatalogSection(props: {
  title: string;
  error: string | null;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-6 py-8">
      <h2 className="text-2xl font-semibold">{props.title}</h2>
      {props.error && (
        <p className="rounded border border-red-400/40 bg-red-950/40 p-3 text-sm text-red-100">
          {props.error}
        </p>
      )}
      {props.children}
    </section>
  );
}

function EntityForm(props: {
  title: string;
  children: React.ReactNode;
  onSubmit: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="grid gap-4 rounded border border-white/10 bg-studio-panel p-4 md:grid-cols-4"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        setError(null);
        void props.onSubmit().catch((err: Error) => setError(err.message));
      }}
    >
      <h3 className="text-lg font-semibold md:col-span-4">{props.title}</h3>
      {props.children}
      {error && <p className="text-sm text-red-200 md:col-span-4">{error}</p>}
      <button
        className="rounded bg-studio-lime px-4 py-2 font-semibold text-black focus:outline focus:outline-2 focus:outline-white"
        type="submit"
      >
        Save
      </button>
    </form>
  );
}

function TextInput(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="text-sm text-slate-300">
      {props.label}
      <input
        required={props.required}
        className="mt-1 w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-white"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  );
}

function CatalogCard(props: {
  title: string;
  subtitle: string;
  active: boolean;
  onEdit: () => void;
  onToggle: () => void;
}) {
  return (
    <article className="flex items-center justify-between gap-4 rounded border border-white/10 bg-black/20 p-4">
      <div>
        <h3 className="font-semibold">{props.title}</h3>
        <p className="mt-1 text-sm text-slate-400">{props.subtitle}</p>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`text-xs font-semibold ${props.active ? 'text-studio-lime' : 'text-slate-500'}`}
        >
          {props.active ? 'Active' : 'Inactive'}
        </span>
        <button
          type="button"
          className="rounded border border-white/10 px-3 py-2 text-sm"
          onClick={props.onEdit}
        >
          Edit
        </button>
        <button
          type="button"
          className="rounded border border-white/10 px-3 py-2 text-sm"
          onClick={props.onToggle}
        >
          {props.active ? 'Deactivate' : 'Activate'}
        </button>
      </div>
    </article>
  );
}

function TeamCard(props: {
  team: Team;
  onEdit: () => void;
  onToggle: () => void;
  onRemoveAlias: (aliasId: string) => void;
  onRemoveCompetition: (competitionId: string) => void;
}) {
  return (
    <article className="grid gap-4 rounded border border-white/10 bg-black/20 p-4 md:grid-cols-[1fr_auto]">
      <div className="grid gap-3">
        <div>
          <h3 className="font-semibold">{props.team.name}</h3>
          <p className="mt-1 text-sm text-slate-400">
            {[props.team.shortName, props.team.countryCode]
              .filter(Boolean)
              .join(' | ') || 'No metadata'}
          </p>
        </div>
        <TokenList
          title="Aliases"
          empty="No aliases"
          items={props.team.aliases.map((alias) => ({
            id: alias.id,
            label: alias.value,
          }))}
          onRemove={props.onRemoveAlias}
        />
        <TokenList
          title="Competitions"
          empty="No competitions"
          items={props.team.competitions.map((competition) => ({
            id: competition.id,
            label: competition.name,
          }))}
          onRemove={props.onRemoveCompetition}
        />
      </div>
      <div className="flex items-start gap-2">
        <span
          className={`pt-2 text-xs font-semibold ${props.team.active ? 'text-studio-lime' : 'text-slate-500'}`}
        >
          {props.team.active ? 'Active' : 'Inactive'}
        </span>
        <button
          type="button"
          className="rounded border border-white/10 px-3 py-2 text-sm"
          onClick={props.onEdit}
        >
          Edit
        </button>
        <button
          type="button"
          className="rounded border border-white/10 px-3 py-2 text-sm"
          onClick={props.onToggle}
        >
          {props.team.active ? 'Deactivate' : 'Activate'}
        </button>
      </div>
    </article>
  );
}

function TokenList(props: {
  title: string;
  empty: string;
  items: Array<{ id: string; label: string }>;
  onRemove: (id: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-slate-500">
        {props.title}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {props.items.length === 0 && (
          <span className="text-sm text-slate-500">{props.empty}</span>
        )}
        {props.items.map((item) => (
          <span
            key={item.id}
            className="inline-flex items-center gap-2 rounded border border-white/10 px-2 py-1 text-sm text-slate-200"
          >
            {item.label}
            <button
              type="button"
              className="text-slate-400 hover:text-white"
              onClick={() => props.onRemove(item.id)}
            >
              Remove
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
