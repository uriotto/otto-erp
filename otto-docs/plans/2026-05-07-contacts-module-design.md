# Contacts Module — Design Document

**תאריך:** 2026-05-07  
**סטטוס:** מאושר

---

## רקע

לקוחות שהם עסקים/חברות עשויים להכיל כמה אנשי קשר (מנהל פרויקט, רואה חשבון, בעלים). בנוסף, יש אנשי קשר עסקיים שאינם לקוחות — ספקים, מעצבים, שותפים. המערכת כרגע מאפשרת שדה email ו-phone אחד בלבד ברמת הלקוח, ללא אפשרות לאנשי קשר מרובים.

---

## החלטות עיצוב

### 1. שמירה על שדות הלקוח הקיימים
`customer.email` ו-`customer.phone` נשארים כמו שהם — "איש קשר ראשי". אפס migration, אפס שבירת פיצ'רים קיימים (פורטל, חוזים, דוחות).

### 2. contacts כישות עצמאית עם קישור אופציונלי ללקוח
`customer_id` הוא nullable — contact יכול להיות מקושר ללקוח, או לעמוד בפני עצמו (ספק, רואה חשבון).

### 3. ללא קישור לפרויקט/משימה
בשלב זה — YAGNI. הקשר לפרויקט קיים בעקיפין דרך הלקוח.

---

## Schema — טבלת `contacts`

```sql
CREATE TABLE contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  name        text NOT NULL,
  role        text,
  email       text,
  phone       text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant isolation" ON contacts
  USING (tenant_id = current_tenant_id());
```

---

## UI

### עמוד `/contacts` (חדש — פריט בתפריט הצד)
- תצוגת טבלה + כרטיסיות (כמו לקוחות)
- פילטרים: חיפוש חופשי, סינון לפי לקוח, סינון לפי תפקיד
- כפתור "איש קשר חדש" עם dialog
- כל רשומה: שם, תפקיד, לקוח מקושר (עם קישור), email, כפתורי 📞 שיחה + 💬 WhatsApp, עריכה/מחיקה
- persist filters ב-localStorage (כמו שאר המסכים)

### `CustomerContactsSection` בעמוד הלקוח
- מוסף ל-`customer-related-sections.tsx` לצד הסקשנים הקיימים (פרויקטים, בנקי שעות, הצעות מחיר)
- רשימה קומפקטית של אנשי הקשר של הלקוח
- כפתור "+ איש קשר" — פותח dialog עם `customer_id` ממולא ונעול

---

## קומפוננטות

| קובץ | תפקיד |
|------|--------|
| `contacts/page.tsx` | Server Component — שולף contacts + customers לפילטר |
| `contacts/contacts-list.tsx` | Client Component — תצוגה, פילטרים, dialogs |
| `contacts/contacts-data.tsx` | Server Component wrapper |
| `contacts/actions.ts` | Server Actions: create, update, delete |
| `contacts/new-contact-dialog.tsx` | Dialog ליצירת/עריכת איש קשר |
| `customers/[id]/customer-related-sections.tsx` | הוספת `CustomerContactsSection` |

---

## Server Actions

```typescript
createContact(formData: FormData) // Zod validation, revalidatePath
updateContact(formData: FormData)
deleteContact(id: string)
```

---

## כפתורי פעולה מהירה

- **📞 שיחה:** `href="tel:{phone}"`
- **💬 WhatsApp:** `href="https://wa.me/{phoneE164}"` — מנקים את הטלפון (מסירים 0, מוסיפים 972)

---

## קבצים שייוצרו / ישונו

**חדשים:**
- `otto-app/app/(app)/contacts/page.tsx`
- `otto-app/app/(app)/contacts/contacts-list.tsx`
- `otto-app/app/(app)/contacts/contacts-data.tsx`
- `otto-app/app/(app)/contacts/actions.ts`
- `otto-app/app/(app)/contacts/new-contact-dialog.tsx`
- `otto-app/app/(app)/contacts/loading.tsx`
- `supabase/migrations/YYYYMMDD_contacts.sql`

**משונים:**
- `otto-app/app/(app)/customers/[id]/customer-related-sections.tsx` — הוספת `CustomerContactsSection`
- `otto-app/app/(app)/customers/[id]/page.tsx` — הוספת fetch contacts + העברה לסקשן
- `otto-app/components/layout/sidebar.tsx` — הוספת "אנשי קשר" לתפריט
- `otto-app/lib/supabase/types.ts` — רגנרציה אחרי migration

---

## אימות

1. יצירת contact חדש ללא לקוח — מופיע ב-`/contacts`
2. יצירת contact מתוך עמוד לקוח — מופיע בסקשן הלקוח וב-`/contacts`
3. מחיקת לקוח — contact שלו מתנתק (SET NULL), לא נמחק
4. לחיצה על WhatsApp — נפתח WhatsApp לנייד/ווב
5. פילטור לפי לקוח — רואה רק contacts שלו
