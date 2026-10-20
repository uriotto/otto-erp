import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import http from "node:http";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const webpack = require("next/dist/compiled/webpack/webpack").webpack;
const { chromium } = require("@playwright/test");
const project = path.resolve(import.meta.dirname, "../..");
let directory;
let browser;
let server;
let url;

before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "otto-timer-ui-"));
  for (const name of ["timer-client", "timer-fields", "entry-editor"]) {
    const source = await readFile(path.join(project, "app/desktop-timer", `${name}.tsx`), "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
      },
    });
    await writeFile(path.join(directory, `${name}.js`), compiled.outputText);
  }
  await writeFile(
    path.join(directory, "actions.js"),
    `
const initial = { active: { session_id: 'session-1', revision: 1, customer_id: 'client-1', project_id: null, task_id: null, notes: 'original', started_at: '2026-10-04T08:00:00.000Z' }, customers: [{id:'client-1',name:'לקוח בדיקה'},{id:'client-2',name:'לקוח שני'}], entries: [{id:'entry-1',edit_version:'1',customer_id:'client-1',notes:'saved original',start_time:'2026-10-04T08:00:00.345Z',end_time:'2026-10-04T09:00:00.345Z',duration_minutes:60,billing_status:'pending',invoice_id:null,project_id:null,task_id:null,billable:true}] };
window.testTimer = { snapshot: initial, calls: [], fail: false, failRead: window.initialFailRead ?? false };
const state = window.testTimer;
export async function getDesktopTimerHistory(cursor) { state.historyCalls ??= []; state.historyCalls.push(cursor); if(state.failHistory) return {error:'טעינת היסטוריה נכשלה'}; const entries=structuredClone(cursor ? state.olderEntries ?? [] : state.snapshot.entries); return {page:{entries,hasMore:!cursor && !!state.olderEntries?.length,cursor:entries.length ? {start_time:entries.at(-1).start_time,id:entries.at(-1).id} : null}}; }
export async function getTimerSnapshot() { if(state.failRead) throw new Error('offline'); return {snapshot:structuredClone(state.snapshot)}; }
function action(name, input) { state.calls.push({name,input}); if(state.fail) return {error:'שמירה נכשלה לבדיקה'}; if(name==='stop'||name==='cancel') state.snapshot.active=null; if(name==='stop'&&state.newEntry) state.snapshot.entries.unshift(state.newEntry); if(name==='update') state.snapshot.active={...state.snapshot.active,...input,revision:input.revision+1}; if(name==='start') state.snapshot.active={...initial.active,...input,session_id:'session-new',revision:1,started_at:new Date().toISOString()}; if(name==='delete') state.snapshot.entries=state.snapshot.entries.filter(entry=>entry.id!==input.id); if(name==='entry') state.snapshot.entries=state.snapshot.entries.map(entry=>entry.id===input.id?{...entry,...input}:entry); return {snapshot:structuredClone(state.snapshot)}; }
export async function startDesktopTimer(input){return action('start',input)}
export async function updateDesktopTimer(input){return action('update',input)}
export async function stopDesktopTimer(input){return action('stop',input)}
export async function cancelDesktopTimer(input){return action('cancel',input)}
export async function updateDesktopEntry(input){return action('entry',input)}
export async function deleteDesktopEntry(input){return action('delete',input)}
`,
  );
  await writeFile(
    path.join(directory, "entry.js"),
    `import React from 'react'; import {createRoot} from 'react-dom/client'; import {DesktopTimer} from './timer-client'; window.nativeMessages=[]; if(!window.webkit?.messageHandlers?.ottoTimer) window.webkit={messageHandlers:{ottoTimer:{postMessage:m=>window.nativeMessages.push(m)}}}; createRoot(document.getElementById('root')).render(React.createElement(DesktopTimer));`,
  );
  await new Promise((resolve, reject) =>
    webpack(
      {
        mode: "development",
        devtool: false,
        entry: path.join(directory, "entry.js"),
        output: { path: directory, filename: "bundle.js" },
        resolve: { modules: [path.join(project, "node_modules"), "node_modules"] },
      },
      (error, stats) =>
        error || stats.hasErrors()
          ? reject(error ?? new Error(stats.toString({ all: false, errors: true })))
          : resolve(),
    ),
  );
  const bundle = await readFile(path.join(directory, "bundle.js"));
  const postcss = require("postcss");
  const tailwind = require("@tailwindcss/postcss");
  const css = await postcss([tailwind({ base: project })]).process(
    await readFile(path.join(project, "app/globals.css"), "utf8"),
    { from: path.join(project, "app/globals.css") },
  );
  server = http.createServer((request, response) => {
    response.setHeader(
      "Content-Type",
      request.url === "/bundle.js"
        ? "application/javascript"
        : request.url === "/style.css"
          ? "text/css"
          : "text/html; charset=utf-8",
    );
    response.end(
      request.url === "/bundle.js"
        ? bundle
        : request.url === "/style.css"
          ? css.css
          : `<html lang="he" dir="rtl"><head><link rel="stylesheet" href="/style.css"></head><body>${process.env.DESKTOP_TIMER_PREVIEW ? '<p style="padding:10px;background:#fff3cd;text-align:center;font:14px system-ui">תצוגת בדיקה בלבד - הנתונים אינם נשמרים ב-OTTO</p>' : ""}<div id="root"></div><script src="/bundle.js"></script></body></html>`,
    );
  });
  await new Promise((resolve) =>
    server.listen(process.env.DESKTOP_TIMER_PREVIEW ? 4320 : 0, "127.0.0.1", resolve),
  );
  url = `http://127.0.0.1:${server.address().port}`;
  if (process.env.DESKTOP_TIMER_PREVIEW) {
    console.log(`Mock timer preview: ${url}/desktop-timer`);
    await new Promise(() => {});
  }
  browser = await chromium.launch({ headless: true, timeout: 10000 });
});

