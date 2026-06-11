# Calendar: Google Meet + Guests — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Google Meet link auto-generation and multi-guest invitations to the calendar event form, synced bidirectionally with Google Calendar.

**Architecture:** DB migration adds `events.meeting_url` and a new `event_guests` table. The Google Calendar library gets attendees + conferenceData support. The event dialog gets a Meet checkbox and a guest email list with customer auto-fill. Google Calendar sends invitations to guests automatically.

**Tech Stack:** Next.js 16 Server Actions, Supabase (Postgres + RLS), Google Calendar API v3, TypeScript strict, Tailwind RTL

---

## Context (read before starting)

- Calendar page: `otto-app/app/(app)/calendar/`
- Google Calendar library: `otto-app/lib/google-calendar.ts`
- Event form (client component): `otto-app/app/(app)/calendar/event-dialog.tsx`
- Server Actions: `otto-app/app/(app)/calendar/actions.ts`
- Calendar page (server): `otto-app/app/(app)/calendar/page.tsx`
- Supabase types (auto-generated, do NOT hand-edit): `otto-app/lib/supabase/types.ts`
- All commands run from `otto-app/`

---

### Task 1: DB Migration — `meeting_url` + `event_guests`

**Files:**
- Create: `otto-app/supabase/migrations/<timestamp>_calendar_meet_guests.sql`

**Step 1: Create the migration file**

Generate the timestamp with `date -u +%Y%m%d%H%M%S` and create the file:

```sql
-- Add meeting_url to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS meeting_url text;

-- event_guests table
CREATE TABLE IF NOT EXISTS event_guests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email      text NOT NULL,
  name       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE event_guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant isolation" ON event_guests
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_event_guests_event_id ON event_guests(event_id);
```

**Step 2: Apply migration via Supabase MCP**

Use `mcp__claude_ai_Supabase__apply_migration` with the SQL above.

**Step 3: Regenerate TypeScript types**

Use `mcp__claude_ai_Supabase__generate_typescript_types` and overwrite `otto-app/lib/supabase/types.ts`.

**Step 4: Verify**

Run: `npm run typecheck`
Expected: no errors (types now include `event_guests` and `events.meeting_url`)

**Step 5: Commit**

```bash
git add otto-app/supabase/migrations/ otto-app/lib/supabase/types.ts
git commit -m "feat(calendar): add meeting_url to events + event_guests table"
```

---

### Task 2: Update Google Calendar Library

**Files:**
- Modify: `otto-app/lib/google-calendar.ts`

**Step 1: Understand current interface**

Read `otto-app/lib/google-calendar.ts`. The `createGoogleEvent` and `updateGoogleEvent` functions accept an object with `{ title, description, location, start_at, end_at, all_day }`. We need to add `attendees?: string[]` and `create_meet?: boolean`.

**Step 2: Update the type/interface for event payload**

Find the type definition for the event payload (likely an inline type or interface). Add:
```ts
attendees?: string[];
create_meet?: boolean;
```

**Step 3: Update `createGoogleEvent` body construction**

Inside the function that builds the Google Calendar event body, add:

```ts
// Conference (Google Meet)
...(params.create_meet && {
  conferenceData: {
    createRequest: {
      requestId: crypto.randomUUID(),
      conferenceSolutionKey: { type: 'hangoutsMeet' },
    },
  },
}),

// Attendees
...(params.attendees && params.attendees.length > 0 && {
  attendees: params.attendees.map(email => ({ email })),
}),

sendUpdates: params.attendees && params.attendees.length > 0 ? 'all' : 'none',
```

**Step 4: Add `conferenceDataVersion=1` query param**

Find the Google API URL for inserting a calendar event. Add `&conferenceDataVersion=1` to the URL (or as a query param object). This is required by Google API for conferenceData to work.

**Step 5: Extract Meet URL from response and return it**

After the API call in `createGoogleEvent`, extract the Meet link:

```ts
const meetUrl: string | null =
  responseBody?.conferenceData?.entryPoints?.find(
    (e: { entryPointType: string; uri: string }) => e.entryPointType === 'video'
  )?.uri ?? null;
```

Change the return type of `createGoogleEvent` from `string` (just googleEventId) to:
```ts
{ googleEventId: string; meetUrl: string | null }
```

**Step 6: Update `updateGoogleEvent` similarly**

Add the same `attendees` + `sendUpdates` fields to the update body. No `conferenceData` on update (Meet link already exists). Return type doesn't need to change.

