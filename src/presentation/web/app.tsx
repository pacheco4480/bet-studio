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

type Tab = 'competitions' | 'teams' | 'markets';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Request failed');
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function App() {
  const [tab, setTab] = useState<Tab>('competitions');

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
            {(['competitions', 'teams', 'markets'] as const).map((item) => (
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
        {tab === 'teams' && <TeamsPanel />}
        {tab === 'markets' && <MarketsPanel />}
      </div>
    </main>
  );
}

function Toolbar(props: {
  search: string;
  setSearch: (value: string) => void;
  active: string;
  setActive: (value: string) => void;
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
    </div>
  );
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
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Team | null>(null);
  const load = useCallback(async () => {
    const [teamsResult, competitionsResult] = await Promise.all([
      request<{ items: Team[] }>(
        `/api/teams?search=${encodeURIComponent(search)}&active=${active}`,
      ),
      request<{ items: Competition[] }>('/api/competitions?active=all'),
    ]);
    setItems(teamsResult.items);
    setCompetitions(competitionsResult.items);
  }, [active, search]);
  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, [load]);
  return (
    <CatalogSection title="Teams" error={error}>
      <Toolbar
        search={search}
        setSearch={setSearch}
        active={active}
        setActive={setActive}
      />
      <TeamForm
        current={editing}
        competitions={competitions}
        onSaved={() => {
          setEditing(null);
          void load();
        }}
      />
      <div className="grid gap-3">
        {items.map((item) => (
          <TeamCard
            key={item.id}
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
                {
                  method: 'DELETE',
                },
              ).then(load)
            }
          />
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