after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  if (directory) await rm(directory, { recursive: true, force: true });
});

async function open() {
  const page = await browser.newPage({ viewport: { width: 420, height: 760 }, timezoneId: "UTC" });
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error) => console.error(error.message));
  await page.goto(url);
  await page.getByLabel("על מה עובדים?").waitFor();
  if (process.env.DESKTOP_TIMER_SCREENSHOT)
    await page.screenshot({ path: process.env.DESKTOP_TIMER_SCREENSHOT, fullPage: true });
  return page;
}

test("failed stop preserves edited fields, polling preserves drafts, retry includes edits", async () => {
  const page = await open();
  await page.getByLabel("על מה עובדים?", { exact: true }).fill("unsaved note");
  await page.getByLabel("לקוח", { exact: true }).selectOption("client-2");
  await page.evaluate(() => {
    window.testTimer.fail = true;
  });
  await page.getByRole("button", { name: "עצירה ושמירה", exact: true }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(
    await page.getByLabel("על מה עובדים?", { exact: true }).inputValue(),
    "unsaved note",
  );
  await page.getByRole("button", { name: "רענון", exact: true }).click();
  assert.equal(
    await page.getByLabel("על מה עובדים?", { exact: true }).inputValue(),
    "unsaved note",
  );
  await page.evaluate(() => {
    window.testTimer.fail = false;
  });
  await page.getByRole("button", { name: "עצירה ושמירה", exact: true }).click();
  await page.getByRole("button", { name: "התחלת דיווח", exact: true }).waitFor();
  const calls = await page.evaluate(() => window.testTimer.calls);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].input.customer_id, "client-2");
  assert.equal(calls[1].input.notes, "unsaved note");
  assert.equal(calls[1].input.session_id, "session-1");
  assert.equal(calls[1].input.revision, 1);
  assert.ok(calls[1].input.started_at);
  assert.equal(calls[1].input.end_time, calls[0].input.end_time);
  await page.close();
});

