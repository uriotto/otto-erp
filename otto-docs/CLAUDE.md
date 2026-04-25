# CLAUDE.md — הוראות עבודה ל-Claude Code

> זהו הקובץ הכי חשוב בפרויקט. Claude Code קורא אותו בכל session. כאן מוגדרים החוקים, הסגנון, וה"אסור".

## מי אני (אורי)

- מומחה אוטומציה ובניית מערכות (Make, Airtable, Supabase, Next.js)
- **לא** מפתח מסורתי — אני בונה איתך, לא לבד
- עובד בעברית, התקשורת איתי תמיד בעברית
- אעדיף הסברים קצרים וברורים, פחות הנחיות תיאורטיות
- אוהב שאתה מסביר **למה** עשית בחירה, לא רק מה

## איך לעבוד איתי

### תקשורת

1. **תמיד בעברית** — בתשובות, בהסברים, בהערות בקוד (אבל שמות משתנים, פונקציות, וטיפוסים — באנגלית)
2. **תהיה תמציתי** — אל תפרט בלי שביקשתי
3. **תאמר "לא יודע" אם אתה לא בטוח** — לא לנחש
4. **תפסיק כשאתה לא בטוח** ושאל לפני שאתה ממשיך
5. **תציע אלטרנטיבות** כשאתה רואה גישה טובה יותר ממה שביקשתי

### זרימת עבודה

1. **לפני שאתה כותב קוד** — תאשר הבנה במשפט אחד
2. **תעבוד על משימה אחת בכל פעם** — לא לקפוץ בין דברים
3. **תעשה commit אחרי כל משימה משמעותית** עם הודעה ברורה בעברית
4. **תעצור לאישור** אחרי כל commit לפני המשך

### לפני כל phase

1. קרא את `tasks/phase-N.md` במלואו
2. סכם בקצרה מה אנחנו עומדים לעשות
3. שאל אם משהו לא ברור
4. רק אז התחל

## Stack — מה משתמשים

```
Frontend:    Next.js 16 (App Router) + React 19 + TypeScript Strict
UI:          TailwindCSS 4 + shadcn/ui + Lucide icons
State:       TanStack Query (server) + Zustand (client)
Forms:       React Hook Form + Zod validation
Database:    Supabase (PostgreSQL 15+ + RLS + pgvector)
Auth:        Supabase Auth
Storage:     Supabase Storage + Google Drive (recordings only)
Hosting:     Vercel
PWA:         next-pwa
AI:          Anthropic SDK (Claude) + Google AI SDK (Gemini fallback)
Embeddings:  OpenAI text-embedding-3-small (לזול וטוב)
Automation:  Make.com (חיצוני)
```

## חוקי קוד

### TypeScript

```typescript
// ✅ טוב
type Customer = {
  id: string;
  name: string;
  billingModel: 'hourly' | 'hour_bank' | 'fixed_price' | 'retainer';
  hourlyRateOverride?: number;
};

// ❌ אסור
const customer: any = {...};  // any אסור
function process(data) {...}   // implicit any אסור
```

**חוקים:**

- `strict: true` ב-tsconfig
- אין `any` — אם צריך, השתמש ב-`unknown` ועשה type narrowing
- `interface` רק לextend; אחרת `type`
- Exports נקיים — אין default exports בקוד עסקי (רק ב-pages/components של Next.js כשנדרש)

### Next.js 16

- **Server Components ברירת מחדל** — `'use client'` רק כשחייבים (state, effects, browser APIs)
- **Server Actions** לכל מוטציה — לא API routes לפעולות פנימיות
- **API routes** רק ל-webhooks חיצוניים
- **Streaming + Suspense** לדפים כבדים
- **Metadata API** לכל דף

### Supabase

- **RLS מופעל מההתחלה** על כל טבלה
- **כל policy עם בדיקה** — `tenant_id = auth.jwt() ->> 'tenant_id'`
- **Service Role Key רק בצד שרת** — אסור ב-client
- **Migrations incrementally** — אל תשנה migration קיים, צור חדש
- **Types אוטומטיים** — `npx supabase gen types typescript`

### RTL — קריטי

זה לא "להוסיף בסוף" — זה מההתחלה.

```tsx
// ❌ אסור
<div className="ml-4 pr-2 text-left">

// ✅ נכון — Tailwind logical properties
<div className="ms-4 pe-2 text-start">
```

**חוקים:**

- `ms-*`, `me-*` במקום `ml-*`, `mr-*`
- `ps-*`, `pe-*` במקום `pl-*`, `pr-*`
- `text-start`, `text-end` במקום `text-left`, `text-right`
- `<html dir="rtl" lang="he">` ב-root layout
- אייקונים שמייצגים כיוון (chevron, arrow) צריכים `rtl:rotate-180`

### עברית

- **כל הטקסט ב-UI בעברית** — אין hardcoded English strings
- **מספרים תמיד LTR** — `<span dir="ltr">{number}</span>` כשמעורב בטקסט עברי
- **תאריכים בפורמט ישראלי** — `dd.mm.yyyy` או `dd ב{month} yyyy`
- **שעות בפורמט 24** — `14:30` ולא `2:30 PM`
- **מטבע**: `₪` לפני המספר — `₪1,200`

### מבנה תיקיות

