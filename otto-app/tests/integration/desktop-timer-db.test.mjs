import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import {
  createTimerDatabase,
  seedTimerDatabase,
  ids,
  id,
  at,
  desktop,
  bot,
  asRole,
  session,
} from "./desktop-timer-fixture.mjs";

// Real PostgreSQL SQL execution in PGlite. Supabase identity claims are fixture
// functions; this does not exercise hosted auth, PostgREST or multi-connection locks.
let db;
before(async () => {
  db = await createTimerDatabase();
});
beforeEach(async () => {
  await seedTimerDatabase(db);
});
after(async () => {
  await db?.close();
});
const start = (customer = ids.hourly, extra = {}) =>
  desktop(db, "start", {
    customer_id: customer,
    notes: "fixture notes",
    started_at: at(0),
    ...extra,
  });
const scalar = async (sql, params = []) => Object.values((await db.query(sql, params)).rows[0])[0];
const entries = () =>
  db.query("select * from public.time_entries order by start_time,id").then((r) => r.rows);
const storedEntry = async (snapshot) => snapshot.entries[0];
const editInput = (entry, patch = {}) => ({
  id: entry.id,
  edit_version: entry.edit_version,
  customer_id: entry.customer_id,
  notes: entry.notes,
  start_time: entry.start_time,
  end_time: entry.end_time,
  ...patch,
});

test("start, active edits and stop retain notes, timing, one run and hourly rate", async () => {
  const running = await start();
  const updated = await desktop(db, "update", {
    ...session(running),
    customer_id: ids.hourly,
    notes: "changed while running",
    started_at: at(-5),
  });
  assert.equal(updated.active.session_id, running.active.session_id);
  assert.equal(updated.active.revision, 2);
  assert.equal(Date.parse(updated.active.started_at), Date.parse(at(-5)));
  const stopped = await desktop(db, "stop", { ...session(updated), end_time: at(15) });
  assert.equal(stopped.active, null);
  const [entry] = await entries();
  assert.equal(entry.duration_minutes, 20);
  assert.equal(entry.notes, "changed while running");
  assert.equal(Number(entry.hourly_rate_at_entry), 480);
});

test("repeated stop, even after entry deletion, never inserts another entry", async () => {
  const running = await start();
  const input = { ...session(running), end_time: at(20) };
  const first = await desktop(db, "stop", input);
  const retry = await desktop(db, "stop", input);
  assert.deepEqual(retry.operation_result, first.operation_result);
  assert.equal((await entries()).length, 1);
  await db.query("delete from public.time_entries where id=$1", [first.operation_result.entry_id]);
  await desktop(db, "stop", input);
  assert.equal((await entries()).length, 0);
});

test("queued duplicate stops save once; queued starts do not replace a timer", async () => {
  const starts = await Promise.allSettled([start(), start()]);
  assert.equal(starts.filter((r) => r.status === "fulfilled").length, 1);
  const running = starts.find((r) => r.status === "fulfilled").value;
  const input = { ...session(running), end_time: at(10) };
  await Promise.all([desktop(db, "stop", input), desktop(db, "stop", input)]);
  assert.equal((await entries()).length, 1);
});

test("cancel inserts no hours, is retry-safe and cannot cancel a later run", async () => {
  const old = await start();
  await desktop(db, "cancel", session(old));
  const next = await start();
  const retry = await desktop(db, "cancel", session(old));
  assert.equal(retry.active.session_id, next.active.session_id);
  assert.equal((await entries()).length, 0);
  await assert.rejects(desktop(db, "stop", { ...session(old), end_time: at(10) }), /TIMER_STALE/);
});

test("stale revisions cannot edit, stop or cancel the active run", async () => {
  const initial = await start();
  const changed = await desktop(db, "update", {
    ...session(initial),
    notes: "newer",
    started_at: at(-1),
  });
  for (const op of ["update", "stop", "cancel"]) {
    await assert.rejects(
      desktop(db, op, { ...session(initial), notes: "stale", end_time: at(10) }),
      /TIMER_STALE/,
    );
  }
  assert.equal((await desktop(db, "snapshot")).active.revision, changed.active.revision);
});