test("active edit keeps running and posts native bridge, reminder can stop", async () => {
  const page = await open();
  await page.getByLabel("על מה עובדים?", { exact: true }).fill("changed while running");
  await page.getByRole("button", { name: "שמירת שינויים", exact: true }).click();
  await page.getByText("השינויים נשמרו. הטיימר ממשיך לרוץ").waitFor();
  const bridge = await page.evaluate(() =>
    window.nativeMessages.filter((message) => "active" in message).at(-1),
  );
  assert.equal(bridge.active, true);
  assert.equal(bridge.sessionId, "session-1");
  assert.equal(bridge.startedAt, "2026-10-04T08:00:00.000Z");
  await page.evaluate(() => window.dispatchEvent(new Event("otto:reminder")));
  await page
    .getByRole("complementary", { name: "תזכורת טיימר" })
    .getByRole("button", { name: "עצירה ושמירה" })
    .click();
  await page.getByRole("button", { name: "התחלת דיווח", exact: true }).waitFor();
  await page.close();
});

test("cancel confirmation declines safely then cancels without save", async () => {
  const page = await open();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "ביטול ללא שמירה", exact: true }).click();
  assert.equal(await page.evaluate(() => window.testTimer.calls.length), 0);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "ביטול ללא שמירה", exact: true }).click();
  await page.getByRole("button", { name: "התחלת דיווח", exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.testTimer.calls.map((call) => call.name)), [
    "cancel",
  ]);
  await page.close();
});

test("external revision does not overwrite dirty draft and blocks stale save", async () => {
  const page = await open();
  await page.getByLabel("על מה עובדים?", { exact: true }).fill("my draft");
  await page.evaluate(() => {
    window.testTimer.snapshot.active.revision = 2;
    window.testTimer.snapshot.active.notes = "remote";
  });
  await page.getByRole("button", { name: "רענון", exact: true }).click();
  await page.getByText("הטיימר עודכן ממקום אחר.", { exact: false }).waitFor();
  assert.equal(await page.getByLabel("על מה עובדים?", { exact: true }).inputValue(), "my draft");
  assert.equal(
    await page.getByRole("button", { name: "עצירה ושמירה", exact: true }).isDisabled(),
    true,
  );
  await page.close();
});

test("saved entry edit failure preserves draft and invoiced entry is readonly", async () => {
  const page = await open();
  await page.getByRole("button", { name: "עריכת דיווח לקוח בדיקה", exact: true }).click();
  const note = page.locator("#entry-entry-1-notes");
  await note.fill("saved edit draft");
  await page.evaluate(() => {
    window.testTimer.fail = true;
  });
  await page.getByRole("button", { name: "שמירת שינויים", exact: true }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(await note.inputValue(), "saved edit draft");
  await page.getByRole("button", { name: "סגירה", exact: true }).click();
  await page.evaluate(() => {
    window.testTimer.snapshot.entries[0].billing_status = "invoiced";
  });
  await page.getByRole("button", { name: "רענון", exact: true }).click();
  await page.getByText("חויב או נסגר, לצפייה בלבד", { exact: false }).waitFor();
  await page.getByRole("button", { name: "עריכת דיווח לקוח בדיקה", exact: true }).click();
  assert.equal(await page.locator("#entry-entry-1-notes").isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "מחיקת דיווח", exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "שמירת שינויים", exact: true }).count(), 0);
  await page.close();
});

test("initial connection failure can retry without showing fake timer", async () => {
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  await page.addInitScript(() => {
    window.initialFailRead = true;
  });
  await page.goto(url);
  await page.getByRole("alert").waitFor();
  assert.equal(await page.getByRole("button", { name: "התחלת דיווח", exact: true }).count(), 0);
  await page.evaluate(() => {
    window.testTimer.failRead = false;
  });
  await page.getByRole("button", { name: "רענון", exact: true }).click();
  await page.getByLabel("על מה עובדים?", { exact: true }).waitFor();
  await page.close();
});