```
/app
  /(auth)              # קבוצת routes לאימות
    login/
    signup/
  /(app)               # קבוצת routes לאפליקציה הראשית
    dashboard/
    customers/
    projects/
    layout.tsx         # Layout עם Sidebar
  /(portal)            # קבוצת routes לפורטל לקוחות
    [customerId]/
  /api
    webhooks/
      whatsapp/
      zoom/
      finbot/
  layout.tsx           # Root layout עם dir="rtl"

/components
  /ui                  # shadcn primitives
  /domain              # רכיבים עסקיים (CustomerCard, HourBankBar)
  /layout              # Sidebar, Header

/lib
  /supabase
    client.ts          # browser client
    server.ts          # server client
    types.ts           # auto-generated
  /actions             # Server Actions
    customers.ts
    hour-banks.ts
  /ai
    claude.ts
    embeddings.ts
  /integrations
    make.ts
    green-api.ts
    finbot.ts

/hooks
/types
/styles

/supabase
  /migrations
  config.toml
```

### שמות

```typescript
// קבצים: kebab-case
customer - card.tsx;
hour - bank - progress.tsx;

// קומפוננטות: PascalCase
export function CustomerCard() {}
export function HourBankProgress() {}

// פונקציות: camelCase
function calculateRemainingHours() {}

// קבועים: SCREAMING_SNAKE
const MAX_OVERAGE_HOURS = 10;

// טבלאות DB: snake_case (פלורל)
(customers, hour_banks, time_entries);

// שדות DB: snake_case
(customer_id, hourly_rate_override);
```

## אסור — דברים שאסור לעשות

❌ **לעשות `any` ב-TypeScript** — תמיד טיפוס מדויק
❌ **לכתוב הערות מיותרות** — קוד טוב מסביר את עצמו, הערות רק ל-WHY
❌ **`<form action="/api/...">`** — תמיד Server Actions
❌ **לעשות `localStorage` לdata חשוב** — רק UI preferences
❌ **לקודד strings בקוד** — או מ-DB או מקבץ constants
❌ **לעשות N+1 queries** — תמיד lookup מובנה ב-Supabase
❌ **לדלג על RLS** — גם אם זה "רק אורי" עכשיו
❌ **לערבב async/await עם .then()** — בחר אחד
❌ **לעשות try/catch בלי לטפל** — או טפל או remove
❌ **עיגול שעות במערכת hour banks** — מדויק לדקה תמיד
❌ **לשלוח דוח ללקוח אוטומטית** — תמיד דורש אישור ידני של אורי
❌ **לכתוב migrations כ-monolith** — incremental תמיד
❌ **לוותר על types של Supabase** — להריץ `gen types` אחרי כל migration

## תמיד — דברים שתמיד עושים

✅ **לבדוק את ה-PRD לפני שאתה מתחיל** — אל תמציא דרישות
✅ **לציית ל-DESIGN.md** — לא להמציא צבעים/פונטים
✅ **לוודא RLS על טבלה חדשה** — לפני commit
✅ **להריץ tests** — לפני commit
✅ **לעדכן types** — אחרי כל migration
✅ **לכתוב unit tests ללוגיקה עסקית** — Hour banks, חיוב, overage
✅ **לבדוק במובייל** — PWA אמור לעבוד מושלם
✅ **לבדוק RTL** — הטקסט זורם נכון? אייקונים בכיוון נכון?
✅ **לעשות commits קטנים** — מסר ברור בעברית
✅ **לעדכן את DECISIONS.md** — אם החלטת משהו ארכיטקטוני חדש

## דוגמאות קוד מועדפות

### Server Action

```typescript
// app/actions/customers.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const CreateCustomerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional(),
  billingModel: z.enum(["hourly", "hour_bank", "fixed_price", "retainer"]),
});

export async function createCustomer(input: unknown) {
  const data = CreateCustomerSchema.parse(input);
  const supabase = await createClient();

  const { data: customer, error } = await supabase
    .from("customers")
    .insert({
      name: data.name,
      email: data.email,
      billing_model: data.billingModel,
    })
    .select()
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/customers");
  return { ok: true, customer };
}
```

### Server Component עם data

```typescript
// app/(app)/customers/page.tsx
import { createClient } from '@/lib/supabase/server';
import { CustomersList } from '@/components/domain/customers-list';

export default async function CustomersPage() {
  const supabase = await createClient();
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, billing_model, created_at')
    .order('created_at', { ascending: false });

  return <CustomersList customers={customers ?? []} />;
}
```

### Client Component (רק כשחייבים)

```typescript
// components/domain/timer.tsx
'use client';

import { useEffect, useState } from 'react';
import { useTimerStore } from '@/lib/stores/timer';

export function Timer() {
  const { isRunning, elapsed, start, stop } = useTimerStore();
  const [display, setDisplay] = useState('00:00:00');

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setDisplay(formatElapsed(elapsed));
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, elapsed]);

  return (
    <button onClick={isRunning ? stop : start}>
      <span dir="ltr">{display}</span>
    </button>
  );
}
```

## Loop משוב

אחרי כל phase שמסתיים, אני אחזור אליך עם:

- מה עבד טוב
- מה לא עבד
- שינויים שצריך לעשות

תעדכן את הקובץ הזה (CLAUDE.md) במהלך הזמן עם דברים שלמדנו ביחד. זה living document.

## אם אתה תקוע

אם אתה מגיע לסיטואציה שלא ברורה לך:

1. **תעצור** — אל תנחש
2. **תסביר את הבעיה** בעברית במשפט-שניים
3. **תציע 2-3 אפשרויות** עם יתרונות/חסרונות של כל אחת
4. **תשאל אותי לבחור**

זה תמיד עדיף על קוד שגוי שצריך לתקן אחר כך.

---

**תזכורת אחרונה:** אנחנו בונים מערכת שאני אעבוד בה כל יום במשך שנים. איכות > מהירות. נכון > מהר.
