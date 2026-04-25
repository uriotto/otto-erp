# OTTO ERP/CRM

מערכת ERP/CRM פנימית של OTTO — automate your success.

## מבנה

```
otto-erp-crm/
├── otto-app/    # אפליקציית Next.js 16 (App Router, TS Strict, Tailwind v4)
└── otto-docs/   # תיעוד הפרויקט: PRD, DESIGN, DATA_MODEL, DECISIONS, tasks/
```

## הרצה מקומית

```bash
cd otto-app
npm install
npm run dev
# http://localhost:3000
```

## סטטוס

**Phase 1.1** — Repo + Next.js Init ✅
- Next.js 16 (App Router, TypeScript Strict)
- Tailwind v4 + Design System (cream/navy palette)
- RTL מההתחלה (`lang="he"`, `dir="rtl"`)
- Fonts: Assistant (UI) + Caveat (decorative, Latin only)
- Prettier + Husky + lint-staged

ראה [otto-docs/tasks/](otto-docs/tasks/) לתוכניות Phase הבאות.

## חוקי עבודה

המסמך הסמכותי: [otto-docs/CLAUDE.md](otto-docs/CLAUDE.md).
תקציר: עברית בתקשורת, אנגלית ב-code, RTL מההתחלה, RLS על כל טבלה.
