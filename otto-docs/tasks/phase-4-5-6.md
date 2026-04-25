# Phase 4 — Financials + Documents + Interactive Proposals

> **משך מתוכנן**: 3 שבועות
> **מטרה**: חשבוניות דרך Finbot, ניהול מסמכים, ומערכת Interactive Web Proposals מלאה.

## משימות

### 4.1 Financials Module — Invoices

**Branch**: `phase-4.1-invoices`

- [ ] Migrations: `invoices`, `payments`, `expenses`
- [ ] חיבור Make.com scenario ל-Finbot:
  - יצירת חשבונית: webhook → Make → Finbot API
  - callback ל-`/api/webhooks/finbot/invoice-created` עם finbot_invoice_id + URL
  - תזכורת חשבוניות: cron → טיוטת תזכורת (אישור ידני)
- [ ] עמוד `/invoices` — רשימה + פילטור
- [ ] עמוד `/invoices/[id]` — פרטים + payments
- [ ] Server Action `createInvoice(customerId, items, type)` — דרך Make
- [ ] Server Action `recordPayment(invoiceId, amount, method)`
- [ ] **Adapter pattern** לתשלומים: interface `PaymentProvider` עם implementation Finbot, מקום מוכן ל-Bit/Pelecard
- [ ] חיבור הפיצ'ר לבנק שעות: יצירת בנק → חשבונית מקדמה אוטומטית
- [ ] חיבור לדוח שעות חודשי: סוף חודש → טיוטת חשבונית

**Acceptance**: יצירת חשבונית מהמערכת מופיעה ב-Finbot, callback מעדכן status.

---

### 4.2 Financial Reports + Dashboard

**Branch**: `phase-4.2-financial-reports`

- [ ] Aging Report — חשבוניות 30/60/90 בפיגור
- [ ] דוח הכנסות — לפי חודש/לקוח/פרויקט
- [ ] צפי תזרים — חשבוניות פתוחות + בנקים פעילים
- [ ] חישוב P&L חודשי בסיסי
- [ ] יצוא Excel + PDF לרואה חשבון
- [ ] KPIs cards לדשבורד הראשי: הכנסה החודש, חשבוניות פתוחות, billable rate

**Acceptance**: הדשבורד מראה נתונים אמיתיים.

---

### 4.3 Documents Module

**Branch**: `phase-4.3-documents`

- [ ] Migration: `documents` עם pgvector embedding
- [ ] חיבור Google Drive API:
  - OAuth flow
  - יצירת תיקייה אוטומטית לפרויקט חדש
  - upload/download
- [ ] עמוד `/documents` — רשימה + filter לפי project/customer/type
- [ ] חיפוש בתוכן (full-text + semantic via pgvector)
- [ ] Upload — Storage או Drive (לפי בחירה)
- [ ] חתימה דיגיטלית ל-מסמכים (Canvas signature)
- [ ] Generation של embeddings: בכל upload → extract text → OpenAI embeddings → save

**Acceptance**: העלאת חוזה, חיפוש סמנטי בו, חתימה דיגיטלית.

---

### 4.4 Interactive Web Proposals

**Branch**: `phase-4.4-proposals`

⚠ זהו ה-pricing differentiator העיקרי — איכות גבוהה חיונית.

- [ ] Migration: `proposals`, `proposal_views`
- [ ] עמוד `/proposals` — רשימת הצעות (admin)
- [ ] עמוד `/proposals/new` — builder:
  - בחירת template (3-4 עיצובים)
  - הוספת מודולים (כל אחד עם name, description, price, optional flag)
  - timeline editor (milestones)
  - FAQ + testimonials
  - validation
- [ ] עמוד פומבי `clients.otto-ai.co.il/proposal/[publicId]`:
  - עיצוב לפי template
  - מודולים אינטראקטיביים: checkbox לכל מודול → סכום מתעדכן
  - timeline ויזואלי
  - FAQ accordion
  - testimonials
  - **חתימה Canvas** + הזנת שם + email
  - Tracking: viewer_ip, modules_viewed, time_spent
- [ ] בחתימה (Server Action `signProposal`):
  - שמירת signature_data
  - יצירת customer (אם היה lead)
  - יצירת project אוטומטי
  - יצירת תיקיית Drive
  - יצירת חשבונית מקדמה (אם type='advance')
  - notification לאורי
- [ ] PDF Export — server-side rendering של אותו תוכן ל-PDF
- [ ] Versioning — שכפול הצעה לגרסה חדשה
- [ ] חיבור ל-External Agent "Quote Generator" — כפתור "הפק הצעה מתמלול" (Phase 6 יחבר agents)

**Acceptance**: לקוח פותח link → בוחר מודולים → חותם → פרויקט נוצר אוטומטית.

---

### 4.5 בדיקה לסיום Phase 4

