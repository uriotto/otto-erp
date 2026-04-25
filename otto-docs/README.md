# OTTO

> מערכת ניהול עסקית מקצה-לקצה עבור OTTO — מותג השירותים של אורי פולק בתחום הייעוץ הדיגיטלי והאוטומציה העסקית.

## מה זה?

פלטפורמה אחודה בעברית שמחליפה את הקונסטלציה הנוכחית של כלים נפרדים (Airtable, Toggl, Google Drive, Make, Google Docs להצעות מחיר) במערכת אחת שמשרתת:

- **אורי (Admin)** — ניהול מלא של העסק
- **צוות פנימי (תכנון לעתיד)** — עד 5 משתמשים
- **לקוחות** — פורטל ייעודי לצפייה בפרויקטים, חשבוניות, הצעות מחיר אינטראקטיביות

## פיצ'רים מרכזיים

- 📊 **CRM מלא** — לידים, לקוחות, אנשי קשר עם pipeline אוטומטי מ-WhatsApp
- 📁 **ניהול פרויקטים** — היררכיה (פרויקט → תת-פרויקטים), תבניות, Gantt + Kanban
- ⏱️ **ניהול זמן ובנקי שעות** — טיימר persistent, hour banks עם לוגיקת overage מתוחכמת
- 💰 **פיננסים** — חשבוניות אוטומטיות דרך Finbot, מעקב יתרות, צפי תזרים
- 📝 **Interactive Web Proposals** — הצעות מחיר אינטראקטיביות במקום Google Docs
- 🎙️ **תמלולים אוטומטיים** — Zoom + Web Recorder → ivrit-ai → סיכומי Claude
- 🤖 **AI מובנה + External Agents** — Claude API + pgvector RAG + integrations
- 👤 **Client Portal** — ב-clients.otto-ai.co.il
- 📱 **PWA** — אפליקציה מותקנת ב-Mobile + Desktop

## טכנולוגיה

```
Frontend:  Next.js 16 + React 19 + TypeScript + TailwindCSS + shadcn/ui
Database:  Supabase (PostgreSQL + RLS + pgvector)
Auth:      Supabase Auth (Email + Magic Link + Google OAuth)
Storage:   Supabase Storage (מסמכים) + Google Drive (הקלטות)
Hosting:   Vercel
Mobile:    PWA (Progressive Web App)
AI:        Claude API + Gemini (fallback) + OpenAI Embeddings
Auto:      Make.com (Finbot, WhatsApp, Zoom, RunPod)
DevOps:    GitHub Actions + Sentry + UptimeRobot + Claude Code Bot
```

## מבנה המסמכים

זו חבילת המסמכים המלאה לבנייה עם Claude Code. **קרא אותם בסדר הזה:**

| #   | קובץ                                   | מה זה                                                          |
| --- | -------------------------------------- | -------------------------------------------------------------- |
| 1   | [README.md](./README.md)               | המסמך הזה                                                      |
| 2   | [CLAUDE.md](./CLAUDE.md)               | **הוראות עבודה ל-Claude Code** — חוקים, סגנון קוד, RTL, "אסור" |
| 3   | [PRD.md](./PRD.md)                     | **המסמך המרכזי** — דרישות מוצריות מלאות (13 פרקים)             |
| 4   | [DESIGN.md](./DESIGN.md)               | מערכת עיצוב — צבעים, פונטים, רכיבים, RTL                       |
| 5   | [DATA_MODEL.md](./DATA_MODEL.md)       | מפרט ה-schema — 20 ישויות, RLS policies, indexes               |
| 6   | [DECISIONS.md](./DECISIONS.md)         | ADRs — כל ההחלטות הארכיטקטוניות והסיבות                        |
| 7   | [HOUR_BANKS.md](./HOUR_BANKS.md)       | לוגיקת בנקי שעות בפירוט (overage, alerts, חידוש)               |
| 8   | [tasks/phase-1.md](./tasks/phase-1.md) | משימות Phase 1 — תשתית                                         |
| 9   | [tasks/phase-2.md](./tasks/phase-2.md) | משימות Phase 2 — Core CRM                                      |
| ... | tasks/phase-N.md                       | פירוט עבודה phase-by-phase                                     |
|     | [.env.example](./.env.example)         | רשימת כל ה-env vars                                            |

## Quick Start

### תנאים מקדימים

לפני שמפעילים את Claude Code, אורי צריך להכין ידנית:

1. **Supabase Project** — supabase.com → New project → Free tier
2. **GitHub Private Repo** — חדש, ריק
3. **Vercel Project** — vercel.com → Import GitHub repo
4. **Domains** — app.otto-ai.co.il + clients.otto-ai.co.il (DNS ל-Vercel)
5. **Sentry Account** — sentry.io → Free tier → DSN
6. **UptimeRobot Account** — uptimerobot.com → 50 monitors free
7. **Claude API Key** — console.anthropic.com
8. **Google OAuth** — console.cloud.google.com → OAuth credentials
9. **Green API** — green-api.com → instance ID + API token
10. **Finbot** — token + integration ב-Make.com

### הפעלה ראשונה של Claude Code

```bash
# בתיקיית הפרויקט הריקה
claude code "אני מתחיל פרויקט חדש. קרא את כל המסמכים בתיקייה הזו לפי הסדר ב-README, ואז ספר לי מה הבנת. אל תכתוב קוד עדיין — רק תאשר הבנה ושאל שאלות אם משהו לא ברור."
```

### עבודה Phase-by-Phase

לאחר שאישרת ש-Claude Code הבין נכון:

```bash
# Phase 1
claude code "בוא נתחיל את Phase 1 לפי tasks/phase-1.md. אנא צור branch חדש 'phase-1-infrastructure' ועבור על המשימות בסדר. עצור אחרי כל משימה משמעותית לאישור."
```

## עקרונות פיתוח

1. **Phase-by-phase** — לא לפתוח את כל המערכת בבת אחת. לסיים phase, לאמת, להתקדם.
2. **TypeScript Strict** — בכל מקום, תמיד.
3. **Server Components first** — Client Components רק כשחייבים.
4. **RLS מההתחלה** — כל טבלה מוגנת.
5. **RTL מההתחלה** — לא להוסיף בסוף.
6. **Migrations incrementally** — כל שינוי schema הוא migration נפרד.
7. **בדיקות לוגיקה קריטית** — Hour Banks, חיוב, overage חייבים unit tests.

## Pilot Phase

6 חודשים ראשונים — אורי לבד, אין לקוחות בפורטל. מטרות:

- ביסוס המערכת
- Iteration על UX
- איתור באגים לפני production
- בניית data היסטורי

## תקציב יעד

עד $100/חודש בשלב Pilot (Vercel Hobby + Supabase Free + Sentry Free + UptimeRobot Free).
שדרוג ל-Pro tiers (~$45 נוסף) רק עם הזמנת לקוח ראשון לפורטל.

## מותג

- **שם**: OTTO
- **טאגליין**: "אוטומציות לעצלנים"
- **טון**: חם, אנושי, מקצועי, לא קורפורטי
- **שפה**: עברית בלבד, RTL מלא
- **קהל יעד**: עסקים קטנים-בינוניים בישראל

## רישיון

פרטי. כל הזכויות שמורות לאורי פולק / OTTO.