test("tenant and user isolation rejects foreign clients, sessions, projects and bot actors", async () => {
  await assert.rejects(start(ids.foreignCustomer), /NOT_AUTHORIZED/);
  await assert.rejects(start(ids.hourly, { project_id: ids.project }), /NOT_AUTHORIZED/);
  const running = await start();
  await assert.rejects(
    desktop(db, "stop", { ...session(running), end_time: at(10) }, ids.teammate),
    /TIMER_STALE/,
  );
  await assert.rejects(desktop(db, "snapshot", {}, ids.client), /NOT_AUTHORIZED/);
  await assert.rejects(bot(db, "start", {}, ids.user, ids.otherTenant), /NOT_AUTHORIZED/);
  const other = await desktop(db, "snapshot", {}, ids.outsider);
  assert.equal(other.active, null);
  assert.equal(other.customers.length, 1);
  assert.equal(other.customers[0].id, ids.foreignCustomer);
});

test("SQL grants block anonymous RPCs, actor spoofing, direct writes and private ledgers", async () => {
  for (const role of ["anon", "authenticated", "service_role"]) {
    await assert.rejects(
      asRole(db, role, ids.user, (tx) =>
        tx.query("select public.timer_operation_internal($1,$2,'start','{}')", [
          ids.user,
          ids.tenant,
        ]),
      ),
      /permission denied/,
    );
    await assert.rejects(
      asRole(db, role, ids.user, (tx) => tx.query("select * from public.timer_restart_requests")),
      /permission denied/,
    );
  }
  await assert.rejects(
    asRole(db, "anon", null, (tx) => tx.query("select public.desktop_timer('snapshot','{}')")),
    /permission denied/,
  );
  await assert.rejects(
    asRole(db, "authenticated", ids.user, (tx) =>
      tx.query("select public.bot_timer($1,$2,'start','{}')", [ids.user, ids.tenant]),
    ),
    /permission denied/,
  );
  await assert.rejects(
    asRole(db, "authenticated", ids.user, (tx) =>
      tx.query("insert into public.active_timers(user_id,tenant_id) values($1,$2)", [
        ids.user,
        ids.tenant,
      ]),
    ),
    /permission denied/,
  );
  const running = await start();
  const own = await asRole(db, "authenticated", ids.user, (tx) =>
    tx.query("select session_id from public.active_timers"),
  );
  const foreign = await asRole(db, "authenticated", ids.teammate, (tx) =>
    tx.query("select session_id from public.active_timers"),
  );
  assert.equal(own.rows[0].session_id, running.active.session_id);
  assert.equal(foreign.rows.length, 0);
});

test("database validation rejects future/invalid times and oversized notes without changes", async () => {
  for (const started_at of ["2099-01-01T00:00:00Z", "infinity", "invalid"]) {
    await assert.rejects(start(ids.hourly, { started_at }), /INVALID_INPUT|invalid input syntax/);
  }
  await assert.rejects(start(ids.hourly, { notes: "x".repeat(4001) }), /INVALID_INPUT/);
  const running = await start();
  await assert.rejects(
    desktop(db, "stop", { ...session(running), end_time: at(-1) }),
    /INVALID_INPUT/,
  );
  assert.equal((await entries()).length, 0);
  assert.equal((await desktop(db, "snapshot")).active.session_id, running.active.session_id);
});

test("real allocation splits 45 minutes at bank capacity; retry repeats no side effects", async () => {
  const running = await start(ids.bankCustomer);
  const input = { ...session(running), end_time: at(45) };
  const result = await desktop(db, "stop", input);
  const rows = await entries();
  assert.deepEqual(
    rows.map((e) => [e.duration_minutes, e.billing_status]),
    [
      [30, "allocated_to_bank"],
      [15, "overage"],
    ],
  );
  assert.equal(result.operation_result.duration_minutes, 45);
  assert.equal(
    await scalar("select status from public.hour_banks where id=$1", [ids.bank]),
    "depleted",
  );
  assert.equal(
    Number(
      await scalar("select count(*) from public.hour_banks where parent_bank_id=$1", [ids.bank]),
    ),
    1,
  );
  const notifications = await scalar("select count(*) from public.notifications");
  await desktop(db, "stop", input);
  assert.equal((await entries()).length, 2);
  assert.equal(await scalar("select count(*) from public.notifications"), notifications);
  assert.equal(
    Number(
      await scalar("select count(*) from public.hour_banks where parent_bank_id=$1", [ids.bank]),
    ),
    1,
  );
});

