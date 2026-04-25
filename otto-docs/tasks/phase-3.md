# Phase 3 — Projects + Tasks + Time + Hour Banks

> **משך מתוכנן**: 4 שבועות
> **מטרה**: ניהול פרויקטים עם היררכיה, משימות, טיימר persistent, ולוגיקת בנקי שעות מלאה.
> **קריטיות**: ⚠ Hour Banks הם הלוגיקה הכי מורכבת במערכת. דורשים unit tests מקיפים. **קרא את HOUR_BANKS.md עד הסוף לפני שאתה מתחיל.**

## משימות

### 3.1 Projects Module

**Branch**: `phase-3.1-projects`

- [ ] Migrations: `projects`, `project_templates`, `milestones`
- [ ] RLS policies מלאות
- [ ] עמוד `/projects` — גריד / רשימה
- [ ] פילטור: status, customer, tags, billing_model
- [ ] עמוד `/projects/[id]`:
  - פרטי פרויקט (עריכה inline)
  - משימות (placeholder — 3.2)
  - milestones (CRUD + Gantt mini)
  - מסמכים (placeholder — Phase 4)
  - שעות (placeholder — 3.4)
  - תת-פרויקטים (אם יש)
- [ ] תמיכה בהיררכיה — תצוגת tree
- [ ] תבניות פרויקט: 3-4 templates ראשוניות (אוטומציה Make, אפליקציית Next.js, ייעוץ חודשי)
- [ ] יצירה מתבנית: מעתיק משימות ושלבים
- [ ] חיבור אוטומטי לתיקיית Google Drive (Phase 4 יממש את ה-API; כאן רק שדה `google_drive_folder_id`)

**Acceptance**: יצירת פרויקט מתבנית יוצרת משימות אוטומטית.

---

### 3.2 Tasks Module

**Branch**: `phase-3.2-tasks`

- [ ] Migration: `tasks` עם תמיכה ב-subtasks
- [ ] עמוד `/tasks` — תצוגות:
  - רשימה
  - Kanban (status columns)
  - Calendar (לפי due_date)
  - Gantt בסיסי
- [ ] פילטור: project, assignee, priority, tag, status
- [ ] Quick Capture — כפתור + עם קיצור `Cmd+K` או `Ctrl+K`
- [ ] עריכה inline
- [ ] Recurring tasks — בסיסי (weekly, monthly)
- [ ] Subtasks — drag & drop
- [ ] מצב "היום" — תצוגה ממוקדת לרשימת היום

**Acceptance**: ניהול משימות חלק, מעבר בין תצוגות עובד.

---

### 3.3 Persistent Timer

**Branch**: `phase-3.3-timer`

- [ ] Zustand store ל-timer state
- [ ] שמירה ב-localStorage (start_time, task_id, customer_id)
- [ ] רכיב `<Timer>` ב-header — תצוגת זמן רץ
- [ ] בלחיצה: dropdown עם הפעלה / עצירה / שינוי משימה
- [ ] בלחיצה על משימה: כפתור "Start timer" שמתחיל טיימר עליה
- [ ] עצירה: יצירת `time_entry` אוטומטית
- [ ] התרעה אם טיימר רץ יותר מ-N שעות (ניתן להגדיר; ברירת מחדל: 4)
- [ ] התמודדות עם רענון דף — הטיימר ממשיך מאיפה שעצר
- [ ] התמודדות עם סגירת tab — שמור state, recover בפתיחה הבאה

**Acceptance**: טיימר ממשיך לרוץ אחרי רענון, יצירת time_entry מדויקת.

---

### 3.4 Time Entries Module

**Branch**: `phase-3.4-time-entries`

- [ ] Migration: `time_entries` (מבלי לוגיקת hour banks עדיין)
- [ ] עמוד `/time` — "פנקס שעות":
  - תצוגות: יומי / שבועי / חודשי
  - אגרגציה לפי customer / project / task
  - גרף עומסים שבועי
- [ ] הזנה רטרואקטיבית: form ידני
- [ ] עריכה ומחיקה (עם constraints — לא לעדכן entries שחויבו)
- [ ] ייבוא היסטורי מ-Toggl:
  - אורי מייצא CSV מ-Toggl
  - upload + mapping projects/customers
  - יצירת time_entries עם flag `imported_from_toggl`

**Acceptance**: רישום זמן + תצוגות עובדים, ייבוא Toggl עובד.

---

### 3.5 Hour Banks — Schema + Basic CRUD

**Branch**: `phase-3.5-hour-banks-schema`

- [ ] Migration: `hour_banks` לפי DATA_MODEL.md ו-HOUR_BANKS.md
- [ ] Migration: הוספת שדות ל-`time_entries`:
  - `consumed_from_bank_id`, `is_overage`, `billing_status`, `hourly_rate_at_entry`
- [ ] עמוד `/hour-banks` — רשימת בנקים פעילים
- [ ] עמוד `/customers/[id]/hour-banks` — בנקים של לקוח
- [ ] רכיב `<HourBankProgress>` (לפי המוקאפ) — visualization
- [ ] Server Action `createHourBank`:
  - וולידציות
  - יצירת רשומה
  - **חיוב מקדמה** דרך Make → Finbot (Phase 4 יממש Finbot; כאן placeholder עם TODO)
