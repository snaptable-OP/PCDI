"use client";

import { Bot, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useKnowledgeFoldersStore } from "@/lib/pcdi/knowledge-folders-store";
import { getDefaultPromptForResponseStrategy } from "@/lib/pcdi/response-strategy-default-prompts";
import { useResponseAgentsStore, type ResponseStrategyAgent } from "@/lib/pcdi/response-agents-store";
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
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  /** Shown as first option when value may be empty */
  emptyLabel: string;
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
      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
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

/** Edit mode: value must always be a real strategy or legacy string — no empty placeholder row when editing legacy */
function StrategyDropdownEdit({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
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
      }}
      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
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
  const foldersAll = useKnowledgeFoldersStore((s) => s.folders);
  const folders = useMemo(
    () => foldersAll.filter((f) => projectId && f.projectId === projectId),
    [foldersAll, projectId],
  );
  const agentsAll = useResponseAgentsStore((s) => s.agents);
  const agents = useMemo(
    () => agentsAll.filter((a) => projectId && a.projectId === projectId),
    [agentsAll, projectId],
  );
  const addAgent = useResponseAgentsStore((s) => s.addAgent);
  const updateAgent = useResponseAgentsStore((s) => s.updateAgent);
  const removeAgent = useResponseAgentsStore((s) => s.removeAgent);

  const [strategy, setStrategy] = useState("");
  const [prompt, setPrompt] = useState("");
  const [folderId, setFolderId] = useState("");

  const folderOptions = useMemo(() => {
    const opts = folders.map((f) => ({ id: f.id, label: f.name }));
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [folders]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const s = strategy.trim();
    const p = prompt.trim();
    const fid = folderId.trim();
    if (!projectId || !s || !p || !fid) return;
    addAgent({ projectId, name: s, prompt: p, knowledgeFolderId: fid });
    setStrategy("");
    setPrompt("");
    setFolderId("");
  };

  const folderLabel = (id: string) => folders.find((f) => f.id === id)?.name ?? "Unknown folder";

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Response strategy agents</h1>
        <p className="mt-2 max-w-prose text-sm text-foreground-muted">
          Map each response strategy to instructions and a knowledge folder so draft replies stay consistent with your
          documents.
        </p>
      </header>

      {!projectId ? (
        <p className="mb-8 rounded-lg border border-dashed border-border bg-surface-muted/40 px-4 py-8 text-center text-sm text-foreground-muted">
          Choose a project from the sidebar selector. Agents and folders are stored per project in this browser.
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
          />
        </div>
        <div>
          <label htmlFor="agent-prompt" className="mb-1 block text-xs font-medium uppercase tracking-wide text-foreground-muted">
            Instruction / agent prompt
          </label>
          <textarea
            id="agent-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe tone, structure, mandatory clauses, and how to use retrieved context…"
            rows={6}
            className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div>
          <label htmlFor="agent-folder" className="mb-1 block text-xs font-medium uppercase tracking-wide text-foreground-muted">
            Knowledge folder
          </label>
          <select
            id="agent-folder"
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
          >
            <option value="">Select a folder…</option>
            {folderOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          {folderOptions.length === 0 ? (
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
          disabled={!strategy.trim() || !prompt.trim() || !folderId}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          <Bot className="h-4 w-4" aria-hidden />
          Save agent
        </button>
          </form>

          <section aria-labelledby="agents-list-title">
        <h2 id="agents-list-title" className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground-muted">
          Your agents
        </h2>
        {agents.length === 0 ? (
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
                  onUpdate={(updates) => updateAgent(agent.id, updates)}
                  onRemove={() => removeAgent(agent.id)}
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
  onUpdate,
  onRemove,
}: {
  agent: ResponseStrategyAgent;
  folderLabel: string;
  folderOptions: { id: string; label: string }[];
  onUpdate: (u: Partial<Pick<ResponseStrategyAgent, "name" | "prompt" | "knowledgeFolderId">>) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [localStrategy, setLocalStrategy] = useState(agent.name);
  const [localPrompt, setLocalPrompt] = useState(agent.prompt);
  const [localFolder, setLocalFolder] = useState(agent.knowledgeFolderId);

  const save = () => {
    onUpdate({ name: localStrategy, prompt: localPrompt, knowledgeFolderId: localFolder });
    setEditing(false);
  };

  const cancel = () => {
    setLocalStrategy(agent.name);
    setLocalPrompt(agent.prompt);
    setLocalFolder(agent.knowledgeFolderId);
    setEditing(false);
  };

  const title = agent.name;

  return (
    <li className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      {!editing ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-base font-semibold leading-snug text-foreground">{title}</h3>
              <p className="mt-1 text-xs text-foreground-muted">
                Folder: <span className="text-foreground">{folderLabel}</span>
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-surface-muted"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Remove this agent for “${title}”?`)) onRemove();
                }}
                className="rounded-lg p-2 text-foreground-muted transition hover:bg-red-500/10 hover:text-red-700"
                aria-label="Remove agent"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-border-subtle bg-surface-muted/50 p-3 text-xs leading-relaxed text-foreground">
            {agent.prompt}
          </pre>
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
              onChange={(v) => {
                setLocalStrategy(v);
                setLocalPrompt(getDefaultPromptForResponseStrategy(v));
              }}
            />
          </div>
          <textarea
            value={localPrompt}
            onChange={(e) => setLocalPrompt(e.target.value)}
            rows={5}
            className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30"
          />
          <select
            value={localFolder}
            onChange={(e) => setLocalFolder(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
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
              onClick={save}
              disabled={!localStrategy.trim() || !localPrompt.trim() || !localFolder}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground disabled:opacity-50"
            >
              Save
            </button>
            <button type="button" onClick={cancel} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold">
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