test("start without a client includes notes and client can be assigned while running", async () => {
  const page = await open();
  await page.evaluate(() => {
    window.testTimer.snapshot.active = null;
  });
  await page.getByRole("button", { name: "רענון", exact: true }).click();
  const start = page.getByRole("button", { name: "התחלת דיווח", exact: true });
  await start.waitFor();
  assert.equal(await start.isDisabled(), false);
  await page.getByLabel("על מה עובדים?", { exact: true }).fill("new notes");
  await start.click();
  await page.getByRole("button", { name: "עצירה ושמירה", exact: true }).waitFor();
  const calls = await page.evaluate(() => window.testTimer.calls);
  assert.equal(calls[0].name, "start");
  assert.equal(calls[0].input.customer_id, null);
  assert.equal(calls[0].input.notes, "new notes");
  await page.getByLabel("לקוח", { exact: true }).selectOption("client-2");
  await page.getByRole("button", { name: "שמירת שינויים", exact: true }).click();
  await page.getByText("השינויים נשמרו. הטיימר ממשיך לרוץ").waitFor();
  assert.equal(await page.evaluate(() => window.testTimer.snapshot.active.customer_id), "client-2");
  await page.close();
});

test("clicking an already open entry cannot upgrade a stale draft version", async () => {
  const page = await open();
  const card = page.getByRole("button", { name: "עריכת דיווח לקוח בדיקה", exact: true });
  await card.click();
  await page.locator("#entry-entry-1-notes").fill("my original edit");
  await page.evaluate(() => {
    window.testTimer.snapshot.entries[0].edit_version = "2";
    window.testTimer.snapshot.entries[0].notes = "remote update";
  });
  await page.getByRole("button", { name: "רענון", exact: true }).click();
  await page.getByText("remote update", { exact: true }).waitFor();
  await card.click();
  await page.getByRole("button", { name: "שמירת שינויים", exact: true }).click();
  await page.getByText("הדיווח עודכן", { exact: true }).waitFor();
  const calls = await page.evaluate(() => window.testTimer.calls);
  assert.equal(calls[0].input.edit_version, "1");
  assert.equal(calls[0].input.notes, "my original edit");
  assert.equal(calls[0].input.start_time, "2026-10-04T08:00:00.345Z");
  assert.equal(calls[0].input.end_time, "2026-10-04T09:00:00.345Z");
  await page.close();
});

for (const billingStatus of ["settled_externally", "cancelled"])
  test(`${billingStatus} entry stays readonly`, async () => {
    const page = await open();
    await page.evaluate((status) => {
      window.testTimer.snapshot.entries[0].billing_status = status;
    }, billingStatus);
    await page.getByRole("button", { name: "רענון", exact: true }).click();
    await page.getByText("חויב או נסגר, לצפייה בלבד", { exact: false }).waitFor();
    await page.getByRole("button", { name: "עריכת דיווח לקוח בדיקה", exact: true }).click();
    assert.equal(await page.locator("#entry-entry-1-notes").isDisabled(), true);
    assert.equal(await page.getByRole("button", { name: "מחיקת דיווח", exact: true }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "שמירת שינויים", exact: true }).count(), 0);
    await page.close();
  });

test("saved deletion requires confirmation, keeps failed entry, then removes only saved entry", async () => {
  const page = await open();
  await page.getByLabel("על מה עובדים?", { exact: true }).fill("active unsaved draft");
  await page.getByRole("button", { name: "עריכת דיווח לקוח בדיקה", exact: true }).click();
  await page.locator("#entry-entry-1-notes").fill("saved unsaved draft");
  const remove = page.getByRole("button", { name: "מחיקת דיווח", exact: true });
  page.once("dialog", (dialog) => dialog.dismiss());
  await remove.click();
  assert.equal(await page.evaluate(() => window.testTimer.calls.length), 0);
  await page.evaluate(() => {
    window.testTimer.fail = true;
  });
  page.once("dialog", (dialog) => dialog.accept());
  await remove.click();
  await page.getByRole("alert").waitFor();
  assert.equal(await page.locator("#entry-entry-1-notes").inputValue(), "saved unsaved draft");
  await page.evaluate(() => {
    window.testTimer.fail = false;
  });
  page.once("dialog", (dialog) => dialog.accept());
  await remove.click();
  await page.getByText("הדיווח נמחק", { exact: true }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "עריכת דיווח לקוח בדיקה", exact: true }).count(),
    0,
  );
  const state = await page.evaluate(() => window.testTimer);
  assert.deepEqual(
    state.calls.map((call) => call.input),
    [
      { id: "entry-1", edit_version: "1" },
      { id: "entry-1", edit_version: "1" },
    ],
  );
  assert.equal(state.snapshot.active.session_id, "session-1");
  assert.equal(
    await page.getByLabel("על מה עובדים?", { exact: true }).inputValue(),
    "active unsaved draft",
  );
  await page.close();
});

