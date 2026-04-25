# HOUR_BANKS.md — לוגיקת בנקי שעות

> זוהי הלוגיקה העסקית המורכבת ביותר במערכת. **כל implementation חייב לעבור לפי המסמך הזה במדויק.** טעות כאן = חיוב שגוי = פגיעה בלקוחות.

## רקע עסקי

OTTO מציעה ללקוחות שלוש מודלים תמחוריים:

1. **Hourly post-pay** — חיוב חודשי בסוף החודש על שעות שעבדו
2. **Hour Bank prepaid** — הלקוח רוכש בנק שעות מראש (כרטיסייה), משלם עכשיו, מנצל לאורך זמן
3. **Fixed price** — מחיר קבוע לפרויקט, לא מבוסס שעות

המודול הזה מתמקד ב-**Hour Bank** ובאינטראקציה בינו לבין **Hourly post-pay** במקרי overage.

## טבלאות

### `hour_banks`

```
id                       UUID PRIMARY KEY
tenant_id                UUID NOT NULL                 -- multi-tenant
customer_id              UUID NOT NULL FK customers
purchased_hours          DECIMAL(6,2) NOT NULL         -- 20.00, 50.00 etc.
hourly_rate              DECIMAL(8,2) NOT NULL         -- 400.00 ש"ח
total_amount             DECIMAL(10,2) NOT NULL        -- purchased_hours * hourly_rate
purchase_date            DATE NOT NULL
expiry_date              DATE NULL                     -- NULL = ללא תפוגה
status                   ENUM('active', 'depleted', 'expired', 'cancelled')
parent_bank_id           UUID NULL FK hour_banks       -- חידוש של בנק קודם
absorbed_overage_hours   DECIMAL(6,2) DEFAULT 0        -- שעות overage שנספגו לתוך הבנק החדש
alert_threshold_pct      INTEGER DEFAULT 30            -- התרעה כשנשארו פחות מ-X%
alert_threshold_hours    DECIMAL(4,2) DEFAULT 3.00     -- התרעה כשנשארו פחות מ-X שעות
alert_sent_pct           BOOLEAN DEFAULT FALSE         -- כדי לא לשלוח התרעה כפולה
alert_sent_hours         BOOLEAN DEFAULT FALSE
notes                    TEXT NULL
invoice_id               UUID NULL FK invoices         -- חשבונית מקדמה
created_at               TIMESTAMPTZ DEFAULT NOW()
created_by               UUID NOT NULL FK users
updated_at               TIMESTAMPTZ DEFAULT NOW()
```

### `time_entries` (הרחבה רלוונטית לבנקי שעות)

```
id                       UUID PRIMARY KEY
tenant_id                UUID NOT NULL
user_id                  UUID NOT NULL FK users
customer_id              UUID NOT NULL FK customers    -- חיוני לזיהוי הבנק
task_id                  UUID NULL FK tasks
project_id               UUID NULL FK projects
start_time               TIMESTAMPTZ NOT NULL
end_time                 TIMESTAMPTZ NOT NULL
duration_minutes         INTEGER NOT NULL              -- מדויק לדקה, לא מעוגל
billable                 BOOLEAN DEFAULT TRUE
billing_status           ENUM('pending', 'allocated_to_bank', 'overage', 'invoiced', 'cancelled')
consumed_from_bank_id    UUID NULL FK hour_banks       -- אם billable + יש בנק פעיל
is_overage               BOOLEAN DEFAULT FALSE         -- TRUE אם הבנק נגמר באמצע
hourly_rate_at_entry     DECIMAL(8,2) NULL             -- snapshot של התעריף ברגע הרישום
notes                    TEXT NULL
created_at               TIMESTAMPTZ DEFAULT NOW()
```

### `customers` (שדות רלוונטיים)

```
billing_model_default    ENUM('hourly', 'hour_bank', 'fixed_price', 'retainer')
hourly_rate_override     DECIMAL(8,2) NULL             -- אם NULL, יורש מהגדרה גלובלית
```

### `tenant_settings` (גלובלי)

```
default_hourly_rate              DECIMAL(8,2) DEFAULT 400.00
default_alert_threshold_pct      INTEGER DEFAULT 30
default_alert_threshold_hours    DECIMAL(4,2) DEFAULT 3.00
auto_absorb_overage_default      BOOLEAN DEFAULT TRUE
```

