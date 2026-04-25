# DESIGN.md — מערכת עיצוב OTTO

> Deep Navy + Cream + Assistant. Warm, restrained, distinctive. RTL מהיסוד.

## עקרונות עיצוב

1. **Cream דומיננטי** — הרקע הוא cream, לא לבן צרוב. נעים לעיניים בעבודה ארוכה.
2. **אקסנט יחיד** — Navy עמוק. אין צבעים נוספים מתחרים על תשומת לב.
3. **טאצ'ים בכתב יד** — Caveat לאלמנטים נבחרים נותן אישיות (לא בכל מקום).
4. **Sans-serif עם אופי** — Assistant, לא Arial/Inter גנרי.
5. **גבולות עדינים** — borders דקים במקום shadows כבדים. נקי ושקט.
6. **RTL מהיסוד** — כל החלטה עיצובית נבדקת בעברית קודם.

## פלטה

### Primary (cream + navy)

```css
--cream: #f2ebdc; /* רקע ראשי */
--cream-deep: #e8dec8; /* hover, separators */
--cream-paper: #faf5ea; /* כרטיסים, sidebar */
--cream-shadow: #ddd0b5; /* גוונים נדירים */

--navy: #1b2a4e; /* טקסט ראשי, accent */
--navy-deep: #0f1b36; /* חיזוק */
--navy-soft: #2c3e6b; /* מצבים secondary */
--navy-pale: #b8c2d6; /* טקסט על navy */
```

### Ink (היררכיית טקסט)

```css
--ink: #1b2a4e; /* ראשי (= navy) */
--ink-soft: #4a5878; /* secondary */
--ink-faded: #8590ab; /* tertiary, captions */
--ink-line: #d4cbb6; /* borders */
```

### Semantic — מינימליסטי

לא לבנות פלטות נוספות לסטטוסים. השתמש ב:

- **success**: navy רגיל (זה החיובי שלנו)
- **warning**: navy + outline (לא צהוב)
- **error**: navy עמוק + outline בולט יותר (לא אדום)
- **info**: ink-soft

חוקים:

- אין צבעים שלא ברשימה הזו ב-UI
- אם נדרש צבע נוסף — שאל את אורי

## טיפוגרפיה

### פונטים

```css
--font-display: "Assistant", sans-serif; /* כותרות + body */
--font-body: "Assistant", sans-serif; /* זהה */
--font-hand: "Caveat", cursive; /* טאצ'ים בלבד */
--font-mono: "JetBrains Mono", monospace; /* קוד, מספרים טכניים */
```

ייבוא ב-`app/layout.tsx`:

```tsx
import { Assistant, Caveat } from "next/font/google";

const assistant = Assistant({
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-assistant",
});

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-caveat",
});
```

### היררכיית גודל

```css
/* Display - לכותרות עמוד */
--text-display-lg: 44px / 800 / -0.02em; /* greeting */
--text-display-md: 32px / 700 / -0.02em; /* page title */
--text-display-sm: 22px / 700 / -0.01em; /* card title */

/* Body */
--text-body-lg: 16px / 500;
--text-body-md: 14px / 400;
--text-body-sm: 13px / 400;
--text-caption: 12px / 500;
--text-micro: 11px / 600 / 0.12em; /* uppercase labels */

/* Numbers - ל-stat values */
--text-stat: 42px / 800 / -0.03em;
--text-stat-lg: 56px / 800 / -0.04em; /* hour bank remaining */

/* Hand-written */
--text-hand: 19-22px / Caveat;
```

### חוקי טיפוגרפיה

- **כותרות**: weight 700-800
- **body**: weight 400-500
- **labels** (uppercase, micro): weight 600, letter-spacing 0.12em
- **letter-spacing שלילי** רק לפונטים גדולים (28px+)
- **line-height**: 1.1 לכותרות, 1.5 לbody
- **מספרים** תמיד `dir="ltr"` כשמעורב בטקסט עברי

## רכיבים

### Button

```tsx
// Primary - navy מלא
<button className="bg-navy text-cream-paper px-5 py-2.5 rounded-lg font-semibold hover:bg-navy-deep">

// Secondary - outline
<button className="bg-cream-paper text-navy border border-ink-line px-5 py-2.5 rounded-lg font-semibold hover:border-navy">

// Ghost - בלי border
<button className="text-navy hover:bg-cream-deep px-5 py-2.5 rounded-lg font-medium">

// Icon button - עגול
<button className="w-10 h-10 bg-cream-paper border border-ink-line rounded-full flex items-center justify-center hover:border-navy">
```