test("repeat is blocked while active, then copies a closed historical entry into a new timer", async () => {
  const page = await open();
  assert.equal(
    await page.getByRole("button", { name: "התחל שוב", exact: true }).isDisabled(),
    true,
  );
  await page.evaluate(() => {
    window.testTimer.snapshot.active = null;
    Object.assign(window.testTimer.snapshot.entries[0], {
      billing_status: "invoiced",
      project_id: "project-1",
      task_id: "task-1",
    });
  });
  await page.getByRole("button", { name: "רענון", exact: true }).click();
  await page.getByRole("button", { name: "התחלת דיווח", exact: true }).waitFor();
  const before = await page.evaluate(() => structuredClone(window.testTimer.snapshot.entries[0]));
  await page.getByRole("button", { name: "התחל שוב", exact: true }).click();
  await page.getByText("התחיל דיווח חדש עם פרטי הדיווח הקודם").waitFor();
  const state = await page.evaluate(() => window.testTimer);
  assert.deepEqual(state.snapshot.entries[0], before);
  assert.deepEqual(state.calls[0].input, {
    customer_id: "client-1",
    notes: "saved original",
    project_id: "project-1",
    task_id: "task-1",
  });
  assert.ok(Math.abs(Date.now() - Date.parse(state.snapshot.active.started_at)) < 5000);
  assert.equal(
    await page.getByLabel("על מה עובדים?", { exact: true }).inputValue(),
    "saved original",
  );
  await page.close();
});

test("history can load older entries, retry failure and repeat a previously hidden entry", async () => {
  const page = await open();
  await page.evaluate(() => {
    window.testTimer.snapshot.active = null;
    window.testTimer.olderEntries = [
      {
        ...window.testTimer.snapshot.entries[0],
        id: "old-entry",
        start_time: "2020-01-01T08:00:00Z",
        end_time: "2020-01-01T09:00:00Z",
        notes: "old description",
        customer_id: null,
      },
    ];
    window.testTimer.failHistory = true;
  });
  await page.getByRole("button", { name: "רענון", exact: true }).click();
  await page.getByRole("button", { name: "כל הדיווחים", exact: true }).click();
  await page.getByText("טעינת היסטוריה נכשלה").waitFor();
  await page.evaluate(() => {
    window.testTimer.failHistory = false;
  });
  await page.getByRole("button", { name: "כל הדיווחים", exact: true }).click();
  await page.getByRole("button", { name: "טעינת דיווחים קודמים", exact: true }).click();
  const old = page.locator("article").filter({ hasText: "old description" });
  await old.getByRole("button", { name: "התחל שוב", exact: true }).click();
  await page.getByText("התחיל דיווח חדש עם פרטי הדיווח הקודם").waitFor();
  const state = await page.evaluate(() => window.testTimer);
  assert.equal(state.calls[0].input.notes, "old description");
  assert.equal(state.calls[0].input.customer_id, null);
  assert.deepEqual(state.historyCalls.at(-1), {
    id: "entry-1",
    start_time: "2026-10-04T08:00:00.345Z",
  });
  assert.equal(
    await page.getByRole("button", { name: "טעינת דיווחים קודמים", exact: true }).count(),
    0,
  );
  await page.close();
});

test("repeat preserves a declined draft and failed repeat does not claim a timer started", async () => {
  const page = await open();
  await page.evaluate(() => {
    window.testTimer.snapshot.active = null;
  });
  await page.getByRole("button", { name: "רענון", exact: true }).click();
  await page.getByRole("button", { name: "התחלת דיווח", exact: true }).waitFor();
  await page.getByLabel("על מה עובדים?", { exact: true }).fill("my draft");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "התחל שוב", exact: true }).click();
  assert.equal(await page.evaluate(() => window.testTimer.calls.length), 0);
  await page.evaluate(() => {
    window.testTimer.fail = true;
  });
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "התחל שוב", exact: true }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(await page.getByLabel("על מה עובדים?", { exact: true }).inputValue(), "my draft");
  assert.equal(await page.evaluate(() => window.testTimer.snapshot.active), null);
  await page.close();
});