- [ ] Server Action `updateHourBank` — עריכת alerts thresholds, expiry
- [ ] Server Action `cancelHourBank`

**Acceptance**: יצירת בנק שעות, צפייה ב-progress.

---

### 3.6 Hour Banks — Allocation Logic

**Branch**: `phase-3.6-hour-banks-allocation`

⚠ **קרא את HOUR_BANKS.md תרחיש 2 ו-3 לפני שאתה מתחיל.**

- [ ] Server function `allocateTimeEntryToBank(entryId)`:
  - מציאת הבנק הפעיל (FIFO)
  - חישוב יתרה
  - 3 מקרים: ללא בנק / מספיק / לא מספיק (split)
- [ ] Trigger אוטומטי: בכל יצירת time_entry עם billable=TRUE → קריאה ל-allocateTimeEntryToBank
- [ ] חישוב אוטומטי של `available_hours(bank)` — view או function
- [ ] Server function `recalculateBank(bankId)` — לאחר עריכה/מחיקה של time_entry
- [ ] Update `billing_status` של entries אחרי הקצאה
- [ ] **Unit tests מלאים** לפי הרשימה ב-HOUR_BANKS.md (14 בדיקות)

**Acceptance**: כל ה-14 unit tests עוברים.

---

### 3.7 Hour Banks — Alerts + Renewal

**Branch**: `phase-3.7-hour-banks-alerts`

- [ ] Trigger אוטומטי אחרי כל allocation: בדיקת thresholds
- [ ] שליחת notification ב-30% / 3 שעות (פעם אחת לכל סוג, עם flags)
- [ ] יצירת **טיוטת חידוש אוטומטית** כשמתקבל threshold:
  - בנק חדש עם status='draft'
  - parent_bank_id = הבנק הנוכחי
  - אותם פרמטרים (purchased_hours, hourly_rate, expiry duration)
- [ ] עמוד `/hour-banks/draft-renewals` — רשימת חידושים ממתינים לאישור
- [ ] עמוד `/hour-banks/[id]/renew` — הצגת טיוטה, עריכה, אישור
- [ ] באישור: יצירת בנק חדש בפועל + שליחת הצעה ללקוח (placeholder ל-Phase 4)

**Acceptance**: ירידה מתחת ל-30% מפעילה התרעה + יוצרת טיוטה.

---

### 3.8 Hour Banks — Overage Handling

**Branch**: `phase-3.8-hour-banks-overage`

⚠ **קרא את HOUR_BANKS.md תרחיש 5.**

- [ ] בעת יצירת בנק חדש: בדיקה אם יש overage לא מטופל ללקוח
- [ ] Modal/dialog: 3 אפשרויות (לכלול בבנק / חשבונית נפרדת / לזרוק)
- [ ] Server function `absorbOverageIntoBank(bankId, overageEntryIds)`:
  - עדכון `absorbed_overage_hours`
  - עדכון time_entries: billing_status='allocated_to_bank', consumed_from_bank_id=newBankId
  - בדיקה: היתרה האפקטיבית של הבנק החדש = purchased - absorbed
- [ ] Server function `invoiceOverageSeparately(overageEntryIds)`:
  - יצירת חשבונית נפרדת ב-Finbot (placeholder ל-Phase 4)
  - עדכון entries ל-'invoiced'
- [ ] Server function `cancelOverage(overageEntryIds)`:
  - עדכון ל-'cancelled'
- [ ] תצוגת overage לא מטופל בכרטיס לקוח

**Acceptance**: כל 3 המסלולים עובדים, היתרות נכונות.

---

### 3.9 Hour Banks — Expiry Cron

**Branch**: `phase-3.9-hour-banks-expiry`

- [ ] Supabase Edge Function `check-expired-banks`:
  - מציאת בנקים active עם expiry_date < NOW()
  - אם יתרה > 0: notification + status='expired' (לא מחיקה)
  - אם יתרה = 0: status='depleted'
- [ ] Cron יומי דרך Supabase pg_cron
- [ ] עמוד `/hour-banks/expired` — בנקים שפג תוקפם עם יתרה
- [ ] אופציות: הארכת תפוגה / החזר כספי (manual)

**Acceptance**: בנק עם expiry בעבר משתנה ל-expired אוטומטית.

---

### 3.10 בדיקה לסיום Phase 3

- [ ] **התרחיש המלא מ-HOUR_BANKS.md (רוני אבן)** עובד מקצה לקצה
- [ ] כל 14 unit tests עוברים
- [ ] בדיקה ידנית של flow מלא: יצירת בנק → רישום שעות → התרעה → טיוטת חידוש → אישור → טיפול ב-overage
- [ ] עדכון DECISIONS.md אם היו החלטות חדשות
- [ ] תיוג: `v0.3.0-phase-3-complete`

---

## Risks ל-Phase זה

⚠ **Race conditions** ב-allocation — שני time_entries בו-זמנית. להשתמש ב-`SELECT FOR UPDATE`.
⚠ **Decimal precision** — אסור לאבד דיוק. בדיקות מקיפות.
⚠ **Migration לקוחות קיימים** — אם יש לקוחות עם בנקי שעות ב-Airtable, לבנות migration script זהיר.
⚠ **Timer + Mobile** — שמירת state במובייל (browser background).

---

## מה הלאה?

Phase 4 — Financials + Documents + Interactive Web Proposals.
