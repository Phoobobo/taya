import { HerdrClient } from "./herdr/client.js";
import { TayaMessenger } from "./protocol/messenger.js";

export const DEFAULT_INTERVAL_MS = 300_000;

const PICK_CHECK_BODY = "Check your Pick source for new routine work and admit what fits into the Workboard To-Do list.";

/**
 * A bare interval timer. It nudges the assistant to go look at something and
 * carries no state about the work itself, because deciding whether there is
 * anything worth picking is judgment, not plumbing.
 */
export async function schedule(workspaceId: string, intervalMs: number, signal: AbortSignal): Promise<void> {
  const messenger = new TayaMessenger(new HerdrClient());

  while (!signal.aborted) {
    await messenger.send({
      from: "scheduler",
      to: "assistant",
      type: "pick.check",
      body: PICK_CHECK_BODY,
      workspaceId,
    }).catch((error: unknown) => {
      // A missing assistant pane is worth reporting but not worth dying over;
      // the pane may come back before the next tick.
      console.error(`scheduler: ${error instanceof Error ? error.message : String(error)}`);
    });
    await delay(intervalMs, signal);
  }
}

/** A sleep that gives up as soon as the signal aborts, so shutdown is prompt. */
function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
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