**Step 7: Typecheck**

Run: `npm run typecheck`
Expected: errors only in callers (`actions.ts`) since return type changed — fix those in Task 3.

---

### Task 3: Update Server Actions

**Files:**
- Modify: `otto-app/app/(app)/calendar/actions.ts`

**Step 1: Extend the Zod schema**

In `EventSchema`, add:
```ts
create_meet: z.boolean().default(false),
guests: z.array(z.string().email()).default([]),
```

Note: `guests` comes from repeated `guests[]` form fields. Parse them with:
```ts
const raw = {
  ...Object.fromEntries(formData.entries()),
  all_day: formData.get("all_day") === "true",
  create_meet: formData.get("create_meet") === "true",
  guests: formData.getAll("guests").filter(Boolean),
};
```

**Step 2: Update `createEvent`**

After inserting the event into Supabase:

```ts
// Pass to Google Calendar
let meetUrl: string | null = null;
try {
  const result = await createGoogleEvent(profile.tenant_id, {
    title: d.title,
    description: nullIfEmpty(d.description),
    location: nullIfEmpty(d.location),
    start_at: d.start_at,
    end_at: d.end_at,
    all_day: d.all_day,
    create_meet: d.create_meet,
    attendees: d.guests,
  });
  meetUrl = result.meetUrl;
  await supabase
    .from("events")
    .update({ google_event_id: result.googleEventId, meeting_url: meetUrl })
    .eq("id", ev.id);
} catch (err) {
  console.error("Google Calendar createEvent failed:", err);
}

// Save guests
if (d.guests.length > 0) {
  await supabase.from("event_guests").insert(
    d.guests.map(email => ({
      event_id: ev.id,
      tenant_id: profile.tenant_id,
      email,
    }))
  );
}
```

**Step 3: Update `updateEvent`**

After updating the event in Supabase, update Google Calendar with attendees. Then replace guests:

```ts
// Replace event_guests
await supabase.from("event_guests").delete().eq("event_id", id);
if (d.guests.length > 0) {
  await supabase.from("event_guests").insert(
    d.guests.map(email => ({
      event_id: id,
      tenant_id: profile.tenant_id,
      email,
    }))
  );
}
```

Also update the Google event with attendees:
```ts
await updateGoogleEvent(profile.tenant_id, existing.google_event_id, {
  ...,
  attendees: d.guests,
});
```

**Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors

**Step 5: Commit**

```bash
git add otto-app/app/(app)/calendar/actions.ts otto-app/lib/google-calendar.ts
git commit -m "feat(calendar): server actions support Google Meet + guests"
```

---

### Task 4: Update Calendar Page — Fetch Guests

**Files:**
- Modify: `otto-app/app/(app)/calendar/page.tsx`
- Modify: `otto-app/app/(app)/calendar/calendar-client.tsx`

**Step 1: Read page.tsx**

Find where events are fetched. Currently it selects fields from `events`. Add a join to fetch guests.

**Step 2: Fetch guests alongside events**

Option A — separate query approach (simpler):
```ts
const { data: allGuests } = await supabase
  .from("event_guests")
  .select("event_id, email, name");

// Then pass to client component
```

Option B — join: `select("..., event_guests(email, name)")` (Supabase supports this).

Use Option B (one query):
```ts
.select("id, title, ..., meeting_url, event_guests(email, name)")
```

**Step 3: Update the type passed to EventDialog**

In `event-dialog.tsx`, extend `EventItem`:
```ts
export type EventItem = Pick<
  Tables<"events">,
  | "id" | "title" | "start_at" | "end_at" | "all_day" | "type"
  | "customer_id" | "project_id" | "description" | "location" | "meeting_url"
> & {
  guests?: { email: string; name: string | null }[];
};
```

**Step 4: Pass guests to EventDialog where it's rendered**

In the client component that opens EventDialog on event click, pass the guests array from the selected event.

**Step 5: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: clean

---

### Task 5: Update EventDialog UI

**Files:**
- Modify: `otto-app/app/(app)/calendar/event-dialog.tsx`

**Step 1: Add state**

```ts
const [createMeet, setCreateMeet] = useState(false);
const [guestInput, setGuestInput] = useState("");
const [guests, setGuests] = useState<string[]>(
  event?.guests?.map(g => g.email) ?? []
);
```

**Step 2: Add hidden inputs for form submission**

