"use client";

import { Bot, ChevronDown, ChevronUp, FlaskConical, Loader2, Play, RefreshCw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useKnowledgeFoldersStore } from "@/lib/pcdi/knowledge-folders-store";
import { getDefaultPromptForResponseStrategy } from "@/lib/pcdi/response-strategy-default-prompts";
import { useResponseAgentsStore, type ResponseStrategyAgent } from "@/lib/pcdi/response-agents-store";
import {
  createResponseAgentOnApi,
  deleteResponseAgentOnApi,
  updateResponseAgentOnApi,
} from "@/lib/pcdi/sync-response-agents-from-api";
import { generateDefectResponseForAgentTest } from "@/lib/pcdi/generate-defect-response";
import { useKnowledgeFoldersSync } from "@/lib/pcdi/use-knowledge-folders-sync";
import { useResponseAgentsSync } from "@/lib/pcdi/use-response-agents-sync";
import { VISUALISATION_STRATEGY_OPTIONS } from "@/lib/pcdi/live-visualisation-strategies";
import { useLiveSelectedProjectStore } from "@/lib/pcdi/live-selected-project-store";

const STRATEGY_OPTIONS = VISUALISATION_STRATEGY_OPTIONS as readonly string[];

function isKnownStrategy(s: string): boolean {
  return STRATEGY_OPTIONS.includes(s);
}

