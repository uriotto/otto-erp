# Calendar: Google Meet + Guests

**Date:** 2026-05-07  
**Status:** Approved

## Context

Currently the calendar event form has a free-text `location` field (placeholder: "כתובת / קישור Zoom"). There is no way to auto-generate a video meeting link or invite guests. Google Calendar sync already works bidirectionally.

The user wants two features:
1. Auto-generate a Google Meet link when creating an event (checkbox)
2. Add guest attendees by email — Google Calendar sends invitations automatically

## Database Changes

### Migration 1 — Add `meeting_url` to `events`
```sql
ALTER TABLE events ADD COLUMN meeting_url text;
```

### Migration 2 — New `event_guests` table
```sql
CREATE TABLE event_guests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL REFERENCES tenants(id),
  email      text NOT NULL,
  name       text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE event_guests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant isolation" ON event_guests
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
```

## UI Changes (event-dialog.tsx)

### Google Meet checkbox
- Below the `location` field: checkbox "הוסף קישור Google Meet"
- In edit mode: if `meeting_url` exists, show a clickable link badge instead of the checkbox
- Hidden input `create_meet` submitted with form

### Guests section
- Label "אורחים" with email text input + "הוסף" button
- If a customer is selected and has an email → show "הוסף [customer name]" shortcut button
- Rendered list of added guests with × remove button
- Emails stored in a local state array; submitted as `guests[]` repeated form fields

## Actions Changes (actions.ts)

### createEvent
1. Parse `create_meet: boolean` and `guests: string[]` from formData
2. Insert event into Supabase
3. Call `createGoogleEvent(tenantId, { ..., create_meet, attendees: guests })`
4. Google returns event with Meet URL → store in `events.meeting_url`
5. Insert rows into `event_guests` for each guest email

### updateEvent
1. Parse same fields
2. Update event in Supabase
3. If `google_event_id` exists: call `updateGoogleEvent(...)` with current attendees list
4. Replace `event_guests` rows for this event (delete + re-insert)

## Google Calendar Library Changes (lib/google-calendar.ts)

### createGoogleEvent — add to request body:
```ts
...(create_meet && {
  conferenceData: {
    createRequest: {
      requestId: crypto.randomUUID(),
      conferenceSolutionKey: { type: 'hangoutsMeet' },
    },
  },
}),
attendees: attendees.map(email => ({ email })),
sendUpdates: 'all',
```
Query param: `conferenceDataVersion=1`

After creation, read back:
```ts
const meetUrl = response.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri ?? null;
```
Return `meetUrl` alongside `googleEventId`.

### updateGoogleEvent — same attendees + sendUpdates handling.

## EventItem type (event-dialog.tsx)

Add `meeting_url` to the `Pick` from `Tables<"events">`. Fetch `event_guests` alongside event in the calendar page and pass as a prop.

## Files to Change

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDDHHMMSS_calendar_meet_guests.sql` | new migration |
| `lib/supabase/types.ts` | regenerate after migration |
| `app/(app)/calendar/event-dialog.tsx` | Meet checkbox + guests UI |
| `app/(app)/calendar/actions.ts` | handle meet + guests |
| `app/(app)/calendar/page.tsx` | fetch event_guests per event |
| `lib/google-calendar.ts` | conferenceData + attendees support |

## Verification

1. Create event with "הוסף קישור Google Meet" checked → event saved with `meeting_url` → open Google Calendar and confirm Meet link visible
2. Add two guest emails → both receive Google Calendar invitation email
3. Select customer with email → click shortcut → email auto-fills
4. Edit existing event → Meet badge shows, guests editable
5. Delete event → `event_guests` cascade deleted