test("failure after real bank allocation rolls back entries, bank, alerts and completion", async () => {
  const running = await start(ids.bankCustomer);
  await db.exec(`create function public.fixture_fail_completion() returns trigger language plpgsql as $$ begin raise exception 'INJECTED_FAILURE'; end $$;
    create trigger fixture_fail before insert on public.timer_completions for each row execute function public.fixture_fail_completion();`);
  try {
    await assert.rejects(
      desktop(db, "stop", { ...session(running), end_time: at(45) }),
      /INJECTED_FAILURE/,
    );
    assert.equal((await entries()).length, 0);
    assert.equal(Number(await scalar("select count(*) from public.timer_completions")), 0);
    assert.equal(Number(await scalar("select count(*) from public.notifications")), 0);
    assert.equal(Number(await scalar("select count(*) from public.hour_banks")), 2);
    assert.equal(
      await scalar("select status from public.hour_banks where id=$1", [ids.bank]),
      "active",
    );
    assert.equal((await desktop(db, "snapshot")).active.session_id, running.active.session_id);
  } finally {
    await db.exec(
      "drop trigger fixture_fail on public.timer_completions; drop function public.fixture_fail_completion()",
    );
  }
});

test("saved entry edits refund old bank, allocate new bank and clear old project/task", async () => {
  const running = await start(ids.bankCustomer, { project_id: ids.project, task_id: ids.task });
  const stopped = await desktop(db, "stop", { ...session(running), end_time: at(30) });
  const entry = await storedEntry(stopped);
  const changed = await desktop(
    db,
    "entry",
    editInput(entry, { customer_id: ids.secondBankCustomer, end_time: at(20), notes: "moved" }),
  );
  const row = changed.entries[0];
  assert.equal(row.duration_minutes, 20);
  assert.equal(row.customer_id, ids.secondBankCustomer);
  assert.equal(row.project_id, null);
  assert.equal(row.task_id, null);
  assert.equal(
    await scalar("select status from public.hour_banks where id=$1", [ids.bank]),
    "active",
  );
  const stored = (await entries())[0];
  assert.equal(stored.consumed_from_bank_id, ids.secondBank);
  assert.equal(Number(stored.hourly_rate_at_entry), 350);
  await assert.rejects(desktop(db, "entry", editInput(entry, { notes: "stale" })), /ENTRY_STALE/);
});

test("saved-entry reallocation failure restores original data and bank capacity", async () => {
  const running = await start(ids.bankCustomer);
  const stopped = await desktop(db, "stop", { ...session(running), end_time: at(20) });
  const entry = await storedEntry(stopped);
  const original = await entries();
  await db.exec(`create function public.fixture_fail_entry() returns trigger language plpgsql as $$ begin
    if new.notes='inject failure' and new.billing_status='allocated_to_bank' then raise exception 'INJECTED_FAILURE'; end if;
    return new; end $$;
    create trigger fixture_fail before update on public.time_entries for each row execute function public.fixture_fail_entry();`);
  try {
    await assert.rejects(
      desktop(db, "entry", editInput(entry, { notes: "inject failure", end_time: at(25) })),
      /INJECTED_FAILURE/,
    );
    assert.deepEqual(await entries(), original);
  } finally {
    await db.exec(
      "drop trigger fixture_fail on public.time_entries; drop function public.fixture_fail_entry()",
    );
  }
});

test("invoiced, externally settled and cancelled entries cannot reenter billing through editing", async () => {
  const running = await start();
  const stopped = await desktop(db, "stop", { ...session(running), end_time: at(10) });
  const entryId = stopped.operation_result.entry_id;
  for (const status of ["invoiced", "settled_externally", "cancelled"]) {
    await db.query("update public.time_entries set billing_status=$1 where id=$2", [
      status,
      entryId,
    ]);
    const current = await storedEntry(await desktop(db, "snapshot"));
    await assert.rejects(
      desktop(db, "entry", editInput(current, { notes: "just a note" })),
      /ENTRY_LOCKED/,
    );
    assert.equal(
      await scalar("select billing_status from public.time_entries where id=$1", [entryId]),
      status,
    );
  }
});

