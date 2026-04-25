# DATA_MODEL.md — מפרט מודל הנתונים

> מפרט הישויות, השדות, היחסים, ה-RLS וה-indexes. **לא SQL אלא מפרט** — Claude Code יתרגם ל-Supabase migrations.

## עקרונות

1. **כל טבלה עם `tenant_id`** (multi-tenant ready)
2. **כל טבלה עם `created_at`, `created_by`, `updated_at`** (audit trail)
3. **Soft delete** ל-entities עסקיות (customers, projects) — דרך `deleted_at`
4. **Hard delete** מותר ל-system entities (notifications, activity logs)
5. **DECIMAL לכסף**, **INTEGER לדקות**, **TIMESTAMPTZ לזמנים**
6. **snake_case בשמות טבלאות ושדות**
7. **שמות טבלאות ברבים** (customers, not customer)
8. **RLS מופעל על כל טבלה** מההתחלה

## טיפוסים נפוצים

```
UUID                 — id, foreign keys (gen_random_uuid())
TIMESTAMPTZ          — זמנים (UTC, תצוגה Asia/Jerusalem)
DECIMAL(10,2)        — סכומי כסף עד 99,999,999.99
DECIMAL(6,2)         — שעות (עד 9999.99)
INTEGER              — דקות, ספירות, אחוזים
TEXT                 — strings (אין VARCHAR, אין length limits)
TEXT[]               — מערכי תגיות
JSONB                — settings, metadata, mixed data
ENUM                 — status fields (יוצרים כ-CHECK constraints)
```

---

## ישויות

### `tenants`

מקומי לעת עתה, ערוך לעתיד SaaS.