## תרחישים (Use Cases)

### תרחיש 1: רכישת בנק שעות חדש

**טריגר**: אורי לוחץ "צור בנק שעות חדש" עבור לקוח.

**Inputs**:

- `customer_id`
- `purchased_hours` (חובה)
- `hourly_rate` (אופציונלי — ברירת מחדל: customer.hourly_rate_override || tenant.default_hourly_rate)
- `expiry_date` (אופציונלי)
- `alert_threshold_pct` (ברירת מחדל: 30)
- `alert_threshold_hours` (ברירת מחדל: 3)

**Steps**:

1. וולידציה: `purchased_hours > 0`, `hourly_rate > 0`
2. חישוב `total_amount = purchased_hours * hourly_rate`
3. בדיקה: האם יש בנק `active` קיים עבור הלקוח? אם כן → התרעה לאורי. רק אורי יכול לאשר יצירת בנק נוסף במקביל.
4. יצירת רשומה ב-`hour_banks` עם `status = 'active'`
5. **יצירת חשבונית מקדמה 100%** דרך Make → Finbot:
   - שליחת webhook ל-Make scenario עם פרטי הלקוח, סכום, תיאור
   - Make → Finbot API → יצירת חשבונית מקדמה
   - Finbot → callback webhook עם `finbot_invoice_id`
   - עדכון `hour_banks.invoice_id`
6. יצירת notification: "בנק שעות חדש נוצר עבור {customer.name}, חשבונית מקדמה נשלחה"
7. אם זה חידוש (`parent_bank_id` קיים) — ראה תרחיש 5 לטיפול ב-overage

**Output**:

- בנק שעות `active`
- חשבונית מקדמה ב-Finbot
- Notification

---

### תרחיש 2: רישום שעת עבודה ללקוח עם בנק פעיל

**טריגר**: עצירת טיימר / יצירת time_entry ידנית עבור customer שיש לו `billing_model_default = 'hour_bank'`.

**Inputs**:

- `customer_id`
- `start_time`, `end_time`
- `billable` (כברירת מחדל TRUE)

**Steps**:

1. חישוב `duration_minutes = (end_time - start_time) / 60`. **מדויק לדקה. אין עיגול.**
2. אם `billable = FALSE` → שמירה רגילה, `billing_status = 'pending'`. סוף.
3. אם `billable = TRUE`:
   - חיפוש `active hour_bank` עבור הלקוח (סדר: `purchase_date ASC`, FIFO):
     ```sql
     SELECT * FROM hour_banks
     WHERE customer_id = ? AND status = 'active'
     ORDER BY purchase_date ASC
     LIMIT 1;
     ```
   - חישוב `remaining_minutes` של הבנק:
     ```
     remaining_minutes = (purchased_hours - absorbed_overage_hours) * 60 - SUM(time_entries.duration_minutes WHERE consumed_from_bank_id = bank.id)
     ```

4. **3 מקרים אפשריים:**

   **א. אין בנק פעיל**:
   - יצירת time_entry עם `billing_status = 'overage'`, `is_overage = TRUE`, `consumed_from_bank_id = NULL`
   - `hourly_rate_at_entry = customer.hourly_rate_override || tenant.default_hourly_rate`
   - Notification: "⚠ עבודה נרשמה ללא בנק פעיל ל-{customer.name} ({duration} דקות)"

   **ב. בנק פעיל ויש מספיק יתרה** (`remaining_minutes >= duration_minutes`):
   - יצירת time_entry עם `billing_status = 'allocated_to_bank'`, `is_overage = FALSE`, `consumed_from_bank_id = bank.id`
   - בדיקת התרעות (ראה תרחיש 4)

   **ג. בנק פעיל אבל לא מספיק יתרה** — נחלקים את ה-entry לשניים:
   - יצירת time_entry **ראשון** (חלק שנכנס לבנק):
     - `start_time = original.start_time`
     - `end_time = start_time + remaining_minutes`
     - `duration_minutes = remaining_minutes`
     - `billing_status = 'allocated_to_bank'`
     - `consumed_from_bank_id = bank.id`
     - `is_overage = FALSE`
   - יצירת time_entry **שני** (חלק overage):
     - `start_time = first.end_time`
     - `end_time = original.end_time`
     - `duration_minutes = original.duration - remaining_minutes`
     - `billing_status = 'overage'`
     - `consumed_from_bank_id = NULL`
     - `is_overage = TRUE`
     - `hourly_rate_at_entry = customer rate`
   - עדכון בנק ל-`status = 'depleted'`
   - Notification דחופה: "🔴 בנק שעות של {customer.name} נגמר באמצע סשן! {overage_minutes} דקות overage"