test("keyed restart retries retain original run identity without stopping a later run", async () => {
  await start();
  const input = {
    request_id: id(101),
    customer_id: ids.hourly,
    notes: "restart B",
    started_at: at(0),
  };
  const first = await bot(db, "restart", input);
  const second = await bot(db, "restart", { ...input, request_id: id(102), notes: "restart C" });
  const before = await entries();
  const replay = await bot(db, "restart", input);
  assert.deepEqual(replay.started_result, first.started_result);
  assert.equal(replay.active.session_id, second.started_result.session_id);
  assert.equal(replay.replayed, true);
  assert.deepEqual(await entries(), before);
  await assert.rejects(
    bot(db, "restart", { ...input, notes: "changed input" }),
    /REQUEST_CONFLICT/,
  );
  await assert.rejects(bot(db, "restart", { notes: "missing key" }), /INVALID_INPUT/);
});

test("failed restart rolls back previous stop and receipt so original timer survives", async () => {
  const original = await start(ids.bankCustomer);
  await assert.rejects(
    bot(db, "restart", { request_id: id(103), customer_id: ids.foreignCustomer }),
    /NOT_AUTHORIZED/,
  );
  assert.equal((await desktop(db, "snapshot")).active.session_id, original.active.session_id);
  assert.equal((await entries()).length, 0);
  assert.equal(Number(await scalar("select count(*) from public.timer_restart_requests")), 0);
  assert.equal(Number(await scalar("select count(*) from public.timer_completions")), 0);
  assert.equal(
    await scalar("select status from public.hour_banks where id=$1", [ids.bank]),
    "active",
  );
});

const deleteInput = (entry) => ({ id: entry.id, edit_version: entry.edit_version });

test("delete restores bank capacity once, retains completion and preserves an active run", async () => {
  const running = await start(ids.bankCustomer);
  const stopInput = { ...session(running), end_time: at(30) };
  const stopped = await desktop(db, "stop", stopInput);
  const input = deleteInput(stopped.entries[0]);
  const active = await start();
  const deleted = await desktop(db, "delete", input);
  assert.equal(deleted.entries.length, 0);
  assert.deepEqual(deleted.active, active.active);
  assert.equal(await scalar("select status from public.hour_banks where id=$1", [ids.bank]), "active");
  assert.equal(Number(await scalar("select count(*) from public.timer_completions")), 1);
  const banks = (await db.query("select * from public.hour_banks order by id")).rows;
  const alerts = (await db.query("select * from public.notifications order by id")).rows;
  assert.deepEqual(await desktop(db, "delete", input), deleted);
  await desktop(db, "stop", stopInput);
  assert.equal((await entries()).length, 0);
  assert.deepEqual((await db.query("select * from public.hour_banks order by id")).rows, banks);
  assert.deepEqual((await db.query("select * from public.notifications order by id")).rows, alerts);
  assert.deepEqual((await desktop(db, "snapshot")).active, active.active);
});

test("delete failure while recalculating bank rolls back entry, bank and alerts", async () => {
  const running = await start(ids.bankCustomer);
  const stopped = await desktop(db, "stop", { ...session(running), end_time: at(30) });
  const originalEntries = await entries();
  const originalBanks = (await db.query("select * from public.hour_banks order by id")).rows;
  const originalAlerts = (await db.query("select * from public.notifications order by id")).rows;
  await db.exec(`create function public.fixture_fail_bank() returns trigger language plpgsql as $$ begin
    if old.status='depleted' and new.status='active' then raise exception 'INJECTED_RECALC_FAILURE'; end if;
    return new; end $$;
    create trigger fixture_fail before update on public.hour_banks for each row execute function public.fixture_fail_bank();`);
  try {
    await assert.rejects(desktop(db, "delete", deleteInput(stopped.entries[0])), /INJECTED_RECALC_FAILURE/);
    assert.deepEqual(await entries(), originalEntries);
    assert.deepEqual((await db.query("select * from public.hour_banks order by id")).rows, originalBanks);
    assert.deepEqual((await db.query("select * from public.notifications order by id")).rows, originalAlerts);
    assert.equal(Number(await scalar("select count(*) from public.timer_completions")), 1);
  } finally {
    await db.exec("drop trigger fixture_fail on public.hour_banks; drop function public.fixture_fail_bank()");
  }
});

