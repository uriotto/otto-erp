# Phase 2 — Core CRM

> **משך מתוכנן**: 3 שבועות
> **מטרה**: ניהול לקוחות, לידים, אנשי קשר. WhatsApp integration לקליטת לידים. מערכת התרעות.

## משימות

### 2.1 Customers Module

**Branch**: `phase-2.1-customers`

- [ ] Migration: טבלת `customers` + `contacts` לפי DATA_MODEL.md
- [ ] RLS policies מלאות
- [ ] Seed: יבוא 10 לקוחות פעילים מ-Airtable (one-time script)
- [ ] עמוד `/customers` — רשימה עם search + filter + tags
- [ ] עמוד `/customers/[id]` — כרטיס 360°:
  - פרטים בסיסיים (עריכה inline)
  - אנשי קשר (CRUD)
  - פרויקטים (placeholder — יתמלא ב-Phase 3)
  - חשבוניות (placeholder — Phase 4)
  - בנק שעות (placeholder — Phase 3)
  - הערות פנימיות
  - היסטוריית תקשורת (placeholder)
  - tags (CRUD)
- [ ] Server Actions: createCustomer, updateCustomer, archiveCustomer
- [ ] Custom Tags input עם autocomplete
- [ ] יצוא לקוחות ל-CSV
- [ ] Unit tests ל-Server Actions

**Acceptance**: אורי יוצר/מערוך/מארכב לקוחות, רואה כרטיס מלא.

---

### 2.2 Leads Module

**Branch**: `phase-2.2-leads`

- [ ] Migration: `leads` + `lead_activities`
- [ ] עמוד `/leads` — Pipeline Kanban (5 stages)
- [ ] גרירה בין stages (DnD Kit)
- [ ] עמוד `/leads/[id]` — פרטי ליד + activities timeline
- [ ] Lead Scoring algorithm פשוט (תקציב + דחיפות + התאמה)
- [ ] UTM tracking — קליטה מ-URL parameters
- [ ] המרת ליד ללקוח — modal עם פרטי customer
- [ ] Conversion analytics — דוח לפי source/חודש
- [ ] בדיקה ידנית של flow מלא: ליד → פגישה → המרה

**Acceptance**: pipeline נראה כמו במוקאפ, גרירה עובדת, המרה יוצרת customer.

---

### 2.3 Notification System

**Branch**: `phase-2.3-notifications`

- [ ] Migration: `notifications` + `notification_preferences`
- [ ] Supabase Realtime subscription לnotifications חדשות
- [ ] רכיב `<NotificationBell>` ב-header עם counter
- [ ] Dropdown של notifications + mark as read
- [ ] עמוד `/settings/notifications` — preference matrix:
  - 12 סוגי התרעות
  - 4 ערוצים (in_app, push, email, whatsapp)
  - בעמודה toggle לכל שילוב
- [ ] Server-side: function `dispatchNotification(userId, type, data)`:
  - יוצר record ב-DB
  - בודק preferences של המשתמש
  - שולח ב-channels הרלוונטיים (Push, Email, WhatsApp)
- [ ] Email sending: Resend או דרך Supabase Edge Function
- [ ] WhatsApp sending: דרך Make.com webhook → Green API

**Acceptance**: אורי מקבל notification בערוץ הנכון לפי הגדרותיו.

---

### 2.4 WhatsApp Integration (Green API)

**Branch**: `phase-2.4-whatsapp`

- [ ] חיבור Green API instance (אורי מספק credentials)
- [ ] Make scenario: WhatsApp incoming → webhook ל-`/api/webhooks/whatsapp`
- [ ] Endpoint `/api/webhooks/whatsapp`:
  - וולידציה (secret token)
  - חיפוש customer/lead לפי טלפון
  - אם לא נמצא → יצירת lead חדש (status: 'new', source: 'whatsapp')
  - שמירת המסר ב-`messages`
  - dispatchNotification ל-Admin
- [ ] עמוד `/messages` — תצוגה של כל ההודעות
- [ ] תצוגת תקשורת בכרטיס לקוח
- [ ] Server Action `sendWhatsAppMessage` דרך Make → Green API
- [ ] בדיקה: שליחת WhatsApp מהמערכת מגיעה ללקוח

**Acceptance**: WhatsApp נכנס יוצר ליד אוטומטית עם התרעה.

---

### 2.5 בדיקה לסיום Phase 2

- [ ] flow מלא: WhatsApp → ליד → המרה → לקוח עם כרטיס מלא
- [ ] בדיקה: כל ה-RLS עובד נכון
- [ ] תיוג: `v0.2.0-phase-2-complete`

---

## מה הלאה?

Phase 3 — Projects + Tasks + Time + **Hour Banks** (הלוגיקה הקריטית).