5. אם `billing_model = 'hourly'` (לא `'hour_bank'`) → time_entry רגיל עם `billing_status = 'pending'`, ללא בדיקת בנק.

---

### תרחיש 3: עדכון/מחיקת time_entry קיים

**חוקים קריטיים**:

- **time_entry שכבר חויב** (`billing_status = 'invoiced'`) **— אסור למחוק או לעדכן**. אם צריך, נדרש credit note.
- עדכון של `duration_minutes` — חייב לעבור דרך לוגיקת recalculation:
  - אם הבנק עדיין `active` — התאמת היתרה
  - אם הבנק `depleted` — שאל את אורי האם להחזיר את הזמן לבנק (אם הוא עכשיו ארוך מדי) או לזרוק
- מחיקת time_entry שכן הוקצה לבנק — מחזיר את הזמן לבנק (`status` חוזר ל-`active` אם היה `depleted`).

---

### תרחיש 4: התרעות יתרה נמוכה

**מתי בודקים**: לאחר כל time_entry שמופחת מהבנק.

**שתי התרעות נפרדות**:

1. **אחוז**: `remaining / purchased <= alert_threshold_pct / 100`
   - אם `alert_sent_pct = FALSE` → שלח התרעה + סמן `alert_sent_pct = TRUE`
   - הודעה: "⏰ נשארו רק {pct}% בבנק של {customer.name} ({remaining_hours} מתוך {purchased_hours} שעות)"

2. **שעות**: `remaining_hours <= alert_threshold_hours`
   - אם `alert_sent_hours = FALSE` → שלח התרעה + סמן `alert_sent_hours = TRUE`
   - הודעה: "🚨 נשארו רק {remaining_hours} שעות בבנק של {customer.name}!"

**שני הסוגים יכולים להישלח באותה רגע** (אם הבנק התרוקן בקצב מהיר). זה תקין.

**טיוטת חידוש אוטומטית**:

- כשמופעלת התרעה (אחת מהשתיים) → המערכת **יוצרת אוטומטית טיוטת הצעת חידוש**:
  - בנק חדש באותם פרמטרים (purchased_hours, hourly_rate, expiry duration)
  - parent_bank_id = הבנק הנוכחי
  - status = `draft`
- **לא נשלחת ללקוח** — רק נשמרת
- Notification: "📝 הכנתי טיוטת חידוש עבור {customer.name} — בודקת ומאשרת ידנית"
- אורי נכנס למסך → סוקר → עורך אם רוצה → מאשר → ההצעה נשלחת ללקוח

---

### תרחיש 5: חידוש בנק שעות עם טיפול ב-overage

**טריגר**: אורי מאשר טיוטת חידוש, או יוצר ידנית בנק חדש כשיש overage לא מטופל.

**Steps**:

1. בדיקה: האם ללקוח יש time_entries עם `is_overage = TRUE` ו-`billing_status = 'overage'` (לא חויבו עדיין)?
2. אם **כן** — הצגת dialog:

   ```
   נמצאו {N} שעות חריגה לא מטופלות עבור {customer.name}.
   סה"כ {hours} שעות בערך {amount} ש"ח.

   מה לעשות?

   [ ] לכלול בבנק החדש (יצרך {hours} מהבנק החדש מיד) — ברירת מחדל
   [ ] להוציא חשבונית נפרדת על השעות
   [ ] לזרוק (לא לחייב — מתנה ללקוח)
   ```

3. אם בחר **"לכלול בבנק החדש"**:
   - יצירת בנק חדש כרגיל (תרחיש 1)
   - עדכון `absorbed_overage_hours = sum(overage hours)`
   - עדכון כל time_entries.billing_status מ-`'overage'` ל-`'allocated_to_bank'` עם `consumed_from_bank_id = new_bank.id`
   - הבנק החדש מתחיל עם יתרה אפקטיבית = `purchased_hours - absorbed_overage_hours`
   - Notification: "✅ נוצר בנק חדש עם {purchased} שעות, מתוכן {absorbed} שעות נוצלו מיד עבור overage"

