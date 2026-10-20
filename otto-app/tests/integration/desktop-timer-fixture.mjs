import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

// The runtime is installed in a temporary directory, never in project dependencies.
// Run with OTTO_PGLITE_MODULE=/absolute/path/to/pglite/dist/index.js.
export async function createTimerDatabase() {
  if (!process.env.OTTO_PGLITE_MODULE)
    throw new Error("Set OTTO_PGLITE_MODULE to the temporary PGlite runtime");
  const runtime = pathToFileURL(process.env.OTTO_PGLITE_MODULE);
  const { PGlite } = await import(runtime.href);
  const extensions = {};
  for (const name of ["pgcrypto", "pg_trgm", "unaccent"]) {
    const extension = await import(new URL(`./contrib/${name}.js`, runtime).href);
    extensions[name] = extension[name];
  }
  const db = new PGlite({ extensions });
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
    create function auth.role() returns text language sql stable as $$
      select nullif(current_setting('request.jwt.claim.role',true),'')
    $$;
    create function auth.email() returns text language sql stable as $$ select 'fixture@example.invalid'::text $$;
    grant usage on schema auth to anon, authenticated, service_role;
  `);
  const migrations = new URL("../../supabase/migrations/", import.meta.url);
  let baseline = await readFile(new URL("00000000000000_baseline.sql", migrations), "utf8");
  // The recovery snapshot writes four computed columns as illegal column-referencing
  // DEFAULTs. Normalize only these fixture DDL lines; preserve the actual expressions.
  // This does not change the repository baseline or the migration under test.
  const generated = [
    [
      "total_amount numeric(10,2) DEFAULT (purchased_hours * hourly_rate)",
      "total_amount numeric(10,2) GENERATED ALWAYS AS (purchased_hours * hourly_rate) STORED",
    ],
    [
      "amount numeric(12,2) DEFAULT round((quantity * unit_price), 2)",
      "amount numeric(12,2) GENERATED ALWAYS AS (round((quantity * unit_price), 2)) STORED",
    ],
    [
      "tax_amount numeric(12,2) DEFAULT round(((subtotal * tax_rate) / (100)::numeric), 2)",
      "tax_amount numeric(12,2) GENERATED ALWAYS AS (round(((subtotal * tax_rate) / (100)::numeric), 2)) STORED",
    ],
    [
      "total_amount numeric(12,2) DEFAULT round((subtotal + ((subtotal * tax_rate) / (100)::numeric)), 2)",
      "total_amount numeric(12,2) GENERATED ALWAYS AS (round((subtotal + ((subtotal * tax_rate) / (100)::numeric)), 2)) STORED",
    ],
  ];
  for (const [original, replacement] of generated) {
    if (!baseline.includes(original))
      throw new Error("Baseline fixture normalization needs review");
    baseline = baseline.replace(original, replacement);
  }
  async function load(name, sql) {
    try {
      await db.exec(sql);
    } catch (error) {
      throw new Error(`${name}: ${error.message}`);
    }
  }
  await load("normalized recovery baseline", baseline);
  await load(
    "fixture grants and own-timer policy",
    `
    grant usage on schema public to anon,authenticated,service_role;
    grant select,insert,update,delete on public.active_timers to authenticated;
    create policy "users see own active timer" on public.active_timers for all
      using (user_id=auth.uid() and tenant_id=public.current_tenant_id())
      with check (user_id=auth.uid() and tenant_id=public.current_tenant_id());
  `,
  );
  // Execute each migration separately so the new enum value is committed before use.
  for (const name of [
    "20260703100000_billing_engine_fixes.sql",
    "20260803100000_time_entry_settled_externally.sql",
    "20261005120000_reliable_desktop_timer.sql",
    "20261005130000_desktop_timer_delete.sql",
    "20261008140000_desktop_timer_history.sql",
  ]) {
    await load(name, await readFile(new URL(name, migrations), "utf8"));
  }
  return db;
}

export const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const ids = {
  tenant: id(1),
  otherTenant: id(2),
  user: id(3),
  teammate: id(4),
  outsider: id(5),
  client: id(6),
  hourly: id(11),
  bankCustomer: id(12),
  foreignCustomer: id(13),
  secondBankCustomer: id(14),
  bank: id(21),
  secondBank: id(22),
  project: id(31),
  task: id(41),
};
export const at = (minute) => new Date(Date.UTC(2026, 0, 1, 10, minute)).toISOString();

export async function seedTimerDatabase(db) {
  await db.exec("truncate auth.users,public.tenants cascade");
  await db.query(
    "insert into public.tenants(id,name,slug) values ($1,'Fixture One','fixture-one'),($2,'Fixture Two','fixture-two')",
    [ids.tenant, ids.otherTenant],
  );
  for (const [user, tenant, role] of [
    [ids.user, ids.tenant, "admin"],
    [ids.teammate, ids.tenant, "team"],
    [ids.outsider, ids.otherTenant, "admin"],
    [ids.client, ids.tenant, "client"],
  ]) {
    await db.query("insert into auth.users(id) values($1)", [user]);
    await db.query("insert into public.users(id,tenant_id,email,role) values($1,$2,$3,$4)", [
      user,
      tenant,
      `${user}@example.invalid`,
      role === "client" ? "team" : role,
    ]);
  }
  await db.query(
    "insert into public.tenant_settings(tenant_id,default_hourly_rate) values($1,425),($2,425)",
    [ids.tenant, ids.otherTenant],
  );
  for (const [customer, tenant, model, rate] of [
    [ids.hourly, ids.tenant, "hourly", 480],
    [ids.bankCustomer, ids.tenant, "hour_bank", null],
    [ids.foreignCustomer, ids.otherTenant, "hourly", null],
    [ids.secondBankCustomer, ids.tenant, "hour_bank", null],
  ]) {
    await db.query(
      "insert into public.customers(id,tenant_id,name,billing_model_default,hourly_rate_override) values($1,$2,'Fixture Customer',$3,$4)",
      [customer, tenant, model, rate],
    );
  }
  await db.query("update public.users set role='client',customer_id=$1 where id=$2", [
    ids.hourly,
    ids.client,
  ]);
  await db.query(
    "insert into public.hour_banks(id,tenant_id,customer_id,purchased_hours,hourly_rate) values($1,$2,$3,0.5,300),($4,$2,$5,2,350)",
    [ids.bank, ids.tenant, ids.bankCustomer, ids.secondBank, ids.secondBankCustomer],
  );
  await db.query(
    "insert into public.projects(id,tenant_id,customer_id,name) values($1,$2,$3,'Fixture Project')",
    [ids.project, ids.tenant, ids.bankCustomer],
  );
  await db.query(
    "insert into public.tasks(id,tenant_id,project_id,title) values($1,$2,$3,'Fixture Task')",
    [ids.task, ids.tenant, ids.project],
  );
}

export async function asRole(db, role, user, callback) {
  if (!["anon", "authenticated", "service_role"].includes(role))
    throw new Error("Invalid fixture role");
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    await tx.query(
      "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)",
      [user ?? "", role],
    );
    return callback(tx);
  });
}
export const desktop = (db, op, input = {}, user = ids.user) =>
  asRole(
    db,
    "authenticated",
    user,
    async (tx) =>
      (
        await tx.query("select public.desktop_timer($1,$2::jsonb) as result", [
          op,
          JSON.stringify(input),
        ])
      ).rows[0].result,
  );
export const bot = (db, op, input = {}, user = ids.user, tenant = ids.tenant) =>
  asRole(
    db,
    "service_role",
    null,
    async (tx) =>
      (
        await tx.query("select public.bot_timer($1,$2,$3,$4::jsonb) as result", [
          user,
          tenant,
          op,
          JSON.stringify(input),
        ])
      ).rows[0].result,
  );
export const session = (snapshot) => ({
  session_id: snapshot.active.session_id,
  revision: snapshot.active.revision,
});