| שדה        | טיפוס       | הערות                                       |
| ---------- | ----------- | ------------------------------------------- |
| id         | UUID        | PK                                          |
| name       | TEXT        | "OTTO"                                      |
| slug       | TEXT        | unique, ל-subdomain                         |
| plan       | ENUM        | 'free', 'pro', 'business' (היום: free)      |
| settings   | JSONB       | מפתחות גלובליים (default_hourly_rate, וכו') |
| logo_url   | TEXT        | NULL                                        |
| created_at | TIMESTAMPTZ |                                             |

**Indexes**: PK בלבד.

**RLS**: `id = auth.jwt() ->> 'tenant_id'`

---

### `users`

משתמשי המערכת (admin, team, clients).

| שדה          | טיפוס       | הערות                           |
| ------------ | ----------- | ------------------------------- |
| id           | UUID        | PK = auth.users.id              |
| tenant_id    | UUID        | FK                              |
| email        | TEXT        | unique לכל tenant               |
| full_name    | TEXT        |                                 |
| role         | ENUM        | 'admin', 'team', 'client'       |
| customer_id  | UUID        | FK customers (אם role='client') |
| avatar_url   | TEXT        | NULL                            |
| settings     | JSONB       | UI preferences                  |
| last_seen_at | TIMESTAMPTZ |                                 |
| created_at   | TIMESTAMPTZ |                                 |

**Indexes**:

- `(tenant_id, email)` unique
- `(tenant_id, role)`
- `(customer_id)` partial WHERE role='client'

**RLS**: `tenant_id = auth.jwt() ->> 'tenant_id'`. Clients רואים רק את עצמם.

---

### `customers`

לקוחות פעילים (אחרי המרה מליד).

| שדה                    | טיפוס        | הערות                                            |
| ---------------------- | ------------ | ------------------------------------------------ |
| id                     | UUID         | PK                                               |
| tenant_id              | UUID         | FK                                               |
| name                   | TEXT         | שם החברה / האדם                                  |
| email                  | TEXT         | NULL                                             |
| phone                  | TEXT         | פורמט בינלאומי +972...                           |
| billing_id             | TEXT         | ח.פ. / ע.מ. / ת.ז.                               |
| billing_address        | TEXT         | NULL                                             |
| billing_model_default  | ENUM         | 'hourly', 'hour_bank', 'fixed_price', 'retainer' |
| hourly_rate_override   | DECIMAL(8,2) | NULL = יורש מגלובלי                              |
| tags                   | TEXT[]       | ['VIP', 'חודשי', וכו']                           |
| status                 | ENUM         | 'active', 'inactive', 'archived'                 |
| source_system          | TEXT         | 'native', 'airtable_courses', וכו'               |
| external_id            | TEXT         | id במערכת חיצונית (לסנכרון Airtable)             |
| notes_internal         | TEXT         | NULL — הערות שהלקוח לא רואה                      |
| google_drive_folder_id | TEXT         | NULL                                             |
| created_at             | TIMESTAMPTZ  |                                                  |
| created_by             | UUID         | FK users                                         |
| updated_at             | TIMESTAMPTZ  |                                                  |
| deleted_at             | TIMESTAMPTZ  | NULL — soft delete                               |

**Indexes**:

- `(tenant_id, status)` partial WHERE deleted_at IS NULL
- `(tenant_id, external_id, source_system)` partial WHERE external_id IS NOT NULL
- GIN על `tags`
- Full-text search על `name` עם עברית

**RLS**:

- Admin/Team: `tenant_id = auth.jwt() ->> 'tenant_id' AND deleted_at IS NULL`
- Client: רואה רק את עצמו (`id = auth.jwt() ->> 'customer_id'`)

---

### `contacts`

אנשי קשר אצל לקוחות.

| שדה         | טיפוס       | הערות             |
| ----------- | ----------- | ----------------- |
| id          | UUID        | PK                |
| tenant_id   | UUID        | FK                |
| customer_id | UUID        | FK customers      |
| name        | TEXT        |                   |
| role        | TEXT        | "מנכ\"לית", "CTO" |
| email       | TEXT        | NULL              |
| phone       | TEXT        | NULL              |
| is_primary  | BOOLEAN     | DEFAULT FALSE     |
| notes       | TEXT        | NULL              |
| created_at  | TIMESTAMPTZ |                   |

**Indexes**:

- `(customer_id)`
- `(customer_id, is_primary)` partial WHERE is_primary=TRUE

**RLS**: `tenant_id = auth.jwt() ->> 'tenant_id'`. Clients רואים contacts של ה-customer שלהם.

---

### `leads`

לידים פוטנציאליים, לפני המרה ל-customer.

| שדה                      | טיפוס         | הערות                                                                   |
| ------------------------ | ------------- | ----------------------------------------------------------------------- |
| id                       | UUID          | PK                                                                      |
| tenant_id                | UUID          | FK                                                                      |
| name                     | TEXT          |                                                                         |
| email                    | TEXT          | NULL                                                                    |
| phone                    | TEXT          |                                                                         |
| source                   | ENUM          | 'whatsapp', 'website', 'referral', 'instagram', 'course', 'other'       |
| stage                    | ENUM          | 'new', 'contacted', 'meeting', 'proposal', 'negotiation', 'won', 'lost' |
| score                    | INTEGER       | 0-100                                                                   |
| budget_estimate          | DECIMAL(10,2) | NULL                                                                    |
| description              | TEXT          | מה הם רוצים                                                             |
| utm_source               | TEXT          |                                                                         |
| utm_medium               | TEXT          |                                                                         |
| utm_campaign             | TEXT          |                                                                         |
| tags                     | TEXT[]        |                                                                         |
| converted_to_customer_id | UUID          | FK customers, NULL עד המרה                                              |
| converted_at             | TIMESTAMPTZ   | NULL                                                                    |
| lost_reason              | TEXT          | NULL                                                                    |
| assigned_to              | UUID          | FK users                                                                |
| created_at               | TIMESTAMPTZ   |                                                                         |
| updated_at               | TIMESTAMPTZ   |                                                                         |

**Indexes**:

- `(tenant_id, stage)`
- `(tenant_id, source, created_at DESC)`
- GIN על `tags`

**RLS**: `tenant_id = auth.jwt() ->> 'tenant_id' AND auth.jwt() ->> 'role' IN ('admin', 'team')`

---

### `lead_activities`

תיעוד פעילות בליד (שיחות, פגישות, מיילים).

| שדה          | טיפוס       | הערות                                          |
| ------------ | ----------- | ---------------------------------------------- |
| id           | UUID        | PK                                             |
| tenant_id    | UUID        | FK                                             |
| lead_id      | UUID        | FK leads                                       |
| type         | ENUM        | 'call', 'email', 'meeting', 'whatsapp', 'note' |
| content      | TEXT        |                                                |
| performed_by | UUID        | FK users                                       |
| performed_at | TIMESTAMPTZ |                                                |

**Indexes**: `(lead_id, performed_at DESC)`

---

### `projects`

פרויקטים מתבצעים.

| שדה                    | טיפוס         | הערות                                                                      |
| ---------------------- | ------------- | -------------------------------------------------------------------------- |
| id                     | UUID          | PK                                                                         |
| tenant_id              | UUID          | FK                                                                         |
| customer_id            | UUID          | FK customers                                                               |
| parent_project_id      | UUID          | FK projects (היררכיה)                                                      |
| name                   | TEXT          |                                                                            |
| description            | TEXT          |                                                                            |
| status                 | ENUM          | 'planning', 'active', 'on_hold', 'completed', 'cancelled'                  |
| phase                  | ENUM          | 'discovery', 'specification', 'development', 'qa', 'launch', 'maintenance' |
| billing_model          | ENUM          | 'hourly', 'hour_bank', 'fixed_price', 'retainer'                           |
| budget                 | DECIMAL(10,2) | NULL                                                                       |
| estimated_hours        | DECIMAL(6,2)  | NULL                                                                       |
| start_date             | DATE          | NULL                                                                       |
| due_date               | DATE          | NULL                                                                       |
| completed_at           | TIMESTAMPTZ   | NULL                                                                       |
| google_drive_folder_id | TEXT          | NULL                                                                       |
| template_id            | UUID          | FK project_templates, NULL אם לא מתבנית                                    |
| tags                   | TEXT[]        |                                                                            |
| health                 | ENUM          | 'on_track', 'at_risk', 'off_track'                                         |
| created_at             | TIMESTAMPTZ   |                                                                            |
| created_by             | UUID          | FK users                                                                   |
| updated_at             | TIMESTAMPTZ   |                                                                            |
| deleted_at             | TIMESTAMPTZ   | NULL                                                                       |

**Indexes**:

- `(tenant_id, status, due_date)` partial WHERE deleted_at IS NULL
- `(customer_id, status)` partial WHERE deleted_at IS NULL
- `(parent_project_id)` partial WHERE parent_project_id IS NOT NULL
- GIN על `tags`

**Constraints**:

- `parent_project_id != id` (no self-loop)
- check על depth מקסימלי (recursive — לטפל ב-application או trigger)

**RLS**:

- Admin/Team: `tenant_id = auth.jwt() ->> 'tenant_id' AND deleted_at IS NULL`
- Client: `customer_id = auth.jwt() ->> 'customer_id'`

---

### `project_templates`

תבניות לפרויקטים.

| שדה                     | טיפוס        | הערות                 |
| ----------------------- | ------------ | --------------------- |
| id                      | UUID         | PK                    |
| tenant_id               | UUID         | FK                    |
| name                    | TEXT         | "אפליקציית Next.js"   |
| description             | TEXT         |                       |
| default_billing_model   | ENUM         |                       |
| default_estimated_hours | DECIMAL(6,2) |                       |
| tasks_template          | JSONB        | מערך משימות עם תלויות |
| phases_template         | JSONB        |                       |
| created_at              | TIMESTAMPTZ  |                       |

---

### `milestones`

אבני דרך בפרויקט.

| שדה          | טיפוס       | הערות       |
| ------------ | ----------- | ----------- |
| id           | UUID        | PK          |
| tenant_id    | UUID        | FK          |
| project_id   | UUID        | FK projects |
| name         | TEXT        |             |
| description  | TEXT        |             |
| due_date     | DATE        |             |
| completed_at | TIMESTAMPTZ | NULL        |
| order_index  | INTEGER     | לסידור      |

**Indexes**: `(project_id, order_index)`

---

### `tasks`

משימות.

| שדה              | טיפוס       | הערות                                                |
| ---------------- | ----------- | ---------------------------------------------------- |
| id               | UUID        | PK                                                   |
| tenant_id        | UUID        | FK                                                   |
| project_id       | UUID        | FK projects, NULL אם standalone                      |
| parent_task_id   | UUID        | FK tasks (subtasks)                                  |
| title            | TEXT        |                                                      |
| description      | TEXT        |                                                      |
| status           | ENUM        | 'todo', 'in_progress', 'review', 'done', 'cancelled' |
| priority         | ENUM        | 'low', 'medium', 'high', 'urgent'                    |
| assigned_to      | UUID        | FK users                                             |
| due_date         | DATE        | NULL                                                 |
| completed_at     | TIMESTAMPTZ | NULL                                                 |
| recurring_config | JSONB       | NULL — `{type: 'weekly', interval: 1}`               |
| tags             | TEXT[]      |                                                      |
| order_index      | INTEGER     |                                                      |
| created_at       | TIMESTAMPTZ |                                                      |
| created_by       | UUID        | FK users                                             |

**Indexes**:

- `(tenant_id, assigned_to, status)`
- `(project_id, status, order_index)`
- `(due_date)` partial WHERE status NOT IN ('done', 'cancelled')

**RLS**:

- Admin/Team: `tenant_id = auth.jwt() ->> 'tenant_id'`
- Client: רואה משימות של פרויקט שלו, **בסטטוסים מוגבלים** (לא 'review' אם רוצים לחשוף בלעדית)

---

### `time_entries`

רישומי זמן עבודה.

**ראה HOUR_BANKS.md לפירוט מלא**

| שדה                   | טיפוס        | הערות                                                              |
| --------------------- | ------------ | ------------------------------------------------------------------ |
| id                    | UUID         | PK                                                                 |
| tenant_id             | UUID         | FK                                                                 |
| user_id               | UUID         | FK users                                                           |
| customer_id           | UUID         | FK customers (חיוני)                                               |
| task_id               | UUID         | FK tasks, NULL                                                     |
| project_id            | UUID         | FK projects, NULL                                                  |
| start_time            | TIMESTAMPTZ  |                                                                    |
| end_time              | TIMESTAMPTZ  |                                                                    |
| duration_minutes      | INTEGER      | מדויק לדקה, חיוב ללא עיגול                                         |
| billable              | BOOLEAN      | DEFAULT TRUE                                                       |
| billing_status        | ENUM         | 'pending', 'allocated_to_bank', 'overage', 'invoiced', 'cancelled' |
| consumed_from_bank_id | UUID         | FK hour_banks, NULL                                                |
| is_overage            | BOOLEAN      | DEFAULT FALSE                                                      |
| hourly_rate_at_entry  | DECIMAL(8,2) | snapshot                                                           |
| invoice_id            | UUID         | FK invoices, NULL                                                  |
| notes                 | TEXT         | NULL                                                               |
| created_at            | TIMESTAMPTZ  |                                                                    |

**Indexes**:

- `(tenant_id, user_id, start_time DESC)`
- `(customer_id, start_time DESC)`
- `(consumed_from_bank_id)` partial WHERE consumed_from_bank_id IS NOT NULL
- `(customer_id, billing_status)` partial WHERE is_overage=TRUE AND billing_status='overage'
- `(invoice_id)` partial WHERE invoice_id IS NOT NULL

**Constraints**: `end_time > start_time`, `duration_minutes > 0`

**RLS**:

- Admin/Team: `tenant_id = auth.jwt() ->> 'tenant_id'`
- Client: רואה רק שלו (`customer_id = auth.jwt() ->> 'customer_id'`), **רק** עם `billing_status IN ('allocated_to_bank', 'invoiced')`

---

### `hour_banks`

ראה **HOUR_BANKS.md** לפירוט מלא — זה המסמך המוסמך.

| שדה                                | טיפוס                                             |
| ---------------------------------- | ------------------------------------------------- |
| id                                 | UUID                                              |
| tenant_id                          | UUID                                              |
| customer_id                        | UUID                                              |
| purchased_hours                    | DECIMAL(6,2)                                      |
| hourly_rate                        | DECIMAL(8,2)                                      |
| total_amount                       | DECIMAL(10,2)                                     |
| purchase_date                      | DATE                                              |
| expiry_date                        | DATE NULL                                         |
| status                             | ENUM 'active', 'depleted', 'expired', 'cancelled' |
| parent_bank_id                     | UUID NULL                                         |
| absorbed_overage_hours             | DECIMAL(6,2) DEFAULT 0                            |
| alert_threshold_pct                | INTEGER DEFAULT 30                                |
| alert_threshold_hours              | DECIMAL(4,2) DEFAULT 3.00                         |
| alert_sent_pct                     | BOOLEAN DEFAULT FALSE                             |
| alert_sent_hours                   | BOOLEAN DEFAULT FALSE                             |
| invoice_id                         | UUID NULL                                         |
| notes                              | TEXT                                              |
| created_at, created_by, updated_at |                                                   |

**Indexes**:

- `(customer_id, status)` partial WHERE status='active'
- `(expiry_date)` partial WHERE status='active' AND expiry_date IS NOT NULL

---

### `invoices`

חשבוניות. הנתונים האמיתיים ב-Finbot, פה רק metadata.

| שדה                | טיפוס         | הערות                                                             |
| ------------------ | ------------- | ----------------------------------------------------------------- |
| id                 | UUID          | PK                                                                |
| tenant_id          | UUID          | FK                                                                |
| customer_id        | UUID          | FK customers                                                      |
| finbot_invoice_id  | TEXT          | id ב-Finbot                                                       |
| finbot_invoice_url | TEXT          | קישור ל-PDF                                                       |
| invoice_number     | TEXT          | מספר חשבונית                                                      |
| amount             | DECIMAL(10,2) |                                                                   |
| amount_paid        | DECIMAL(10,2) | DEFAULT 0                                                         |
| currency           | TEXT          | DEFAULT 'ILS'                                                     |
| status             | ENUM          | 'draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled' |
| type               | ENUM          | 'regular', 'advance', 'overage', 'credit_note'                    |
| issue_date         | DATE          |                                                                   |
| due_date           | DATE          |                                                                   |
| paid_at            | TIMESTAMPTZ   | NULL                                                              |
| project_id         | UUID          | FK projects, NULL                                                 |
| hour_bank_id       | UUID          | FK hour_banks, NULL (חשבונית מקדמה לבנק)                          |
| description        | TEXT          |                                                                   |
| created_at         | TIMESTAMPTZ   |                                                                   |

**Indexes**:

- `(customer_id, status)`
- `(due_date)` partial WHERE status IN ('sent', 'overdue')
- `(finbot_invoice_id)` unique

**RLS**:

- Admin/Team: `tenant_id`
- Client: שלו בלבד

---

### `payments`

תשלומים שהתקבלו.

| שדה          | טיפוס         | הערות                                                  |
| ------------ | ------------- | ------------------------------------------------------ |
| id           | UUID          | PK                                                     |
| tenant_id    | UUID          | FK                                                     |
| invoice_id   | UUID          | FK invoices                                            |
| amount       | DECIMAL(10,2) |                                                        |
| payment_date | DATE          |                                                        |
| method       | ENUM          | 'bank_transfer', 'credit_card', 'bit', 'cash', 'other' |
| reference    | TEXT          | מספר אסמכתא                                            |
| created_at   | TIMESTAMPTZ   |                                                        |

---

### `expenses`

הוצאות עסקיות.

| שדה          | טיפוס         | הערות                           |
| ------------ | ------------- | ------------------------------- |
| id           | UUID          | PK                              |
| tenant_id    | UUID          | FK                              |
| category     | TEXT          | "כלים", "תוכנה", וכו'           |
| vendor       | TEXT          |                                 |
| amount       | DECIMAL(10,2) |                                 |
| currency     | TEXT          | DEFAULT 'ILS'                   |
| expense_date | DATE          |                                 |
| invoice_url  | TEXT          | NULL — קישור לחשבונית מצורפת    |
| project_id   | UUID          | NULL — אם הוצאה ספציפית לפרויקט |
| notes        | TEXT          |                                 |
| created_at   | TIMESTAMPTZ   |                                 |

---

### `proposals`

הצעות מחיר אינטראקטיביות.

| שדה                     | טיפוס         | הערות                                                      |
| ----------------------- | ------------- | ---------------------------------------------------------- |
| id                      | UUID          | PK                                                         |
| tenant_id               | UUID          | FK                                                         |
| customer_id             | UUID          | NULL — אם נשלח לליד שטרם המיר                              |
| lead_id                 | UUID          | NULL                                                       |
| public_id               | TEXT          | unique slug ל-URL ציבורי                                   |
| title                   | TEXT          |                                                            |
| status                  | ENUM          | 'draft', 'sent', 'viewed', 'signed', 'rejected', 'expired' |
| modules                 | JSONB         | מערך מודולים: `[{id, name, price, selected, optional}]`    |
| total_amount            | DECIMAL(10,2) |                                                            |
| selected_amount         | DECIMAL(10,2) | מה שהלקוח בחר                                              |
| timeline                | JSONB         | milestones                                                 |
| testimonials            | JSONB         |                                                            |
| faq                     | JSONB         |                                                            |
| template_id             | UUID          | NULL                                                       |
| view_count              | INTEGER       | DEFAULT 0                                                  |
| first_opened_at         | TIMESTAMPTZ   | NULL                                                       |
| last_viewed_at          | TIMESTAMPTZ   | NULL                                                       |
| total_view_time_seconds | INTEGER       | DEFAULT 0                                                  |
| signature_data          | TEXT          | base64 of canvas signature                                 |
| signed_at               | TIMESTAMPTZ   | NULL                                                       |
| signed_by_name          | TEXT          | NULL                                                       |
| signed_by_email         | TEXT          | NULL                                                       |
| signed_ip               | INET          | NULL                                                       |
| valid_until             | DATE          | NULL                                                       |
| created_at              | TIMESTAMPTZ   |                                                            |
| created_by              | UUID          | FK users                                                   |

**Indexes**:

- `(public_id)` unique
- `(tenant_id, status)`
- `(customer_id, status)`

**RLS**:

- Admin/Team: `tenant_id`
- **Public access** דרך `public_id` (לא דרך RLS — דרך function security definer)

---

### `proposal_views`

מעקב פתיחות הצעות מחיר.

| שדה                   | טיפוס       |
| --------------------- | ----------- |
| id                    | UUID        |
| proposal_id           | UUID FK     |
| viewer_ip             | INET        |
| user_agent            | TEXT        |
| viewed_modules        | TEXT[]      |
| view_duration_seconds | INTEGER     |
| viewed_at             | TIMESTAMPTZ |

---

### `documents`

מסמכים (חוזים, אפיונים, וכו').

| שדה                | טיפוס        | הערות                                                   |
| ------------------ | ------------ | ------------------------------------------------------- |
| id                 | UUID         | PK                                                      |
| tenant_id          | UUID         | FK                                                      |
| customer_id        | UUID         | NULL                                                    |
| project_id         | UUID         | NULL                                                    |
| type               | ENUM         | 'contract', 'spec', 'deliverable', 'reference', 'other' |
| title              | TEXT         |                                                         |
| file_url           | TEXT         | Supabase Storage URL or Drive URL                       |
| file_source        | ENUM         | 'storage', 'drive'                                      |
| file_size_bytes    | BIGINT       |                                                         |
| mime_type          | TEXT         |                                                         |
| signature_required | BOOLEAN      | DEFAULT FALSE                                           |
| signed_at          | TIMESTAMPTZ  | NULL                                                    |
| signature_data     | TEXT         | NULL                                                    |
| visible_to_client  | BOOLEAN      | DEFAULT FALSE                                           |
| embedding          | VECTOR(1536) | pgvector — embedding של תוכן                            |
| extracted_text     | TEXT         | NULL — לחיפוש                                           |
| tags               | TEXT[]       |                                                         |
| created_at         | TIMESTAMPTZ  |                                                         |

**Indexes**:

- `(customer_id)`, `(project_id)`
- HNSW על `embedding` (pgvector)
- GIN על `tags`
- Full-text על `extracted_text`

---

### `recordings`

הקלטות פגישות.

| שדה               | טיפוס       | הערות                           |
| ----------------- | ----------- | ------------------------------- |
| id                | UUID        | PK                              |
| tenant_id         | UUID        | FK                              |
| customer_id       | UUID        | NULL                            |
| project_id        | UUID        | NULL                            |
| event_id          | UUID        | FK events, NULL                 |
| source            | ENUM        | 'zoom', 'web_recorder', 'phone' |
| audio_url         | TEXT        | Google Drive URL                |
| duration_seconds  | INTEGER     |                                 |
| zoom_meeting_id   | TEXT        | NULL                            |
| zoom_recording_id | TEXT        | NULL                            |
| recorded_at       | TIMESTAMPTZ |                                 |
| created_at        | TIMESTAMPTZ |                                 |

**Indexes**:

- `(tenant_id, recorded_at DESC)`
- `(customer_id, recorded_at DESC)`
- `(zoom_recording_id)` unique partial WHERE zoom_recording_id IS NOT NULL

---

### `transcripts`

תמלולים של הקלטות.

| שדה                     | טיפוס        | הערות                                          |
| ----------------------- | ------------ | ---------------------------------------------- |
| id                      | UUID         | PK                                             |
| tenant_id               | UUID         | FK                                             |
| recording_id            | UUID         | FK recordings (1:1)                            |
| content                 | JSONB        | מערך segments: `[{speaker, start, end, text}]` |
| full_text               | TEXT         | תמלול מאוחד לחיפוש                             |
| language                | TEXT         | DEFAULT 'he'                                   |
| model                   | TEXT         | "ivrit-ai/whisper-large-v3"                    |
| diarization_enabled     | BOOLEAN      |                                                |
| processing_time_seconds | DECIMAL(8,2) |                                                |
| cost_usd                | DECIMAL(8,4) | RunPod execution cost                          |
| embedding               | VECTOR(1536) | של full_text                                   |
| created_at              | TIMESTAMPTZ  |                                                |

**Indexes**:

- `(recording_id)` unique
- HNSW על `embedding`
- Full-text על `full_text` עם עברית

---

### `meeting_summaries`

סיכומי AI של פגישות.

| שדה                    | טיפוס       | הערות                                    |
| ---------------------- | ----------- | ---------------------------------------- |
| id                     | UUID        | PK                                       |
| tenant_id              | UUID        | FK                                       |
| transcript_id          | UUID        | FK transcripts                           |
| summary_internal       | TEXT        | סיכום פנימי מפורט                        |
| summary_for_client     | TEXT        | סיכום מנוקה ללקוח                        |
| key_points             | JSONB       | מערך נקודות מפתח                         |
| action_items           | JSONB       | מערך משימות מוצעות                       |
| suggested_tasks_status | ENUM        | 'pending_review', 'approved', 'rejected' |
| approved_at            | TIMESTAMPTZ | NULL                                     |
| approved_by            | UUID        | FK users, NULL                           |
| visible_to_client      | BOOLEAN     | DEFAULT FALSE                            |
| ai_model               | TEXT        | "claude-opus-4-7"                        |
| created_at             | TIMESTAMPTZ |                                          |

---

### `events`

אירועים בלוח זמנים (פגישות, deadlines).

| שדה                      | טיפוס       | הערות                                      |
| ------------------------ | ----------- | ------------------------------------------ |
| id                       | UUID        | PK                                         |
| tenant_id                | UUID        | FK                                         |
| title                    | TEXT        |                                            |
| description              | TEXT        |                                            |
| start_time               | TIMESTAMPTZ |                                            |
| end_time                 | TIMESTAMPTZ |                                            |
| timezone                 | TEXT        | DEFAULT 'Asia/Jerusalem'                   |
| location                 | TEXT        | NULL                                       |
| event_type               | ENUM        | 'meeting', 'deadline', 'reminder', 'block' |
| customer_id              | UUID        | NULL                                       |
| project_id               | UUID        | NULL                                       |
| google_calendar_event_id | TEXT        | NULL — לסנכרון                             |
| zoom_meeting_id          | TEXT        | NULL                                       |
| zoom_meeting_url         | TEXT        | NULL                                       |
| reminder_sent            | BOOLEAN     | DEFAULT FALSE                              |
| created_at               | TIMESTAMPTZ |                                            |

**Indexes**:

- `(tenant_id, start_time)`
- `(google_calendar_event_id)` unique partial

---

### `messages`

הודעות (WhatsApp, Email).

| שדה                 | טיפוס       | הערות                                |
| ------------------- | ----------- | ------------------------------------ |
| id                  | UUID        | PK                                   |
| tenant_id           | UUID        | FK                                   |
| customer_id         | UUID        | NULL                                 |
| lead_id             | UUID        | NULL                                 |
| channel             | ENUM        | 'whatsapp', 'email', 'sms', 'portal' |
| direction           | ENUM        | 'inbound', 'outbound'                |
| from_address        | TEXT        |                                      |
| to_address          | TEXT        |                                      |
| subject             | TEXT        | NULL (לאימייל)                       |
| content             | TEXT        |                                      |
| attachments         | JSONB       | NULL                                 |
| external_message_id | TEXT        | id ב-Green API / Gmail               |
| read_at             | TIMESTAMPTZ | NULL                                 |
| created_at          | TIMESTAMPTZ |                                      |

**Indexes**:

- `(customer_id, created_at DESC)`
- `(channel, direction, created_at DESC)`

---

### `external_agents`

רישום של agents חיצוניים שניתן להפעיל מהמערכת.

| שדה             | טיפוס       | הערות                                                    |
| --------------- | ----------- | -------------------------------------------------------- |
| id              | UUID        | PK                                                       |
| tenant_id       | UUID        | FK                                                       |
| name            | TEXT        | "מפיק הצעות מחיר מתמלול"                                 |
| description     | TEXT        |                                                          |
| icon            | TEXT        | "wand-2" (Lucide icon name)                              |
| webhook_url     | TEXT        | endpoint לקריאה                                          |
| trigger_context | TEXT[]      | ['transcript', 'customer', 'project'] — איפה להציג כפתור |
| input_template  | JSONB       | מבנה הנתונים שיישלחו                                     |
| output_handler  | ENUM        | 'inline', 'document', 'task', 'proposal'                 |
| auth_config     | JSONB       | NULL — credentials לwebhook                              |
| enabled         | BOOLEAN     | DEFAULT TRUE                                             |
| created_at      | TIMESTAMPTZ |                                                          |

---

### `agent_invocations`

לוג של הפעלות agents.

| שדה           | טיפוס       | הערות                          |
| ------------- | ----------- | ------------------------------ |
| id            | UUID        | PK                             |
| tenant_id     | UUID        | FK                             |
| agent_id      | UUID        | FK external_agents             |
| invoked_by    | UUID        | FK users                       |
| context_type  | TEXT        | 'transcript', וכו'             |
| context_id    | UUID        | id של ה-entity מהקונטקסט       |
| input_data    | JSONB       |                                |
| output_data   | JSONB       |                                |
| status        | ENUM        | 'pending', 'success', 'failed' |
| error_message | TEXT        | NULL                           |
| started_at    | TIMESTAMPTZ |                                |
| completed_at  | TIMESTAMPTZ | NULL                           |

---

### `notifications`

התרעות פנימיות.

| שדה        | טיפוס       | הערות                                       |
| ---------- | ----------- | ------------------------------------------- |
| id         | UUID        | PK                                          |
| tenant_id  | UUID        | FK                                          |
| user_id    | UUID        | FK users                                    |
| type       | TEXT        | 'lead_new', 'bank_low_pct', 'overage', וכו' |
| title      | TEXT        |                                             |
| body       | TEXT        |                                             |
| link       | TEXT        | URL פנימי לעבור אליו                        |
| icon       | TEXT        | Lucide icon                                 |
| severity   | ENUM        | 'info', 'warning', 'urgent'                 |
| read_at    | TIMESTAMPTZ | NULL                                        |
| context    | JSONB       | metadata                                    |
| created_at | TIMESTAMPTZ |                                             |

**Indexes**:

- `(user_id, read_at, created_at DESC)`
- TTL — מחיקה אוטומטית אחרי 90 יום

---

### `notification_preferences`

העדפות התרעה למשתמש.

| שדה               | טיפוס   | הערות                                   |
| ----------------- | ------- | --------------------------------------- |
| user_id           | UUID    | PK + FK                                 |
| notification_type | TEXT    | PK חלק שני                              |
| channels          | TEXT[]  | ['in_app', 'push', 'email', 'whatsapp'] |
| enabled           | BOOLEAN | DEFAULT TRUE                            |

---

### `reports`

דוחות (חודשיים, שנתיים).

| שדה               | טיפוס       | הערות                                                     |
| ----------------- | ----------- | --------------------------------------------------------- |
| id                | UUID        | PK                                                        |
| tenant_id         | UUID        | FK                                                        |
| customer_id       | UUID        | NULL — דוח עסקי פנימי                                     |
| report_type       | ENUM        | 'monthly', 'yearly', 'project', 'custom'                  |
| period_start      | DATE        |                                                           |
| period_end        | DATE        |                                                           |
| status            | ENUM        | 'draft', 'pending_review', 'approved', 'sent', 'archived' |
| content           | JSONB       | structured report data                                    |
| html_rendered     | TEXT        | NULL — pre-rendered for fast display                      |
| pdf_url           | TEXT        | NULL — Storage URL                                        |
| approved_by       | UUID        | FK users, NULL                                            |
| approved_at       | TIMESTAMPTZ | NULL                                                      |
| sent_to_client_at | TIMESTAMPTZ | NULL                                                      |
| created_at        | TIMESTAMPTZ |                                                           |

**Indexes**:

- `(customer_id, period_start DESC)`
- `(status)`

---

### `change_requests`

בקשות שינוי מלקוחות.

| שדה             | טיפוס         | הערות                                                                      |
| --------------- | ------------- | -------------------------------------------------------------------------- |
| id              | UUID          | PK                                                                         |
| tenant_id       | UUID          | FK                                                                         |
| project_id      | UUID          | FK projects                                                                |
| customer_id     | UUID          | FK customers                                                               |
| title           | TEXT          |                                                                            |
| description     | TEXT          |                                                                            |
| status          | ENUM          | 'submitted', 'in_review', 'estimated', 'approved', 'rejected', 'completed' |
| estimated_hours | DECIMAL(6,2)  | NULL                                                                       |
| estimated_cost  | DECIMAL(10,2) | NULL                                                                       |
| approved_at     | TIMESTAMPTZ   | NULL                                                                       |
| created_at      | TIMESTAMPTZ   |                                                                            |
| created_by      | UUID          | FK users                                                                   |

---

### `marketing_content`

לוח תוכן שיווקי.

| שדה           | טיפוס       | הערות                                                  |
| ------------- | ----------- | ------------------------------------------------------ |
| id            | UUID        | PK                                                     |
| tenant_id     | UUID        | FK                                                     |
| platform      | ENUM        | 'instagram', 'facebook', 'youtube', 'linkedin', 'blog' |
| format        | ENUM        | 'reel', 'post', 'story', 'video', 'article'            |
| status        | ENUM        | 'idea', 'draft', 'scheduled', 'published'              |
| title         | TEXT        |                                                        |
| content       | TEXT        |                                                        |
| scheduled_for | TIMESTAMPTZ | NULL                                                   |
| published_at  | TIMESTAMPTZ | NULL                                                   |
| utm_params    | JSONB       | NULL                                                   |
| performance   | JSONB       | NULL — impressions, clicks, וכו'                       |
| tags          | TEXT[]      |                                                        |
| created_at    | TIMESTAMPTZ |                                                        |

---

## Foreign Key Cascading

החלטות על מחיקה:

| FK                                   | ON DELETE                           |
| ------------------------------------ | ----------------------------------- |
| `customers.tenant_id`                | RESTRICT                            |
| `tasks.project_id`                   | CASCADE                             |
| `time_entries.task_id`               | SET NULL                            |
| `time_entries.consumed_from_bank_id` | RESTRICT (לא מוחקים בנק עם entries) |
| `invoices.customer_id`               | RESTRICT                            |
| `documents.project_id`               | SET NULL                            |
| `recordings.event_id`                | SET NULL                            |
| `transcripts.recording_id`           | CASCADE                             |

## RLS Helper Functions

```
-- מומלץ ליצור function helper שכל policies משתמשות בה
auth.tenant_id() → UUID  -- מחזיר tenant_id מ-JWT
auth.user_role() → TEXT  -- 'admin', 'team', 'client'
auth.customer_id() → UUID  -- אם role='client'
```

## Migration Strategy

1. כל שינוי schema = migration נפרד ב-`supabase/migrations/`
2. שמות migrations: `YYYYMMDDHHMMSS_description.sql`
3. אסור לערוך migration שכבר רץ ב-production — צור חדש שמתקן
4. כל migration צריך להיות reversible (down אם אפשר)
5. אחרי כל migration: `npx supabase gen types typescript --linked > lib/supabase/types.ts`

## בדיקות לאחר Migration

```
✅ הטבלה נוצרה
✅ RLS מופעל (`SELECT * FROM pg_tables` → `rowsecurity = true`)
✅ ה-policies מוגדרים
✅ Indexes נוצרו
✅ Types עודכנו
✅ ה-Schema visible ב-Supabase Dashboard
```