4. אם בחר **"חשבונית נפרדת"**:
   - יצירת בנק חדש (ללא absorbed)
   - יצירת חשבונית נפרדת דרך Finbot על שעות ה-overage \* tariff
   - עדכון time_entries ל-`billing_status = 'invoiced'`

5. אם בחר **"לזרוק"**:
   - עדכון time_entries ל-`billing_status = 'cancelled'`
   - Notification: "📋 {hours} שעות overage של {customer.name} נמחקו"

---

### תרחיש 6: סיום חודש — חיוב לקוחות hourly

**טריגר**: cron בסוף כל חודש.

**Steps לכל לקוח עם `billing_model_default = 'hourly'`**:

1. אגרגציה של כל time_entries עם `billing_status = 'pending'` של החודש
2. חישוב סה"כ דקות → סה"כ שעות (3 ספרות אחרי הנקודה)
3. יצירת **טיוטת דוח שעות** עם פירוט
4. יצירת **טיוטת חשבונית** ב-Finbot עם:
   - שם לקוח
   - שורות: כל פרויקט / משימה (אם מקובץ)
   - סכום: שעות \* `hourly_rate`
5. **לא שולח ללקוח אוטומטית** — נשמר כ-`pending_review`
6. Notification לאורי: "📊 דוחות חודשיים מוכנים ל-{N} לקוחות"
7. אורי בודק → מאשר → המערכת מסמנת time_entries כ-`'invoiced'` ושולחת חשבונית

---

### תרחיש 7: תפוגת בנק

**טריגר**: cron יומי.

**Steps**:

1. מציאת כל בנקים עם `status = 'active'` ו-`expiry_date < NOW()`
2. עבור כל בנק:
   - אם יש יתרה > 0:
     - `status = 'expired'`
     - שליחת notification דחופה: "⚠ בנק של {customer.name} פג תוקף עם {hours} שעות לא מנוצלות"
     - **המערכת לא זורקת אוטומטית** — אורי יכול להאריך תפוגה / להחזיר חלקית כספית
   - אם יתרה = 0:
     - `status = 'depleted'` (בנק שהסתיים בכל מקרה)

---

## נוסחאות חישוב

### יתרה זמינה בבנק

```
available_minutes(bank) = (bank.purchased_hours - bank.absorbed_overage_hours) * 60
                        - SUM(time_entries.duration_minutes
                             WHERE consumed_from_bank_id = bank.id
                             AND billing_status != 'cancelled')

available_hours(bank) = available_minutes(bank) / 60.0
```

### אחוז שנוצל

```
used_pct(bank) = (1 - available_minutes(bank) / (bank.purchased_hours * 60)) * 100
```

### סך overage לא מטופל ללקוח

```
unhandled_overage(customer) = SUM(time_entries.duration_minutes
                                 WHERE customer_id = customer.id
                                 AND is_overage = TRUE
                                 AND billing_status = 'overage')
```

## RLS Policies

```sql
-- כל הבנקים — רק tenant של המשתמש
CREATE POLICY hour_banks_tenant_isolation ON hour_banks
  FOR ALL USING (tenant_id = auth.jwt() ->> 'tenant_id');

-- לקוח רואה רק בנקים שלו דרך פורטל
CREATE POLICY hour_banks_client_view ON hour_banks
  FOR SELECT USING (
    tenant_id = auth.jwt() ->> 'tenant_id'
    AND auth.jwt() ->> 'role' = 'client'
    AND customer_id = auth.jwt() ->> 'customer_id'
  );
```

## Indexes חיוניים

```sql
CREATE INDEX idx_hour_banks_customer_active
  ON hour_banks(customer_id, status)
  WHERE status = 'active';

CREATE INDEX idx_hour_banks_expiry
  ON hour_banks(expiry_date)
  WHERE status = 'active' AND expiry_date IS NOT NULL;

CREATE INDEX idx_time_entries_bank
  ON time_entries(consumed_from_bank_id)
  WHERE consumed_from_bank_id IS NOT NULL;

CREATE INDEX idx_time_entries_overage
  ON time_entries(customer_id, billing_status)
  WHERE is_overage = TRUE AND billing_status = 'overage';
```