Inside the `<form>`:
```tsx
<input type="hidden" name="create_meet" value={String(createMeet)} />
{guests.map((email, i) => (
  <input key={i} type="hidden" name="guests" value={email} />
))}
```

**Step 3: Google Meet section**

Add after the Location field:

```tsx
{/* Google Meet */}
{event?.meeting_url ? (
  <div>
    <label className="text-ink-soft mb-1 block text-[12px] font-medium">
      קישור Google Meet
    </label>
    <a
      href={event.meeting_url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-navy text-[13px] underline"
      dir="ltr"
    >
      {event.meeting_url}
    </a>
  </div>
) : (
  <label className="flex cursor-pointer items-center gap-2">
    <input
      type="checkbox"
      checked={createMeet}
      onChange={(e) => setCreateMeet(e.target.checked)}
      className="border-ink-line accent-navy h-4 w-4 rounded"
    />
    <span className="text-ink-soft text-[13px]">הוסף קישור Google Meet</span>
  </label>
)}
```

**Step 4: Guests section**

Add after the Meet section:

```tsx
{/* Guests */}
<div>
  <label className="text-ink-soft mb-1 block text-[12px] font-medium">
    אורחים
  </label>

  {/* Customer email shortcut */}
  {selectedCustomer && (() => {
    const customer = customers.find(c => c.id === selectedCustomer);
    // only if customer has email — we need to pass email in CustomerOption
    if (!customer?.email || guests.includes(customer.email)) return null;
    return (
      <button
        type="button"
        onClick={() => setGuests(prev => [...prev, customer.email!])}
        className="text-navy mb-2 text-[12px] underline"
      >
        + הוסף {customer.name}
      </button>
    );
  })()}

  {/* Guest list */}
  <div className="mb-2 space-y-1">
    {guests.map(email => (
      <div key={email} className="flex items-center justify-between rounded-md bg-cream-deep px-2 py-1">
        <span className="text-navy text-[12px]" dir="ltr">{email}</span>
        <button
          type="button"
          onClick={() => setGuests(prev => prev.filter(e => e !== email))}
          className="text-ink-soft hover:text-rose-500 ms-2"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    ))}
  </div>

  {/* Add input */}
  <div className="flex gap-2">
    <input
      type="email"
      value={guestInput}
      onChange={(e) => setGuestInput(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (guestInput && !guests.includes(guestInput)) {
            setGuests(prev => [...prev, guestInput]);
            setGuestInput("");
          }
        }
      }}
      placeholder="אימייל אורח"
      className="border-ink-line bg-cream-deep text-navy placeholder:text-ink-faded focus:border-navy focus:ring-navy/30 w-full rounded-lg border px-3 py-2 text-[13px] focus:ring-1 focus:outline-none"
      dir="ltr"
    />
    <button
      type="button"
      onClick={() => {
        if (guestInput && !guests.includes(guestInput)) {
          setGuests(prev => [...prev, guestInput]);
          setGuestInput("");
        }
      }}
      className="border-ink-line text-ink-soft hover:bg-cream-deep rounded-lg border px-3 py-2 text-[12px]"
    >
      +
    </button>
  </div>
</div>
```

**Step 5: Update CustomerOption type**

In `event-dialog.tsx`, add `email` to CustomerOption:
```ts
type CustomerOption = { id: string; name: string; email: string | null };
```

In `page.tsx` / wherever customers are fetched, include `email` in the select.

**Step 6: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: clean

**Step 7: Commit**

```bash
git add otto-app/app/(app)/calendar/
git commit -m "feat(calendar): Google Meet checkbox + multi-guest UI"
```

---

### Task 6: End-to-End Verification

**Step 1: Start dev server**
```bash
npm run dev
```

**Step 2: Test Google Meet creation**
1. Open http://localhost:3000/calendar
2. Click a day → "אירוע חדש"
3. Fill title + time
4. Check "הוסף קישור Google Meet"
5. Save → confirm event saved
6. Open Google Calendar → confirm event has a Meet link

**Step 3: Test guests**
1. Create new event
2. Add two guest emails via the input
3. Save → confirm those guests appear in Google Calendar event
4. Check that both guests received email invitations from Google Calendar

**Step 4: Test customer auto-fill**
1. Create event, select a customer that has an email
2. Confirm "הוסף [name]" button appears
3. Click it → email added to guests list

**Step 5: Test edit mode**
1. Click existing event with Meet URL → confirm URL shown as link, not checkbox
2. Edit guests → save → confirm Google Calendar updated

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat(calendar): Google Meet + guests — complete"
```