test("duration entry preserves exact start and updates end, timestamps resync duration", async () => {
  const page = await open();
  await page.getByRole("button", { name: "עריכת דיווח לקוח בדיקה", exact: true }).click();
  await page.getByLabel("דקות", { exact: true }).fill("30");
  await page.getByRole("button", { name: "שמירת שינויים", exact: true }).click();
  await page.getByText("הדיווח עודכן", { exact: true }).waitFor();
  const input = await page.evaluate(() => window.testTimer.calls[0].input);
  assert.equal(input.start_time, "2026-10-04T08:00:00.345Z");
  assert.equal(input.end_time, "2026-10-04T09:30:00.345Z");
  await page.getByRole("button", { name: "עריכת דיווח לקוח בדיקה", exact: true }).click();
  await page.getByLabel("שעת סיום", { exact: true }).fill("2026-10-04T10:45");
  assert.equal(await page.getByLabel("שעות", { exact: true }).inputValue(), "2");
  assert.equal(await page.getByLabel("דקות", { exact: true }).inputValue(), "45");
  await page.getByLabel("שעת התחלה", { exact: true }).last().fill("2026-10-04T09:00");
  assert.equal(await page.getByLabel("שעות", { exact: true }).inputValue(), "1");
  assert.equal(await page.getByLabel("דקות", { exact: true }).inputValue(), "45");
  await page.close();
});

test("zero and future durations cannot save and failure retains entered duration", async () => {
  const page = await open();
  await page.getByRole("button", { name: "עריכת דיווח לקוח בדיקה", exact: true }).click();
  await page.getByLabel("שעות", { exact: true }).fill("0");
  await page.getByRole("button", { name: "שמירת שינויים", exact: true }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(await page.evaluate(() => window.testTimer.calls.length), 0);
  await page.getByLabel("שעות", { exact: true }).fill("99999");
  await page.getByRole("button", { name: "שמירת שינויים", exact: true }).click();
  await page.getByText("שעות ההתחלה והסיום לא יכולות להיות בעתיד", { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.testTimer.calls.length), 0);
  await page.getByLabel("שעות", { exact: true }).fill("1");
  await page.getByLabel("דקות", { exact: true }).fill("25");
  await page.evaluate(() => {
    window.testTimer.fail = true;
  });
  await page.getByRole("button", { name: "שמירת שינויים", exact: true }).click();
  await page.getByText("שמירה נכשלה לבדיקה", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("דקות", { exact: true }).inputValue(), "25");
  await page.close();
});

test("loaded history shows newly saved timer and refreshes stale versions", async () => {
  const page = await open();
  await page.getByRole('button',{name:'כל הדיווחים',exact:true}).click();
  await page.getByRole('button',{name:'רענון היסטוריה',exact:true}).waitFor();
  await page.evaluate(()=>{
    window.testTimer.newEntry={...window.testTimer.snapshot.entries[0],id:'new-entry',notes:'just saved',start_time:new Date().toISOString()};
  });
  await page.getByRole('button',{name:'עצירה ושמירה',exact:true}).click();
  await page.getByText('just saved',{exact:true}).waitFor();
  await page.evaluate(()=>{
    window.testTimer.snapshot.entries[1].edit_version='9';
    window.testTimer.snapshot.entries[1].notes='remote history update';
  });
  await page.getByRole('button',{name:'רענון היסטוריה',exact:true}).click();
  const old = page.locator('article').filter({hasText:'remote history update'});
  await old.getByRole('button',{name:'עריכת דיווח לקוח בדיקה',exact:true}).click();
  await page.getByLabel('דקות',{exact:true}).fill('20');
  await page.getByRole('button',{name:'שמירת שינויים',exact:true}).click();
  await page.getByText('הדיווח עודכן',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.testTimer.calls.at(-1).input.edit_version),'9');
  await page.close();
});