## Unit Tests חובה

לפני שmודול הזה רץ ב-production, חייבים בדיקות עבור:

1. ✅ רכישת בנק חדש → נוצרת חשבונית מקדמה
2. ✅ time_entry עם הקצאה מלאה לבנק
3. ✅ time_entry שגדול מהיתרה → split ל-2 entries
4. ✅ time_entry ללא בנק → overage
5. ✅ התרעת 30% נשלחת פעם אחת בלבד
6. ✅ התרעת 3 שעות נשלחת פעם אחת בלבד
7. ✅ שתי התרעות יכולות להישלח באותה רגע
8. ✅ חידוש בנק עם absorbed_overage — היתרה הנכונה
9. ✅ עדכון duration שמשנה הקצאה — recalculation נכון
10. ✅ מחיקת time_entry → החזרת זמן לבנק
11. ✅ time_entry עם `billable = FALSE` לא נכנס לבנק
12. ✅ FIFO: אם יש 2 בנקים active, הישן נצרך קודם
13. ✅ תפוגת בנק יוצרת notification, לא מחיקה
14. ✅ בדיקת decimals — 1ח 22 דקות = 82 דקות, לא 1.37 שעות

## הערות implementation

- **חשבונים** השתמש ב-`DECIMAL`, לא `FLOAT`. אסור לאבד דיוק על כסף.
- **דקות** השתמש ב-`INTEGER`, לא `FLOAT`. תמיד שלם.
- **שעות בתצוגה** המרה ל-`DECIMAL(6,2)` רק בעת הצגה.
- **timezone**: כל הזמנים ב-`TIMESTAMPTZ` (UTC). תצוגה ב-`Asia/Jerusalem`.
- **concurrency**: שימוש ב-`SELECT FOR UPDATE` כש-recalculating יתרת בנק (למנוע race conditions).

## דוגמה מעשית מלאה

> מתוך ה-PRD — נשמר כאן לבדיקת correctness של implementation.

**רוני אבן רוכשת בנק 20 שעות במחיר 8,000 ש"ח** (תעריף 400/שעה).

- bank_1 נוצר: purchased=20, hourly_rate=400, total=8000
- חשבונית מקדמה 8,000 ש"ח דרך Finbot

**15/4 רוני עבדה 18 שעות.**

- 18 time_entries (או יותר) נוספים
- כולם `consumed_from_bank_id = bank_1.id`, `is_overage = FALSE`
- יתרה: 2 שעות

**16/4 התרעת 30% נשלחת** (2/20 = 10%, מתחת ל-30%).

- `bank_1.alert_sent_pct = TRUE`
- טיוטת חידוש מוכנה

**16/4 התרעת 3 שעות נשלחת** (2 < 3).

- `bank_1.alert_sent_hours = TRUE`

**20/4 רוני עבדה 5 שעות.**

- בדיקת יתרה: 2 שעות (120 דקות) זמינות
- entry ראשון: 120 דקות → bank_1, `allocated_to_bank`
- bank_1 → status `depleted`
- entry שני: 180 דקות → `overage`, `is_overage = TRUE`
- Notification: "🔴 הבנק נגמר! 180 דקות overage לרוני"

**21/4 אורי שולח הצעת חידוש** (טיוטה שהוכנה ב-16/4).

**22/4 רוני אישרה.**

- Dialog: "יש 3 שעות overage. מה לעשות?"
- אורי: "לכלול בבנק החדש"
- bank_2 נוצר:
  - purchased = 20
  - absorbed_overage_hours = 3
  - parent_bank_id = bank_1.id
  - יתרה אפקטיבית = 17 שעות
- חשבונית מקדמה חדשה 8,000 ש"ח דרך Finbot
- כל time_entries הoverage מתעדכנים: `billing_status = 'allocated_to_bank'`, `consumed_from_bank_id = bank_2.id`

**מצב סופי:**

- bank_1: depleted, 20 שעות נוצלו
- bank_2: active, 17 שעות זמינות
- 0 overage לא מטופל
- 2 חשבוניות מקדמה ב-Finbot (16,000 ש"ח סה"כ)