חוקים:

- Border-radius: `rounded-lg` (8px) לכפתורים, `rounded-full` לעגולים ול-pills
- אין shadows על buttons — רק border state
- transition: 150ms

### Card

```tsx
<div className="bg-cream-paper border border-ink-line rounded-2xl p-6 hover:border-ink-soft transition-colors">
  <h3 className="text-display-sm text-navy mb-1">כותרת</h3>
  <p className="text-caption text-ink-faded mb-4">תיאור</p>
  {/* תוכן */}
</div>
```

חוקים:

- Border-radius: `rounded-2xl` (14px) — לא יותר ולא פחות
- Padding: `p-6` (24px) ברירת מחדל
- אין shadows — רק border

### Input

```tsx
<input
  className="w-full bg-cream-paper border border-ink-line rounded-lg px-4 py-2.5 text-body-md focus:outline-none focus:border-navy focus:ring-2 focus:ring-navy/20"
  dir="auto"
/>
```

חוקים:

- `dir="auto"` תמיד — מאפשר input בעברית ובאנגלית
- focus ring: navy ב-20% opacity

### Badge / Chip

```tsx
// Default
<span className="inline-flex items-center px-2.5 py-1 rounded-full text-caption font-semibold bg-cream-deep text-ink-soft border border-ink-line">

// Accent (דורש פעולה)
<span className="inline-flex items-center px-2.5 py-1 rounded-full text-caption font-semibold border border-navy text-navy">

// Numbered badge (sidebar)
<span className="bg-navy text-cream-paper text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[18px] text-center">
```

### Avatar

```tsx
// Square (מועדף - יותר אופי)
<div className="w-10 h-10 bg-navy text-cream-paper rounded-xl flex items-center justify-center font-bold text-lg">
  {initial}
</div>
```

### Progress Bar

```tsx
<div className="h-3 bg-cream-deep border border-ink-line rounded-full overflow-hidden">
  <div className="h-full bg-navy" style={{ width: `${pct}%` }} />
</div>
```

### Hand-written touches

```tsx
// Tagline / decorative text — Latin only, Caveat לא תומך בעברית
<span className="font-caveat text-ink-faded text-xl -rotate-1 inline-block" dir="ltr">
  automate your success
</span>

// Stamp / annotation
<span className="font-caveat text-navy text-base font-bold -rotate-6 inline-block">
  דורש תשומת לב
</span>
```

חוקים לכתב יד:

- **רק** ל-tagline, stamps, annotations
- **לא** לטקסט פונקציונלי (כפתורים, labels, data)
- **רק טקסט לטיני** — Caveat לא תומך בעברית. לטקסט עברי, השתמש ב-Assistant באיטליק/weight 300 או דלג על האפקט
- מותר rotate בין -8° ל-+2°
- צבע: navy או ink-faded

## Layout

### Sidebar

- רוחב: 260px קבוע
- רקע: `cream-paper`
- Border-left: 1px `ink-line`
- Padding: 32px 20px
- ה-active item: `bg-navy text-cream-paper`
- Section labels: 10px uppercase, letter-spacing 0.18em

### Header

- Padding-top: 40px
- כותרת ברוכים הבאים: `text-display-lg`
- Subtitle: Caveat 22px, ink-faded
- Actions בצד שמאל (RTL = "סוף השורה")

### Grid

- Gap: 16px בין כרטיסים
- Mobile: `grid-cols-1`
- Tablet: `grid-cols-6`
- Desktop: `grid-cols-12`

חלוקות נפוצות:

- Stat card: span 3
- Featured card (Hour Bank): span 7
- Side card (Schedule): span 5
- Wide (Pipeline): span 8
- Narrow (Activity): span 4

## Spacing

Tailwind defaults עם דגש על:

- `gap-4` (16px) בין elements ברצף
- `mb-4` בין שורות תוכן
- `mb-6` בין secs בכרטיס
- `p-6` ברירת מחדל לכרטיסים
- `px-5 py-2.5` לכפתורים

## Border Radius

```
rounded     →  4px   (אין שימוש)
rounded-lg  →  8px   (כפתורים, inputs)
rounded-xl  →  12px  (avatars, containers קטנים)
rounded-2xl →  14px  (כרטיסים)
rounded-full →     (badges, pills, avatars עגולים)
```

חוק: לא לערבב — בחר אחד לכל סוג רכיב והישאר עם זה.

## Animation

- Transitions: 150ms ל-hover, 200ms ל-state changes
- Easing: `ease-out` כברירת מחדל
- אין page transitions גרנדיוזיות
- Loading: spinners פשוטים, אין skeletons מורכבים