- [ ] flow מלא: יצירת הצעה → שליחה ללקוח → פתיחה → חתימה → פרויקט אוטומטי
- [ ] flow מלא: רישום שעות → סוף חודש → טיוטת חשבונית → אישור → שליחה דרך Finbot
- [ ] תיוג: `v0.4.0-phase-4-complete`

---

# Phase 5 — Calendar + Client Portal + Recordings

> **משך מתוכנן**: 3 שבועות
> **מטרה**: לוח זמנים מסונכרן עם Google, פורטל לקוחות מלא, ופייפליין הקלטות אוטומטי.

## משימות

### 5.1 Calendar Integration

**Branch**: `phase-5.1-calendar`

- [ ] Migration: `events`
- [ ] חיבור Google Calendar API (sync דו-כיווני)
- [ ] עמוד `/calendar` — תצוגות יום/שבוע/חודש
- [ ] יצירת אירוע מהמערכת: יוצר ב-Google Calendar
- [ ] קליטת אירועים מ-Google Calendar: webhook
- [ ] חיבור אירוע ללקוח/פרויקט
- [ ] Booking Links ציבוריים (כמו Calendly):
  - עמוד פומבי `/book/[type]`
  - בחירת תאריך/שעה
  - יצירת אירוע + שליחת אישור
- [ ] תזכורת אוטומטית 24 שעות לפני (WhatsApp + Email)
- [ ] יצירת Zoom meeting אוטומטית (Zoom API)

**Acceptance**: ליד יכול לקבוע פגישה דרך booking link, מקבל אישור.

---

### 5.2 Client Portal — Foundation

**Branch**: `phase-5.2-portal-foundation`

- [ ] Subdomain routing: `clients.otto-ai.co.il`
- [ ] Auth flow ייחודי לפורטל (magic link בלבד, ללא Google)
- [ ] Layout נפרד — סרגל ניווט מצומצם
- [ ] עמוד `/portal/dashboard` — סטטוס פרויקטים, חשבוניות, פגישות
- [ ] RLS strict — לקוח רואה רק את עצמו
- [ ] בדיקות אבטחה: ניסיון גישה לdata של לקוח אחר → 403

**Acceptance**: לקוח מתחבר, רואה רק שלו, RLS חוסם בעיות.

---

### 5.3 Client Portal — Modules

**Branch**: `phase-5.3-portal-modules`

- [ ] עמוד `/portal/projects` — רשימת פרויקטים
- [ ] עמוד `/portal/projects/[id]` — סטטוס, milestones, צעדים הבאים
- [ ] עמוד `/portal/tasks` — משימות (גרסה מנוקה ללא overhead פנימי)
- [ ] עמוד `/portal/documents` — מסמכים visible_to_client בלבד
- [ ] עמוד `/portal/invoices` — חשבוניות + הורדה
- [ ] עמוד `/portal/meetings` — פגישות + סיכומי AI שאושרו
- [ ] עמוד `/portal/hour-banks` — visualization בנקי שעות
- [ ] עמוד `/portal/timesheet` — דוח שעות שקוף
- [ ] עמוד `/portal/messages` — תקשורת
- [ ] עמוד `/portal/change-requests` — שליחת בקשות שינוי
- [ ] עמוד `/portal/uploads` — העלאת קבצים
- [ ] בדיקת mobile UX — הפורטל אמור לעבוד מצוין במובייל

**Acceptance**: כל המודולים עובדים, לקוח רואה רק מה שאמור.

---

### 5.4 Recording Pipeline — Zoom

**Branch**: `phase-5.4-recordings-zoom`

- [ ] Migration: `recordings`, `transcripts`, `meeting_summaries`
- [ ] Zoom App credentials + Webhook subscription ל-`recording.completed`
- [ ] `/api/webhooks/zoom/recording-completed`:
  - וולידציה
  - שליחה ל-Make scenario
- [ ] Make scenario: Zoom recording → download → upload Google Drive → trigger RunPod
- [ ] RunPod ivrit-ai endpoint: receives audio URL → returns transcript with diarization
- [ ] callback ל-`/api/webhooks/transcription-completed`:
  - שמירת transcript
  - יצירת embedding
  - קריאה ל-Claude API ליצירת summary
  - שמירת meeting_summary עם status='pending_review'
  - notification לאורי
- [ ] עמוד `/recordings/[id]` — נגן + transcript + summary

**Acceptance**: סיום פגישת Zoom → תוך 10 דקות יש transcript + summary במערכת.

---

### 5.5 Recording Pipeline — Web Recorder

**Branch**: `phase-5.5-recordings-web`

- [ ] עמוד `/record` — דף הקלטה:
  - בחירת לקוח/פרויקט
  - כפתור Start/Stop (MediaRecorder API)
  - תצוגת זמן רץ
  - עובד ב-mobile + desktop
  - תמיכה בהקלטת שיחת טלפון בדיבורית