test("delete cannot remove stale entries or entries closed by status or invoice", async () => {
  const running = await start();
  const stopped = await desktop(db, "stop", { ...session(running), end_time: at(10) });
  const entry = stopped.entries[0];
  await desktop(db, "entry", editInput(entry, { notes: "newer version" }));
  await assert.rejects(desktop(db, "delete", deleteInput(entry)), /ENTRY_STALE/);
  for (const status of ["invoiced", "settled_externally", "cancelled"]) {
    await db.query("update public.time_entries set billing_status=$1 where id=$2", [status, entry.id]);
    const current = (await desktop(db, "snapshot")).entries[0];
    await assert.rejects(desktop(db, "delete", deleteInput(current)), /ENTRY_LOCKED/);
  }
  await db.query("update public.time_entries set billing_status='pending',invoice_id=$1 where id=$2", [id(201), entry.id]);
  const invoiced = (await desktop(db, "snapshot")).entries[0];
  await assert.rejects(desktop(db, "delete", deleteInput(invoiced)), /ENTRY_LOCKED/);
  assert.equal((await entries()).length, 1);
});

test("delete isolates owners and tenants without disclosing foreign entry existence", async () => {
  const running = await start();
  const stopped = await desktop(db, "stop", { ...session(running), end_time: at(10) });
  const input = deleteInput(stopped.entries[0]);
  for (const user of [ids.teammate, ids.outsider]) {
    const foreign = await desktop(db, "delete", input, user);
    const missing = await desktop(db, "delete", { ...input, id: id(202) }, user);
    assert.deepEqual(foreign, missing);
  }
  await assert.rejects(desktop(db, "delete", input, ids.client), /NOT_AUTHORIZED/);
  assert.equal((await entries()).length, 1);
  const ownTeamTimer = await desktop(db, "start", { customer_id: ids.hourly, started_at: at(0) }, ids.teammate);
  const ownTeamStop = await desktop(db, "stop", { ...session(ownTeamTimer), end_time: at(10) }, ids.teammate);
  await desktop(db, "delete", deleteInput(ownTeamStop.entries[0]), ids.teammate);
  assert.equal((await entries()).length, 1);
});

test("delete validates its payload and exposes no private or service-role delete entry point", async () => {
  for (const input of [null, [], {}, { id: id(203) }, { id: id(203), edit_version: "" }, { id: id(203), edit_version: "wrong" }]) {
    await assert.rejects(desktop(db, "delete", input), /INVALID_INPUT/);
  }
  for (const role of ["anon", "authenticated", "service_role"]) {
    await assert.rejects(asRole(db, role, ids.user, (tx) => tx.query(
      "select public.timer_delete_entry_internal($1,$2,'{}')", [ids.user, ids.tenant],
    )), /permission denied/);
  }
  for (const role of ["anon", "service_role"]) {
    await assert.rejects(asRole(db, role, ids.user, (tx) => tx.query("select public.desktop_timer('delete','{}')")), /permission denied/);
  }
  await assert.rejects(bot(db, "delete", { id: id(203), edit_version: "1" }), /INVALID_INPUT/);
});

const history = (cursor = null, user = ids.user) => asRole(db, "authenticated", user,
  async (tx) => (await tx.query("select public.desktop_timer_history($1::jsonb) as result",
    [JSON.stringify(cursor)])).rows[0].result);

async function seedHistory(count, user = ids.user, tenant = ids.tenant, offset = 1000) {
  for (let n = 0; n < count; n++) {
    await db.query(`insert into public.time_entries
      (id,tenant_id,user_id,start_time,end_time,duration_minutes,notes,billable)
      values($1,$2,$3,$4,$5,10,$6,false)`,
      [id(offset + n),tenant,user,at(0),at(10),`History ${n}`]);
  }
}