function StrategyDropdown({
  id,
  value,
  onChange,
  emptyLabel,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  emptyLabel: string;
  disabled?: boolean;
}) {
  return (
    <select
      id={id}
      value={isKnownStrategy(value) ? value : value ? "__legacy__" : ""}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "__legacy__") return;
        onChange(v);
      }}
      disabled={disabled}
      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
    >
      <option value="">{emptyLabel}</option>
      {value && !isKnownStrategy(value) ? (
        <option value="__legacy__">{value} (saved)</option>
      ) : null}
      {STRATEGY_OPTIONS.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

function StrategyDropdownEdit({
  id,
  value,
  onChange,
  onStrategyChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  /** Called when user picks a new taxonomy strategy (may reset prompt to default). */
  onStrategyChange: (v: string) => void;
  disabled?: boolean;
}) {
  const legacy = value && !isKnownStrategy(value);
  return (
    <select
      id={id}
      value={legacy ? "__legacy__" : value}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "__legacy__") return;
        onChange(v);
        onStrategyChange(v);
      }}
      disabled={disabled}
      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
    >
      {legacy ? (
        <option value="__legacy__">{value} (saved)</option>
      ) : (
        <option value="">Choose response strategy…</option>
      )}
      {STRATEGY_OPTIONS.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

export function ResponseAgentsView() {
  const projectId = useLiveSelectedProjectStore((s) => s.selectedProjectId);
  const { loading: foldersLoading } = useKnowledgeFoldersSync(projectId);
  const { loading: agentsLoading, error: syncError, refresh } = useResponseAgentsSync(projectId);

  const foldersAll = useKnowledgeFoldersStore((s) => s.folders);
  const documentsAll = useKnowledgeFoldersStore((s) => s.documents);
  const folders = useMemo(
    () => foldersAll.filter((f) => projectId && f.projectId === projectId),
    [foldersAll, projectId],
  );
  const indexedDocCountByFolderId = useMemo(() => {
    const counts = new Map<string, number>();
    if (!projectId) return counts;
    for (const doc of documentsAll) {
      if (doc.source !== "pdf" || doc.status !== "active") continue;
      const folder = foldersAll.find((f) => f.id === doc.folderId);
      if (!folder || folder.projectId !== projectId) continue;
      counts.set(doc.folderId, (counts.get(doc.folderId) ?? 0) + 1);
    }
    return counts;
  }, [documentsAll, foldersAll, projectId]);
  const agentsAll = useResponseAgentsStore((s) => s.agents);
  const agents = useMemo(
    () => agentsAll.filter((a) => projectId && a.projectId === projectId),
    [agentsAll, projectId],
  );

  const [strategy, setStrategy] = useState("");
  const [prompt, setPrompt] = useState("");
  const [folderId, setFolderId] = useState("");
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const folderOptions = useMemo(() => {
    const opts = folders.map((f) => ({ id: f.id, label: f.name }));
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [folders]);

  const loading = foldersLoading || agentsLoading;
  const displayError = actionError ?? syncError;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    const s = strategy.trim();
    const p = prompt.trim();
    const fid = folderId.trim();
    if (!s || !p || !fid) return;

    setCreating(true);
    setActionError(null);
    const result = await createResponseAgentOnApi({
      projectId,
      knowledgeFolderId: fid,
      userChosenResponseStrategy: s,
      prompt: p,
    });
    setCreating(false);
    if (!result.ok) {
      setActionError(result.error ?? "Could not save agent.");
      return;
    }
    setStrategy("");
    setPrompt("");
    setFolderId("");
  };

  const folderLabel = (id: string) => folders.find((f) => f.id === id)?.name ?? "Unknown folder";

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl">
      <header className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Response strategy agents</h1>
            <p className="mt-2 max-w-prose text-sm text-foreground-muted">
              Map each response strategy to instructions and a knowledge folder. Defaults are filled when you pick a
              strategy; edit the prompt before saving — the saved text is stored on the analysis server.
            </p>
          </div>
          {projectId ? (
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-muted/80 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
              Refresh
            </button>
          ) : null}
        </div>
        {displayError ? (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200">
            {displayError}
          </p>
        ) : null}
      </header>

      {!projectId ? (
        <p className="mb-8 rounded-lg border border-dashed border-border bg-surface-muted/40 px-4 py-8 text-center text-sm text-foreground-muted">
          Choose a project from the sidebar selector to manage response agents for that project.
        </p>
      ) : null}

      {projectId ? (
        <>
          <form
            onSubmit={onSubmit}
            className="mb-10 space-y-4 rounded-xl border border-border bg-surface p-5 shadow-sm"
          >
            <div>
              <label
                htmlFor="agent-strategy"
                className="mb-1 block text-xs font-medium uppercase tracking-wide text-foreground-muted"
              >
                Choose response strategy
              </label>
              <StrategyDropdown
                id="agent-strategy"
                value={strategy}
                onChange={(v) => {
                  setStrategy(v);
                  setPrompt(getDefaultPromptForResponseStrategy(v));
                }}
                emptyLabel="Choose response strategy…"
                disabled={creating}
              />
            </div>
            <div>
              <label
                htmlFor="agent-prompt"
                className="mb-1 block text-xs font-medium uppercase tracking-wide text-foreground-muted"
              >
                Instruction / agent prompt
              </label>
              <textarea
                id="agent-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe tone, structure, mandatory clauses, and how to use retrieved context…"
                rows={6}
                disabled={creating}
                className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
              />
            </div>
            <div>
              <label
                htmlFor="agent-folder"
                className="mb-1 block text-xs font-medium uppercase tracking-wide text-foreground-muted"
              >
                Knowledge folder
              </label>
              <select
                id="agent-folder"
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                disabled={creating || foldersLoading}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
              >
                <option value="">Select a folder…</option>
                {folderOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              {folderOptions.length === 0 && !foldersLoading ? (
                <p className="mt-2 text-xs text-foreground-muted">
                  Create a folder under{" "}
                  <a href="/knowledge-folders" className="text-accent underline underline-offset-2 hover:no-underline">
                    Knowledge folders
                  </a>{" "}
                  first.
                </p>
              ) : null}
            </div>
            <button
              type="submit"
              disabled={creating || !strategy.trim() || !prompt.trim() || !folderId}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Bot className="h-4 w-4" aria-hidden />
              )}
              Save agent
            </button>
          </form>

          <section aria-labelledby="agents-list-title">
            <h2
              id="agents-list-title"
              className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground-muted"
            >
              Your agents
            </h2>
            {loading && agents.length === 0 ? (
              <p className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface-muted/40 px-4 py-8 text-sm text-foreground-muted">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Loading agents…
              </p>
            ) : agents.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-surface-muted/40 px-4 py-8 text-center text-sm text-foreground-muted">
                No agents yet. Choose a response strategy, add instructions, and link a folder above.
              </p>
            ) : (
              <ul className="space-y-4">
                {agents
                  .slice()
                  .sort((a, b) => b.updatedAt - a.updatedAt)
                  .map((agent) => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      folderLabel={folderLabel(agent.knowledgeFolderId)}
                      folderOptions={folderOptions}
                      knowledgeId={
                        folders.find((f) => f.id === agent.knowledgeFolderId)?.knowledgeId ??
                        agent.knowledgeFolderId
                      }
                      indexedDocCount={indexedDocCountByFolderId.get(agent.knowledgeFolderId) ?? 0}
                      onError={setActionError}
                    />
                  ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function AgentCard({
  agent,
  folderLabel,
  folderOptions,
  knowledgeId,
  indexedDocCount,
  onError,
}: {
  agent: ResponseStrategyAgent;
  folderLabel: string;
  folderOptions: { id: string; label: string }[];
  knowledgeId: string;
  indexedDocCount: number;
  onError: (msg: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [localStrategy, setLocalStrategy] = useState(agent.name);
  const [localPrompt, setLocalPrompt] = useState(agent.prompt);
  const [localFolder, setLocalFolder] = useState(agent.knowledgeFolderId);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const save = async () => {
    setSaving(true);
    onError(null);
    const result = await updateResponseAgentOnApi(agent, {
      name: localStrategy,
      prompt: localPrompt,
      knowledgeFolderId: localFolder,
    });
    setSaving(false);
    if (!result.ok) {
      onError(result.error ?? "Could not update agent.");
      return;
    }
    setEditing(false);
  };

  const remove = async () => {
    if (!window.confirm(`Remove this agent for “${agent.name}”?`)) return;
    setDeleting(true);
    onError(null);
    const result = await deleteResponseAgentOnApi(agent.id);
    setDeleting(false);
    if (!result.ok) {
      onError(result.error ?? "Could not delete agent.");
    }
  };

  const cancel = () => {
    setLocalStrategy(agent.name);
    setLocalPrompt(agent.prompt);
    setLocalFolder(agent.knowledgeFolderId);
    setEditing(false);
  };

  const busy = saving || deleting;

  return (
    <li className="min-w-0 rounded-xl border border-border bg-surface p-4 shadow-sm">
      {!editing ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-base font-semibold leading-snug text-foreground">{agent.name}</h3>
              <p className="mt-1 text-xs text-foreground-muted">
                Folder: <span className="text-foreground">{folderLabel}</span>
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => setEditing(true)}
                disabled={busy}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-surface-muted disabled:opacity-50"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => void remove()}
                disabled={busy}
                className="rounded-lg p-2 text-foreground-muted transition hover:bg-red-500/10 hover:text-red-700 disabled:opacity-50"
                aria-label="Remove agent"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-border-subtle bg-surface-muted/50 p-3 text-xs leading-relaxed text-foreground">
            {agent.prompt}
          </pre>
          <AgentTestPanel
            agent={agent}
            folderLabel={folderLabel}
            knowledgeId={knowledgeId}
            indexedDocCount={indexedDocCount}
          />
        </>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-foreground-muted">
              Choose response strategy
            </label>
            <StrategyDropdownEdit
              id={`edit-strategy-${agent.id}`}
              value={localStrategy}
              onChange={setLocalStrategy}
              onStrategyChange={(v) => setLocalPrompt(getDefaultPromptForResponseStrategy(v))}
              disabled={busy}
            />
          </div>
          <textarea
            value={localPrompt}
            onChange={(e) => setLocalPrompt(e.target.value)}
            rows={5}
            disabled={busy}
            className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => setLocalPrompt(getDefaultPromptForResponseStrategy(localStrategy))}
            disabled={busy || !localStrategy.trim()}
            className="text-xs font-medium text-accent underline-offset-2 hover:underline disabled:opacity-50"
          >
            Reset prompt to default for this strategy
          </button>
          <select
            value={localFolder}
            onChange={(e) => setLocalFolder(e.target.value)}
            disabled={busy}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none disabled:opacity-60"
          >
            {!folderOptions.some((o) => o.id === localFolder) && localFolder ? (
              <option value={localFolder}>Folder removed — pick another</option>
            ) : null}
            {folderOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy || !localStrategy.trim() || !localPrompt.trim() || !localFolder}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function AgentTestPanel({
  agent,
  folderLabel,
  knowledgeId,
  indexedDocCount,
}: {
  agent: ResponseStrategyAgent;
  folderLabel: string;
  knowledgeId: string;
  indexedDocCount: number;
}) {
  const folderId = agent.knowledgeFolderId;
  const documentsAll = useKnowledgeFoldersStore((s) => s.documents);
  const [open, setOpen] = useState(false);
  const [claim, setClaim] = useState("");
  const [generating, setGenerating] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [references, setReferences] = useState<
    { fileName: string; pageNo?: number; excerpt: string }[]
  >([]);
  const [modeLabel, setModeLabel] = useState<string | null>(null);

  const indexingDocs = useMemo(
    () =>
      documentsAll.filter(
        (d) =>
          d.folderId === folderId &&
          (d.status === "uploading" || d.status === "parsing"),
      ).length,
    [documentsAll, folderId],
  );
  const referenceFileIds = useMemo(
    () =>
      documentsAll
        .filter((d) => d.folderId === folderId && d.source === "pdf" && d.status === "active")
        .map((d) => d.id),
    [documentsAll, folderId],
  );
  const activeDocs = indexedDocCount;

  const onGenerate = async () => {
    setGenerating(true);
    setTestError(null);
    setAnswer(null);
    setReferences([]);
    setModeLabel(null);

    const outcome = await generateDefectResponseForAgentTest({
      defectClaim: claim,
      knowledgeId,
      strategy: agent.name,
      prompt: agent.prompt,
    });

    setGenerating(false);
    if (!outcome.ok) {
      setTestError(outcome.error);
      return;
    }
    setAnswer(outcome.result.answer);
    setReferences(outcome.result.references);
    setModeLabel(outcome.mode === "mock" ? "Demo mode" : "generate-response");
  };

  const reset = () => {
    setClaim("");
    setAnswer(null);
    setReferences([]);
    setTestError(null);
    setModeLabel(null);
  };

  return (
    <div className="mt-4 min-w-0 border-t border-[var(--border-subtle)] pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-w-0 items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-left text-sm font-semibold text-foreground transition hover:bg-surface-muted/60"
        aria-expanded={open}
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <FlaskConical className="h-4 w-4 shrink-0 text-accent" aria-hidden />
          Test this agent
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-foreground-muted" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-foreground-muted" aria-hidden />
        )}
      </button>

      {open ? (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-foreground-muted">
            Paste a defect claim. The draft uses this agent&apos;s saved prompt and retrieves context from{" "}
            <span className="font-medium text-foreground">{folderLabel}</span>
            {activeDocs > 0
              ? ` (${activeDocs} indexed PDF${activeDocs === 1 ? "" : "s"}).`
              : indexingDocs > 0
                ? " (reference files still indexing — results may be thin)."
                : " (upload PDFs under Knowledge folders for grounded citations)."}
          </p>
          <label className="block">
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-foreground-muted">
              Defect claim
            </span>
            <textarea
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
              placeholder="Paste the notifier’s defect description, location, and any cited standards…"
              rows={4}
              disabled={generating}
              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onGenerate()}
              disabled={generating || !claim.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Play className="h-3.5 w-3.5" aria-hidden />
              )}
              {generating ? "Generating…" : "Generate response"}
            </button>
            {(answer || testError) && !generating ? (
              <button
                type="button"
                onClick={reset}
                className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-muted"
              >
                Clear
              </button>
            ) : null}
          </div>
          {testError ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-800 dark:text-red-200">
              {testError}
            </p>
          ) : null}
          {answer ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-surface-muted/40 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                    Generated response
                  </h4>
                  {modeLabel ? (
                    <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-foreground-muted">
                      {modeLabel}
                    </span>
                  ) : null}
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{answer}</p>
              </div>
              {references.length > 0 ? (
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                    Retrieved references
                  </h4>
                  <ul className="space-y-2">
                    {references.map((ref, i) => (
                      <li
                        key={`${ref.fileName}-${i}`}
                        className="rounded-lg border border-border bg-background p-3 text-xs"
                      >
                        <p className="font-semibold text-foreground">
                          {ref.fileName}
                          {typeof ref.pageNo === "number" ? ` · p.${ref.pageNo}` : ""}
                        </p>
                        <p className="mt-1 leading-relaxed text-foreground-muted">{ref.excerpt}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