- [ ] בעצירה: upload ל-Google Drive (multipart)
- [ ] שליחה לאותו pipeline של Zoom (transcript + summary)
- [ ] PWA shortcut: "Record meeting" ב-home screen

**Acceptance**: הקלטה מהמובייל עוברת אוטומטית ל-pipeline.

---

### 5.6 בדיקה לסיום Phase 5

- [ ] flow מלא: פגישת Zoom → recording → transcript → summary → אישור → לקוח רואה בפורטל
- [ ] flow מלא: ליד מקבל booking link → קובע פגישה → מקבל תזכורת → מתקיים
- [ ] בדיקת אבטחה מלאה של פורטל
- [ ] תיוג: `v0.5.0-phase-5-complete`

---

# Phase 6 — Marketing + AI Agents + Reports + Polish

> **משך מתוכנן**: 2 שבועות
> **מטרה**: סגירת המודולים האחרונים — שיווק, agents, מערכת דוחות, וליטוש כללי.

## משימות

### 6.1 Marketing Module

**Branch**: `phase-6.1-marketing`

- [ ] Migration: `marketing_content`
- [ ] עמוד `/marketing` — Content Calendar
- [ ] Idea Bank עם תיוג
- [ ] AI generator: כפתור "הפק רעיון" → Claude API → מציג טיוטה
- [ ] UTM Generator — form פשוט
- [ ] Lead Attribution — דוח לפי utm_source

**Acceptance**: לוח תוכן עובד, יצירת רעיון עם AI.

---

### 6.2 External Agents Hub

**Branch**: `phase-6.2-agents`

- [ ] Migration: `external_agents`, `agent_invocations`
- [ ] עמוד `/agents` — רישום agents
- [ ] form: name, webhook_url, trigger_context, input_template, icon, output_handler
- [ ] רכיב `<AgentButton context={...}>` — מציג כפתורים relevant לפי context
- [ ] במקומות הנכונים:
  - `/recordings/[id]` — show agents עם trigger_context שכולל 'transcript'
  - `/customers/[id]` — show agents עם 'customer'
  - `/projects/[id]` — show agents עם 'project'
- [ ] Server Action `invokeAgent(agentId, contextId)`:
  - יצירת invocation record
  - שליחה ל-webhook
  - polling / webhook callback להחזרת תוצאה
  - הצגת תוצאה לפי output_handler
- [ ] רישום ה-Quote Generator הקיים של אורי כ-agent ראשון

**Acceptance**: לחיצה על "הפק הצעת מחיר" אחרי תמלול → מפיק הצעה דרך הסוכן הקיים.

---

### 6.3 RAG / Semantic Search

**Branch**: `phase-6.3-rag`

- [ ] uniform embedding pipeline: כל document, transcript, note → embedding
- [ ] עמוד `/search` — חיפוש סמנטי כללי
- [ ] רכיב `<AISearch>` ב-header — Cmd+K → search across all content
- [ ] בכרטיס לקוח: "שאלות נפוצות מתמלולים" — RAG על תמלולים שלו

**Acceptance**: שאלה כמו "מה אמרנו ל-Roni על Webhook?" מחזירה תשובה רלוונטית.

---

### 6.4 Reports System

**Branch**: `phase-6.4-reports`

- [ ] Migration: `reports`
- [ ] Cron חודשי: יצירת monthly report לכל לקוח פעיל (status='pending_review')
- [ ] Cron שנתי: יצירת yearly report
- [ ] עמוד `/reports/pending` — דוחות ממתינים לאישור
- [ ] עמוד `/reports/[id]` — סקירה + עריכה inline + אישור
- [ ] באישור: status='approved' + visible_to_client=TRUE
- [ ] שליחה אוטומטית למייל הלקוח (אם מסומן)
- [ ] בפורטל: `/portal/reports` — רק approved
- [ ] PDF export לכל דוח

**Acceptance**: בסוף חודש יש דוחות לכל לקוח, אורי מאשר ומועברים לפורטל.

---

### 6.5 Final Polish + Testing

**Branch**: `phase-6.5-polish`

- [ ] בדיקת כל ה-flows מקצה לקצה
- [ ] תיקון rough edges של UX
- [ ] Performance audit (Lighthouse)
- [ ] Accessibility audit (axe)
- [ ] בדיקת mobile מקיפה
- [ ] עדכון `README.md` עם screenshots
- [ ] תיוג: `v1.0.0-mvp-complete`

---

## סיום Phase 6

מערכת מלאה. עכשיו מתחיל **Pilot Phase** של 6 חודשים:

- אורי משתמש לבד
- iteration על UX
- תיעוד באגים ושיפורים

אחרי 6 חודשי Pilot — שדרוג ל-Vercel Pro + Supabase Pro והזמנת לקוח ראשון לפורטל.