test("history pagination has stable ties, correct versions and access to all older entries", async () => {
  await seedHistory(65);
  const seen = [];
  let cursor;
  for (const expected of [30,30,5]) {
    const page = await history(cursor);
    assert.equal(page.entries.length,expected);
    assert.equal(page.hasMore,expected === 30);
    assert.equal(page.cursor !== null,page.hasMore);
    for (const entry of page.entries) {
      assert.match(entry.edit_version,/^\d+$/);
      seen.push(entry.id);
    }
    cursor = page.cursor;
  }
  assert.equal(new Set(seen).size,65);
  assert.deepEqual(seen,Array.from({length:65},(_,n) => id(1064-n)));
  // Cursor does not depend on the boundary row continuing to exist.
  const first = await history();
  await db.query("delete from public.time_entries where id=$1",[first.cursor.id]);
  assert.equal((await history(first.cursor)).entries[0].id,id(1034));
});

test("history scopes both tenant and user, denies client/anonymous and handles empty pages", async () => {
  await seedHistory(1,ids.teammate,ids.tenant,2000);
  await seedHistory(1,ids.outsider,ids.otherTenant,3000);
  assert.deepEqual(await history(),{entries:[],hasMore:false,cursor:null});
  assert.equal((await history(null,ids.teammate)).entries[0].id,id(2000));
  assert.equal((await history(null,ids.outsider)).entries[0].id,id(3000));
  await assert.rejects(history(null,ids.client),/NOT_AUTHORIZED/);
  await assert.rejects(history(null,null),/NOT_AUTHORIZED/);
  for (const role of ["anon","service_role"]) {
    await assert.rejects(asRole(db,role,null,tx => tx.query("select public.desktop_timer_history()")),/permission denied/);
  }
  for (const invalid of [{},[],{start_time:"infinity",id:id(1000)},
    {start_time:at(0),id:"bad"},{start_time:"bad",id:id(1000)}]) {
    await assert.rejects(history(invalid),/INVALID_INPUT/);
  }
});

test("history cursor preserves PostgreSQL timestamp microseconds", async () => {
  await seedHistory(31);
  await db.query("update public.time_entries set start_time='2026-01-01T10:00:00.123456Z'");
  const page = await history();
  assert.match(page.cursor.start_time,/123456/);
  assert.equal((await history(page.cursor)).entries.length,1);
});

test("unassigned timer can be saved without a client and assigned during later editing", async () => {
  const running = await start(null);
  assert.equal(running.active.customer_id,null);
  const stopped = await desktop(db,"stop",{...session(running),end_time:at(10)});
  const entry = stopped.entries[0];
  assert.equal(entry.customer_id,null);
  const assigned = await desktop(db,"entry",editInput(entry,{customer_id:ids.hourly}));
  assert.equal(assigned.entries[0].customer_id,ids.hourly);
  assert.equal(assigned.entries[0].duration_minutes,10);
});

test("starting again from saved details creates a fresh run without changing the original", async () => {
  const running = await start();
  const stopped = await desktop(db,"stop",{...session(running),end_time:at(10)});
  const original = stopped.entries[0];
  const next = await desktop(db,"start",{
    customer_id:original.customer_id,notes:original.notes,
    project_id:original.project_id,task_id:original.task_id,
  });
  assert.notEqual(next.active.session_id,running.active.session_id);
  assert.ok(Date.parse(next.active.started_at)>Date.parse(original.end_time));
  assert.equal(next.active.customer_id,original.customer_id);
  assert.equal(next.active.notes,original.notes);
  assert.deepEqual(next.entries[0],original);
  await assert.rejects(desktop(db,"start",{
    customer_id:original.customer_id,notes:original.notes,
  }),/TIMER_ACTIVE/);
  assert.equal((await desktop(db,"snapshot")).active.session_id,next.active.session_id);
});

test("unassigned timer accepts a client while running and saves that assignment", async () => {
  const running = await start(null);
  const assigned = await desktop(db,"update",{
    ...session(running),customer_id:ids.hourly,notes:"Assigned later",started_at:running.active.started_at,
  });
  assert.equal(assigned.active.customer_id,ids.hourly);
  const stopped = await desktop(db,"stop",{...session(assigned),end_time:at(10)});
  assert.equal(stopped.entries[0].customer_id,ids.hourly);
  assert.equal(stopped.entries[0].notes,"Assigned later");
});
