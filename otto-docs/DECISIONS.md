# DECISIONS.md — Architecture Decision Records

> תיעוד ההחלטות הארכיטקטוניות העיקריות של OTTO. כל החלטה מתועדת עם הקשר, האפשרויות, ההחלטה, וההשלכות. זה living document — מוסיפים החלטות חדשות לאורך הדרך.

## פורמט ADR

כל החלטה כוללת:

- **סטטוס**: Proposed / Accepted / Deprecated / Superseded
- **תאריך**: מתי הוחלטה
- **הקשר**: למה צריך להחליט
- **אפשרויות**: מה שקלנו
- **החלטה**: מה בחרנו
- **השלכות**: מה זה גורר

---

## ADR-001: Next.js 16 + Supabase כ-stack ראשי

**סטטוס**: Accepted
**תאריך**: 25/04/2026

**הקשר**: צריך לבחור stack למערכת ניהול עסקית בעברית, RTL, מורכבת, עם דרישת multi-tenant readiness.

**אפשרויות**:

- Next.js + Supabase
- Next.js + own backend (NestJS / Express + PostgreSQL)
- Remix + Supabase
- SvelteKit + PocketBase
- T3 stack (Next + Prisma + tRPC)

**החלטה**: **Next.js 16 + Supabase**

**הסיבות**:

- אורי מכיר את ה-stack מפרויקטים קודמים (Esther Avital CRM)
- Supabase = DB + Auth + Storage + Realtime + Edge Functions במקום אחד
- RLS פותר multi-tenancy בלי קוד
- pgvector מובנה ל-RAG
- Vercel deployment פשוט עם Next.js
- TypeScript + Server Actions = פיתוח מהיר עם Claude Code

**השלכות**:

- ✅ פיתוח מהיר
- ✅ פחות שרתים לתחזק
- ⚠ תלות ב-Supabase (vendor lock-in מסוים)
- ⚠ Cold starts ב-Supabase Free tier (פתרון: שדרוג ל-Pro בעתיד)

---

## ADR-002: Cloudflare R2 לא נבחר להקלטות

**סטטוס**: Accepted
**תאריך**: 25/04/2026

**הקשר**: הקלטות אודיו יכולות להיות גדולות (100MB+ פגישה ארוכה). אחסון ב-Supabase Storage חורג מ-Free tier מהר.

**אפשרויות**:

- Supabase Storage (יקר בכמויות)
- Google Drive (חינם דרך Workspace קיים)
- Cloudflare R2 (זול, ללא egress fees)
- AWS S3

**החלטה**: **Google Drive** לעת עתה. R2 כאופציה בעתיד.

**הסיבות**:

- אורי כבר משלם על Google Workspace
- אורי מנהל את העסק בחלקו דרך Drive ממילא
- אינטגרציה פשוטה דרך Google Drive API
- תיקיית פרויקט אוטומטית מקושרת לקבצים נוספים

**השלכות**:

- ✅ עלות 0 נוספת
- ✅ אורי יכול לגשת לקבצים גם בלי המערכת
- ⚠ Egress יקר אם נמשוך קבצים מהרבה
- ⚠ Vendor lock-in קל ל-Google
- 🔄 לבדוק R2 שוב כש-storage חורג מ-100GB

---

## ADR-003: PWA במקום Native Mobile

**סטטוס**: Accepted
**תאריך**: 25/04/2026

**הקשר**: אורי צריך גישה מובייל לטיימר, ללוח זמנים, ולתגובה ללידים מ-WhatsApp. שתי דרכים: app נייטיב או PWA.

**אפשרויות**:

- React Native (one codebase, two stores)
- Native iOS + Native Android
- PWA (Progressive Web App)
- Hybrid (Capacitor / Cordova)

**החלטה**: **PWA**

**הסיבות**:

- כל הפיתוח ב-Next.js — ללא kodebases נוסף
- אין צורך ב-App Store approvals
- Push notifications עובד ב-iOS 16.4+ ו-Android
- Install ל-home screen זמין
- Offline support עם Service Worker
- 90% מהפיצ'רים של native — בעלות 10%

**השלכות**:

- ✅ פיתוח מהיר
- ✅ עדכונים מיידיים (אין השעיית app store)
- ⚠ אין חלק מ-features של native (Bluetooth מתקדם, NFC, וכו') — לא רלוונטי לנו
- ⚠ iOS PWA פחות חזק מ-Android (אבל מספיק טוב)
- 🔄 שקילה מחדש אם נצטרך native features קריטיות

---

## ADR-004: Multi-tenancy מההתחלה (גם עבור tenant יחיד)

**סטטוס**: Accepted
**תאריך**: 25/04/2026

**הקשר**: היום OTTO היא מערכת לאורי בלבד. בעתיד, אולי SaaS לעסקים אחרים. שאלה: לבנות ל-tenant יחיד עכשיו ולהמיר בעתיד, או לבנות multi-tenant מההתחלה?

**אפשרויות**:

- Single-tenant עכשיו, refactor בעתיד
- Multi-tenant מלא עם UI עכשיו (פיצול domains, billing, וכו')
- Multi-tenant ב-DB בלבד, single-tenant ב-UI (גישה היברידית)

**החלטה**: **Multi-tenant ב-DB + RLS, single-tenant ב-UI**

**מה זה אומר**:

- כל טבלה עם `tenant_id`
- כל RLS policy מבוססת `tenant_id = auth.jwt() ->> 'tenant_id'`
- Middleware שמזהה tenant על פי subdomain (היום: app.otto-ai.co.il = tenant יחיד)
- אין UI ל-tenant management עכשיו
- אין billing פר-tenant
- אין onboarding flow לעסקים חדשים

**הסיבות**:

- Refactoring multi-tenancy אחרי שיש data = סיוט. עדיף לבנות נכון מההתחלה.
- ה-overhead בפיתוח קטן (tenant_id בכל insert, RLS בכל policy).
- מאפשר להפוך ל-SaaS בלי שכתוב מסיבי בעתיד.

**השלכות**:

- ✅ עתיד פתוח ל-SaaS
- ✅ אבטחה טובה יותר מההתחלה
- ⚠ Overhead קטן בפיתוח (15% יותר עבודה)
- ⚠ JWT צריך להכיל tenant_id

---

## ADR-005: Hour Banks כמודל מרכזי (לא כ-add-on)

**סטטוס**: Accepted
**תאריך**: 25/04/2026

**הקשר**: לאורי יש לקוחות במספר מודלים תמחוריים. Hour Banks (כרטיסיות) הוא מודל מורכב עם לוגיקה עסקית עמוקה.

**אפשרויות**:

- Hour Banks כ-add-on פשוט (counter בלבד)
- Hour Banks כמודל מרכזי עם overage, alerts, חידוש אוטומטי
- שילוב עם external system כמו Toggl

**החלטה**: **Hour Banks כמודול מרכזי וקריטי** עם:

- Overage handling אוטומטי
- 2 התרעות (אחוז + שעות)
- חידוש עם בליעת overage
- חיוב מקדמה אוטומטי דרך Finbot
- Audit trail מלא

**הסיבות**:

- זה אחד ההבדלים העיקריים מ-Toggl/Harvest
- לאורי כבר יש לקוחות במודל זה (Roni Even)
- מאפשר billing locks-in (לקוח שילם → ימשיך)
- חוסך עבודה אדמיניסטרטיבית רבה

**השלכות**:

- ✅ value proposition חזק
- ✅ אורי חוסך זמן מנהלי
- ⚠ מורכבות גבוהה — דורש unit tests מקיפים
- ⚠ באג כאן = חיוב שגוי = פגיעה ביחסי לקוחות
- → ראה HOUR_BANKS.md לפירוט מלא

---

## ADR-006: Interactive Web Proposals במקום Google Docs

**סטטוס**: Accepted
**תאריך**: 25/04/2026

**הקשר**: היום אורי שולח הצעות מחיר כ-Google Docs. הם סטטיים, לא ניתן לעקוב אחרי פתיחה, ההמרה אטית.

**אפשרויות**:

- להמשיך עם Google Docs
- שילוב עם Better Proposals / Qwilr (תשלום)
- לבנות מערכת פנימית של Interactive Web Proposals

**החלטה**: **לבנות מערכת פנימית**

**הסיבות**:

- Pricing differentiator — הצעת מחיר היא חוויה, לא PDF
- Product showcase — לקוחות פוטנציאליים רואים את המערכת
- Integration עם Quote Generator Agent הקיים
- Tracking מלא (פתיחה, זמן, מודולים שנצפו)
- חתימה דיגיטלית במקום שליחת חוזה נפרד
- בחתימה: יצירה אוטומטית של פרויקט + תיקייה + חשבונית מקדמה

**השלכות**:

- ✅ חוויית לקוח מובחנת
- ✅ נתונים ל-improvement (אילו מודולים נמכרים יותר)
- ✅ אוטומציה מלאה מהצעה לפרויקט
- ⚠ Phase 4 בלבד — לא בתחילת הפיתוח
- ⚠ נדרש PDF export ללקוחות שדורשים מסמך רשמי

---

## ADR-007: Make.com כשכבת אוטומציה חיצונית

**סטטוס**: Accepted
**תאריך**: 25/04/2026

**הקשר**: צריך לחבר אינטגרציות חיצוניות (Finbot, WhatsApp, Zoom, RunPod). שאלה: לבנות בקוד או להשתמש ב-Make?

**אפשרויות**:

- הכל בקוד (Server Actions + Edge Functions)
- Make.com כשכבת orchestration
- n8n self-hosted
- Zapier

**החלטה**: **Make.com לזרימות חיצוניות מורכבות, קוד ל-business logic**

**מה ב-Make**:

- Finbot: יצירת חשבוניות
- WhatsApp Green API: שליחת הודעות
- Zoom Recording: הורדה → RunPod → Claude
- Sync ל-ActiveCampaign / רב מסר (כשנפעיל)

**מה בקוד**:

- Hour Banks logic
- RLS / auth
- UI logic
- חישובים פיננסיים פנימיים
- AI calls פשוטים (Claude API ישיר)

**הסיבות**:

- אורי מומחה ב-Make — מהירות פיתוח
- Make = visibility מצוינת לזרימות חיצוניות
- אם אינטגרציה משתנה → רק עדכון ב-Make, לא deploy
- קוד = control מלא על business logic קריטי

**השלכות**:

- ✅ פיתוח מהיר לאינטגרציות
- ✅ אורי יכול לתקן זרימות בלי developer
- ⚠ עלות חודשית של Make (~$30 ב-Pro tier כשנגדל)
- ⚠ תלות בעוד שירות צד-שלישי

---

## ADR-008: External Agents Hub (Lite) במקום Internal Agents

**סטטוס**: Accepted
**תאריך**: 25/04/2026

**הקשר**: לאורי כבר יש agents שבנה ב-Claude Code (Quote Generator מתמלולים). השאלה: לשלב אותם או לבנות חדשים פנימיים.

**אפשרויות**:

- לבנות Internal Agent Hub מלא (orchestration, tools, memory)
- Lite — אינטגרציה ל-External Agents (HTTP/Make webhooks)
- לא לתמוך כלל

**החלטה**: **Lite — אינטגרציה ל-External Agents**

**איך זה עובד**:

- טבלת `external_agents` עם name, webhook_url, trigger_context, input_template
- ה-agents עצמם רצים בנפרד (Claude Code, Make scenarios)
- המערכת מציגה כפתורים contextual ("הפק הצעת מחיר") שמפעילים את ה-agent
- התוצאה חוזרת → אורי מאשר → נשמרת במערכת

**הסיבות**:

- ה-agents הקיימים של אורי כבר עובדים — אין צורך לבנות מחדש
- מאפשר להוסיף agents חדשים בלי לשנות קוד מערכת
- מדגים את העיקרון של "automate yourself out of work"

**השלכות**:

- ✅ שילוב מהיר של ה-stack הקיים
- ✅ גמישות עתידית
- ⚠ ה-agents הם black boxes — אין ל-OTTO ידע מה הם עושים בפנים
- 🔄 בעתיד אולי לעבור ל-Internal Hub מלא

---

## ADR-009: Maintenance Bot מבוסס Claude Code

**סטטוס**: Accepted
**תאריך**: 25/04/2026

**הקשר**: אורי לא DevOps. המערכת תרוץ במשך שנים ותדרוש תחזוקה: עדכוני dependencies, fixing bugs, performance optimization.

**אפשרויות**:

- לשכור DevOps freelancer
- לסמוך על אורי לעשות הכל ידנית
- Bot אוטומטי ל-routine maintenance + אורי לדברים מורכבים

**החלטה**: **Maintenance Bot מבוסס Claude Code + GitHub Actions**

**מה הוא עושה**:

- Cron שבועי (יום ראשון בבוקר)
- בדיקת `npm outdated` → פתיחת PRs לעדכונים
- הרצת tests על PRs
- בדיקת Sentry logs → תיקון באגים פשוטים → PR
- בדיקת Supabase performance → הצעת indexes
- מייל סיכום שבועי לאורי

**מה לא עושה**:

- שינויי schema (דורש אישור אנושי)
- deploy ל-production (אורי תמיד merge)
- Refactoring משמעותי

**הסיבות**:

- 80% מהתחזוקה היא routine
- חסכון של ~2 שעות שבועיות לאורי
- Claude Code עובד טוב על משימות מוגדרות היטב
- עלות נמוכה (GitHub Actions free tier + Claude API)

**השלכות**:

- ✅ אורי משוחרר מ-routine
- ✅ Dependencies תמיד מעודכנות
- ⚠ דורש סקירה של PRs (5-10 דקות בשבוע)
- ⚠ אם ה-Bot מציע משהו לא נכון — אורי צריך לזהות

---

## ADR-010: Reports עם אישור ידני חובה

**סטטוס**: Accepted
**תאריך**: 25/04/2026

**הקשר**: המערכת יוצרת דוחות אוטומטיים (חודשיים, שנתיים). שאלה: לשלוח אוטומטית ללקוח, או לדרוש אישור ידני?

**אפשרויות**:

- שליחה אוטומטית מלאה
- חצי-אוטומטי: אורי מקבל preview ויכול לחסום
- אישור ידני חובה לכל דוח

**החלטה**: **אישור ידני חובה לכל דוח**

**הסיבות**:

- דוחות יכולים להכיל שגיאות (data, חישוב)
- לעיתים נדרש context אנושי שאי אפשר לאוטומט
- לקוחות יקרים = עדיף לבזבז דקה על שגרת אישור
- מונע מצבים נבוכים (דוח עם שעות שגויות)

**השלכות**:

- ✅ איכות דוחות גבוהה
- ✅ אורי שולט ב-narrative ללקוחות
- ⚠ דורש זמן שבועי-חודשי לסקירה
- ⚠ אם אורי לא מאשר — דוחות מצטברים

---

## ADR-011: עברית בלבד, ללא i18n layer

**סטטוס**: Accepted
**תאריך**: 25/04/2026

**הקשר**: כל הלקוחות והמשתמשים בישראל. צריך לבנות i18n מההתחלה למקרה של אנגלית בעתיד?

**אפשרויות**:

- i18n מלא (next-intl, react-i18next)
- Hardcoded עברית
- Hybrid (constants file בעברית, מבנה שמאפשר i18n בעתיד)

**החלטה**: **Hardcoded עברית** עם strings ב-constants files

**הסיבות**:

- הוספת i18n אחר כך = refactor מסיבי, אבל אפשרי
- 0 לקוחות באנגלית כרגע ובחודשים הקרובים
- חיסכון של 20% ב-overhead פיתוח
- RTL מטופל ברמת ה-CSS, לא ברמת תוכן

**השלכות**:

- ✅ פיתוח מהיר יותר
- ✅ קוד פשוט יותר
- ⚠ אם בעתיד יידרש אנגלית — refactor 1-2 שבועות
- ⚠ הקוד מלא בעברית (אבל זה OK עבור צוות עברי)

---

## ADR-012: GitHub Private Repo (לא Self-Hosted)

**סטטוס**: Accepted
**תאריך**: 25/04/2026

**הקשר**: איפה לאחסן את הקוד.

**החלטה**: **GitHub Private Repo**

**הסיבות**:

- חינם ל-private repos
- Vercel integration native
- Claude Code עובד מצוין עם GitHub
- GitHub Actions free tier מספיק
- Backup אוטומטי

**השלכות**:

- ✅ אפס חיכוך
- ⚠ הקוד אצל Microsoft/GitHub
- ⚠ אם נצטרך self-hosted בעתיד (compliance) — migration

---

## איך להוסיף החלטה חדשה

כשאתה (Claude Code) מקבל החלטה ארכיטקטונית משמעותית במהלך הפיתוח:

1. הוסף ADR חדש עם המספר הבא (ADR-013 וכו')
2. השתמש בפורמט הקיים
3. תזכיר את ההחלטה גם ב-commit message
4. עדכן קבצים אחרים אם נדרש (CLAUDE.md, PRD.md)

**דוגמאות להחלטות שדורשות ADR**:

- בחירת ספרייה משמעותית (charting, maps, וכו')
- שינוי גישה למבנה תיקיות
- בחירת state management approach
- ויתור על דרישה מה-PRD (עם הסבר למה)

**דוגמאות להחלטות שלא דורשות ADR**:

- בחירת variable name
- שימוש ב-utility פשוט (lodash, date-fns)
- formatting / linting choices
