import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import * as zod from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UUID = "11111111-1111-4111-8111-111111111111";

function actions({
  user = { id: UUID },
  response = { data: { active: null, customers: [], entries: [] }, error: null },
  throws = false,
} = {}) {
  const calls = [];
  const source = fs.readFileSync(
    path.join(__dirname, "../../app/desktop-timer/actions.ts"),
    "utf8",
  );
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require(name) {
      if (name === "zod") return zod;
      if (name === "@/lib/supabase/server")
        return {
          createClient: async () => ({
            auth: { getUser: async () => ({ data: { user }, error: null }) },
            rpc: async (...args) => {
              calls.push(args);
              if (throws) throw new Error("network");
              return response;
            },
          }),
        };
      throw new Error(name);
    },
    Date,
  });
  return { api: exports, calls };
}

test("invalid/future dates, oversized notes, malformed IDs cannot reach database mutation", async () => {
  const { api, calls } = actions();
  for (const started_at of ["not-a-date", "2099-01-01T00:00:00Z"]) {
    assert.ok((await api.startDesktopTimer({ customer_id: null, notes: "", started_at })).error);
  }
  assert.ok((await api.startDesktopTimer({ customer_id: "bad", notes: "" })).error);
  assert.ok((await api.startDesktopTimer({ customer_id: null, notes: "x".repeat(4001) })).error);
  assert.ok((await api.stopDesktopTimer({ session_id: UUID, revision: 0 })).error);
  assert.equal(calls.length, 0);
});

test("saved entry end must follow start", async () => {
  const { api, calls } = actions();
  assert.ok(
    (
      await api.updateDesktopEntry({
        id: UUID,
        edit_version: "123",
        customer_id: null,
        notes: "",
        start_time: "2020-01-01T02:00:00Z",
        end_time: "2020-01-01T01:00:00Z",
      })
    ).error,
  );
  assert.equal(calls.length, 0);
});

test("stop retries retain exact session and revision, using one transactional RPC", async () => {
  const { api, calls } = actions();
  const input = { session_id: UUID, revision: 2 };
  assert.ok((await api.stopDesktopTimer(input)).snapshot);
  assert.ok((await api.stopDesktopTimer(input)).snapshot);
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], "desktop_timer");
  assert.equal(calls[0][1].p_operation, "stop");
  assert.equal(JSON.stringify(calls[0]), JSON.stringify(calls[1]));
});

test("unauthenticated requests never call RPC", async () => {
  const { api, calls } = actions({ user: null });
  assert.ok((await api.getTimerSnapshot()).error);
  assert.equal(calls.length, 0);
});

test("conflicts and transport failures never return a false success snapshot", async () => {
  const conflict = actions({ response: { data: null, error: { message: "TIMER_STALE" } } });
  const result = await conflict.api.cancelDesktopTimer({ session_id: UUID, revision: 1 });
  assert.ok(result.error);
  assert.equal(result.snapshot, undefined);
  const offline = actions({ throws: true });
  assert.ok((await offline.api.stopDesktopTimer({ session_id: UUID, revision: 1 })).error);
});

test("delete validates identity and revision and requires authentication", async () => {
  const { api, calls } = actions();
  for (const input of [
    { id: "bad", edit_version: "1" },
    { id: UUID, edit_version: "bad" },
  ]) {
    assert.ok((await api.deleteDesktopEntry(input)).error);
  }
  assert.equal(calls.length, 0);
  assert.ok(
    (await actions({ user: null }).api.deleteDesktopEntry({ id: UUID, edit_version: "1" })).error,
  );
  assert.ok((await api.deleteDesktopEntry({ id: UUID, edit_version: "123" })).snapshot);
  assert.equal(calls[0][1].p_operation, "delete");
  assert.equal(calls[0][1].p_input.edit_version, "123");
});

test("start accepts no client and preserves reuse details without old timing or billing state", async () => {
  const { api, calls } = actions();
  await api.startDesktopTimer({ customer_id: null, notes: "without client" });
  assert.equal(calls[0][1].p_input.customer_id, null);
  await api.startDesktopTimer({
    customer_id: UUID,
    notes: "reused",
    project_id: UUID,
    task_id: UUID,
    invoice_id: UUID,
    billing_status: "invoiced",
  });
  assert.equal(calls[1][1].p_operation, "start");
  assert.equal(calls[1][1].p_input.project_id, UUID);
  assert.equal(calls[1][1].p_input.started_at, undefined);
  assert.equal(calls[1][1].p_input.invoice_id, undefined);
  assert.equal(calls[1][1].p_input.billing_status, undefined);
});

test("history validates cursors, requires auth and preserves exact timestamp precision", async () => {
  const page = { entries: [], hasMore: false, cursor: null };
  const { api, calls } = actions({ response: { data: page, error: null } });
  for (const cursor of [
    { id: "bad", start_time: "2020-01-01T00:00:00Z" },
    { id: UUID, start_time: "bad" },
    { id: UUID, start_time: "2020-01-01T00:00:00Z", user_id: UUID },
  ]) {
    assert.ok((await api.getDesktopTimerHistory(cursor)).error);
  }
  assert.equal(calls.length, 0);
  const unauth = actions({ user: null });
  assert.ok((await unauth.api.getDesktopTimerHistory()).error);
  assert.equal(unauth.calls.length, 0);
  const cursor = { id: UUID, start_time: "2020-01-01T00:00:00.123456+00:00" };
  assert.deepEqual((await api.getDesktopTimerHistory(cursor)).page, page);
  assert.equal(calls[0][0], "desktop_timer_history");
  assert.equal(calls[0][1].p_cursor.start_time, cursor.start_time);
  assert.ok((await actions({ throws: true }).api.getDesktopTimerHistory()).error);
  assert.ok(
    (
      await actions({
        response: { data: null, error: { message: "private detail" } },
      }).api.getDesktopTimerHistory()
    ).error,
  );
});
