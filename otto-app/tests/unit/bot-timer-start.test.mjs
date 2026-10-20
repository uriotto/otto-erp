import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as zod from "zod";

const uuid = "11111111-1111-4111-8111-111111111111";
function loadRoute(
  response = {
    data: {
      active: { session_id: uuid, revision: 1 },
      started_result: { session_id: uuid, revision: 1, started_at: "2020-01-01T00:00:00Z" },
      replayed: false,
    },
    error: null,
  },
) {
  const calls = [];
  const code = ts.transpileModule(
    fs.readFileSync(new URL("../../app/api/bot/timer/start/route.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    Response,
    require(name) {
      if (name === "zod") return zod;
      if (name === "@/lib/bot-auth")
        return {
          guardBotRequest: async () => ({ ok: true, auth: { userId: uuid, tenantId: uuid } }),
        };
      if (name === "@/lib/supabase/service")
        return {
          createServiceClient: () => ({
            rpc: async (...args) => {
              calls.push(args);
              return response;
            },
          }),
        };
      throw new Error(name);
    },
  });
  return {
    post: (body) =>
      exports.POST(
        new Request("https://example.test/api/bot/timer/start", {
          method: "POST",
          body: JSON.stringify(body),
        }),
      ),
    calls,
  };
}

test("legacy starts use non-overwriting start and report existing timer as conflict", async () => {
  const route = loadRoute({ data: null, error: { message: "TIMER_ACTIVE" } });
  const response = await route.post({ notes: "work" });
  assert.equal(response.status, 409);
  assert.equal(route.calls[0][1].p_operation, "start");
});

test("restart retries carry stable request ID and identical fingerprint input", async () => {
  const route = loadRoute({
    data: {
      active: { session_id: uuid, revision: 1 },
      started_result: { session_id: uuid, revision: 1, started_at: "2020-01-01T00:00:00Z" },
      replayed: true,
    },
    error: null,
  });
  const input = { request_id: uuid, notes: "work" };
  const first = await route.post(input);
  const retry = await route.post(input);
  assert.equal(first.status, 200);
  assert.equal((await retry.json()).replayed, true);
  assert.equal(route.calls[0][1].p_operation, "restart");
  assert.equal(route.calls[0][1].p_input.request_id, uuid);
  assert.equal(JSON.stringify(route.calls[0]), JSON.stringify(route.calls[1]));
});

test("reused key with different input maps database rejection to conflict", async () => {
  const route = loadRoute({ data: null, error: { message: "REQUEST_CONFLICT" } });
  const response = await route.post({ request_id: uuid, notes: "changed" });
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /different timer details/);
});

test("invalid restart key never reaches the database", async () => {
  const route = loadRoute();
  assert.equal((await route.post({ request_id: "invalid", notes: "work" })).status, 400);
  assert.equal(route.calls.length, 0);
});

test("replayed start returns original run identity while current active snapshot is different", async () => {
  const originalId = "22222222-2222-4222-8222-222222222222";
  const route = loadRoute({
    data: {
      active: { session_id: uuid, revision: 7, started_at: "2020-02-01T00:00:00Z" },
      started_result: { session_id: originalId, revision: 1, started_at: "2020-01-01T00:00:00Z" },
      replayed: true,
    },
    error: null,
  });
  const response = await route.post({ request_id: uuid, notes: "work" });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.session_id, originalId);
  assert.equal(body.revision, 1);
  assert.equal(body.started_at, "2020-01-01T00:00:00Z");
  assert.equal(body.replayed, true);
});