```css
.timer-pulse {
  animation: pulse 1.6s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}
```

## Iconography

- **ספרייה**: Lucide React (יבוא: `import { Home, Calendar } from 'lucide-react'`)
- גודל ברירת מחדל: 18-20px
- Stroke width: 2 (default)
- צבע: יורש מ-parent
- אייקונים directional (chevrons, arrows): `rtl:rotate-180`

```tsx
// ✅ נכון
<ChevronLeft className="w-5 h-5 rtl:rotate-180" />

// ❌ לא נכון - חץ קדימה ב-RTL הופך לחץ אחורה ויזואלית
<ChevronLeft className="w-5 h-5" />
```

## Empty States

כל מסך חייב empty state אישי, לא גנרי.

```tsx
<div className="text-center py-12">
  <span className="font-caveat text-3xl text-ink-faded -rotate-2 inline-block mb-2">
    ריק כאן עדיין
  </span>
  <p className="text-body-md text-ink-soft mb-4">
    {empty state message ספציפי למסך}
  </p>
  <button className="...">{call to action}</button>
</div>
```

## Loading States

- שלד דק (skeleton): `bg-cream-deep` עם `animate-pulse`
- אין spinners מסתובבים גדולים
- ל-data tables: שורות אפורות עם רוחב משתנה

## Error States

- צבע: `navy` (לא אדום)
- אייקון: `AlertCircle` מ-Lucide
- טקסט שגיאה: `text-body-sm text-navy font-medium`
- אין emojis בשגיאות

## Accessibility

- Contrast: כל טקסט חייב WCAG AA (4.5:1)
- Focus visible תמיד: `focus-visible:ring-2 focus-visible:ring-navy/40`
- alt text לכל תמונה
- aria-label לכל icon button
- כפתורי כיווניות עם `aria-label` מפורש (לא לסמוך על אייקון)

## Mobile (PWA)

- **Touch targets מינימום 44x44px**
- Sidebar הופך ל-hamburger menu מתחת ל-900px
- אין hover states על מובייל — תקראים active states
- Bottom navigation אופציונלי לתצוגות עיקריות במובייל
- Safe area: `env(safe-area-inset-*)` לאי-iPhone notch

## אסור

❌ **לבנות סקלת צבעים מקבילה** — אין `green`, `red`, `yellow`, `blue` נוספים
❌ **לעשות gradient backgrounds** ל-buttons או cards
❌ **להשתמש ב-emoji** ב-UI עסקי (רק בהתרעות casual)
❌ **לעשות drop-shadows כבדים** — אנחנו border-based
❌ **לערבב פונטים** מעבר ל-Assistant + Caveat (+ Mono לקוד)
❌ **לעגל פינות אחרת** — Border-radius scale קבוע
❌ **לעשות text-shadow**
❌ **לעשות borders כבדים מ-1px**
❌ **לשים glassmorphism / blur effects**
❌ **לשים illustrations צבעוניים** עכשיו (Phase מאוחר אם בכלל)

## Tailwind Config

```js
// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: '#F2EBDC',
          deep: '#E8DEC8',
          paper: '#FAF5EA',
          shadow: '#DDD0B5',
        },
        navy: {
          DEFAULT: '#1B2A4E',
          deep: '#0F1B36',
          soft: '#2C3E6B',
          pale: '#B8C2D6',
        },
        ink: {
          DEFAULT: '#1B2A4E',
          soft: '#4A5878',
          faded: '#8590AB',
          line: '#D4CBB6',
        },
      },
      fontFamily: {
        sans: ['var(--font-assistant)', 'sans-serif'],
        caveat: ['var(--font-caveat)', 'cursive'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'display-lg': ['44px', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '800' }],
        'display-md': ['32px', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-sm': ['22px', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '700' }],
        'stat-lg': ['56px', { lineHeight: '1', letterSpacing: '-0.04em', fontWeight: '800' }],
        'stat': ['42px', { lineHeight: '1', letterSpacing: '-0.03em', fontWeight: '800' }],
        'micro': ['11px', { lineHeight: '1.4', letterSpacing: '0.12em', fontWeight: '600' }],
      },
    },
  },
  plugins: [require('tailwindcss-rtl')],  // הכרחי
} satisfies Config;
```

## Reference Mockup

המוקאפ הסופי: `/mockups/dashboard.html` (גרסה v3 שאישרת).

תפתח אותו ב-browser כדי לראות את כל ההחלטות העיצוביות בפעולה.
