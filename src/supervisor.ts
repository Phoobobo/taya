import { HerdrClient, type HerdrPane } from "./herdr/client.js";
import { TayaMessenger } from "./protocol/messenger.js";

const WORKER_LABELS = new Set(["architect", "coder", "qa"]);

type AgentStatus = NonNullable<HerdrPane["agent_status"]>;

export interface StatusChange {
  role: string;
  previous?: AgentStatus;
  current: AgentStatus;
}

export function statusChanges(
  panes: HerdrPane[],
  previous: ReadonlyMap<string, AgentStatus>,
  workspaceId: string,
): StatusChange[] {
  return panes
    .filter((pane) => pane.workspace_id === workspaceId && pane.label && WORKER_LABELS.has(pane.label))
    .flatMap((pane) => {
      const current = pane.agent_status ?? "unknown";
      const before = previous.get(pane.label!);
      return before === current ? [] : [{ role: pane.label!, previous: before, current }];
    });
}

export async function supervise(workspaceId: string, signal: AbortSignal): Promise<void> {
  const herdr = new HerdrClient();
  const messenger = new TayaMessenger(herdr);
  const known = new Map<string, AgentStatus>();

  while (!signal.aborted) {
    const panes = await herdr.panes();
    for (const change of statusChanges(panes, known, workspaceId)) {
      known.set(change.role, change.current);
      if (change.previous === undefined || change.current === "unknown") continue;
      await messenger.send({
        from: "supervisor",
        to: "assistant",
        type: change.current === "blocked" ? "agent.blocked" : "agent.progress",
        body: `${change.role} changed from ${change.previous} to ${change.current}.`,
      }).catch((error: unknown) => {
        console.error(`supervisor: ${error instanceof Error ? error.message : String(error)}`);
      });
    }
    await delay(2_000, signal);
  }
}

export function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolvePromise) => {
    const finish = () => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", finish);
      resolvePromise();
    };
    const timeout = setTimeout(finish, milliseconds);
    signal.addEventListener("abort", finish, { once: true });
  });
}
