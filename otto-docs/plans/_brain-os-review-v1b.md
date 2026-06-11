# Brain OS Review - v1b

**Reviewer:** סוכן Brain OS
**Commits:** `eeab2b8` (OTTO API) + `04c6958` (brain-os-runtime)
**ורדיקט:** ✅ אושר - אפשר להמשיך ל-v1c. 3 הערות 🟡 (אף אחת לא חוסם).

---

## Scope - תואם בדיוק את הספציפיקציה

| נדרש | בוצע |
| --- | --- |
| 4 GET endpoints (time-entries, invoices, notifications, events) | ✅ כולם דרך `authenticateBot()` + service client + filter על `tenantId` |
| user-scoping של time-entries + notifications | ✅ עם `user_id` filter |
| caps על תוצאות (50-200) | ✅ |
| Whisper API + cap 1000 דק׳/חודש | ✅ דרך `whisper-usage.json` chmod 600 |
| ffprobe לפני קריאה ל-API (כדי שחריגה תהיה חינם) | ✅ - **תיקון מעולה**, חוסך כסף על חריגות |
| 5 OTTO client methods + 5 tools | ✅ |
| voice handler ב-bot.py | ✅ עם `🎙️` echo |
| dispatcher time injection (Asia/Jerusalem) | ✅ |
| `stopped_previous` ב-execute_tool | ✅ |
| customers cache soft fallback | ✅ |

**Contract match** מאומת מול הקבצים:
- `/time-entries` → `{time_entries, total_minutes, count}` ✓
- `/invoices` → `{invoices, count}` ✓
- `/notifications` → `{notifications, count}` ✓
- `/events` → `{events, count}` ✓
- `/time-entry POST` → `{created, entry_id, duration_minutes}` ✓

---

## 🟢 דברים שטובים במיוחד

1. **ffprobe לפני Whisper** - חוסך כסף על quota miss. רוב המימושים אומרים "נשלם על הקריאה ונחזור עם quota error" - כאן ברירת מחדל היא חינם.
2. **Echo של התמלול ב-🎙️** לפני dispatch - מאפשר לאורי לראות שהוא נשמע נכון לפני שClaude מבצע פעולה. אנושי-נכון.
3. **_json_brief** עם truncation - מונע מהקלט של Claude להתפוצץ אם time-entries מחזיר 200 שורות.
4. **process_user_text** משותף ל-text ול-voice - DRY נכון. אותו continuation logic.
5. **dispatcher time injection** - שורה אחת שמאפשרת ל-Claude לפענח "השבוע", "אתמול" בלי תלות במה ש-Claude יודע על התאריך.
6. **soft fallback ל-customers** ([bot_v2.py:166-173](../../.local/share/brain-os/scripts/bot_v2.py#L166)) - returns stale cache + warning. בדיוק כפי שביקשתי.

---

## 🟡 הערות (לא חוסמות, שווה לסגור ב-v1c)

### #1 invoices + events לא מסוננים לפי user_id

[`/api/bot/invoices`](../../OTTO-erp-crm/otto-app/app/api/bot/invoices/route.ts) ו-[`/api/bot/events`](../../OTTO-erp-crm/otto-app/app/api/bot/events/route.ts) מסננים רק `tenant_id`, לא `user_id`. הלוגיקה: חשבוניות ואירועים הם משאבים tenant-shared.

זה תקין כל עוד אורי הוא המשתמש היחיד. אם token של הבוט ידלף - הוא נותן גישה לכל החשבוניות והאירועים של ה-tenant. בהשוואה ל-time-entries ו-notifications שכן מסוננים לפי user_id - לא עקבי.

**תיקון אופציונלי:** להוסיף `created_by = userId` filter על invoices ו-`owner_id = userId` או `attendees @> [userId]` על events. תלוי בסכימה. שווה לוודא ב-v1c.

### #2 race condition תיאורטי ב-Whisper cap

[`voice.py:96-102`](../../.local/share/brain-os/scripts/voice.py#L96) - read usage → check → call API → write usage. אם שתי הודעות קוליות מגיעות בו-זמנית (TOCTOU), שתיהן עוברות את הבדיקה ושתיהן חורגות.

בפועל לאורי שמשתמש סדרתית - לא יקרה. מסמן רק כי זה patten שבמערכת multi-user יהיה בעיה. **לא צריך לתקן**, פשוט מתועד.

### #3 voice → empty transcript → אורי איבד את ההכוונה שלו

[`bot_v2.py:336-338`](../../.local/share/brain-os/scripts/bot_v2.py#L336) - אם Whisper מחזיר transcript ריק, הבוט עונה "⚠️ לא הצלחתי להבין". אבל אורי עכשיו דיבר 30 שניות ואין לו דרך לשחזר את הכוונה שלו. שווה לשמור את האודיו לתיקייה מקומית (`/home/uri/brain-os/audio-failed/`) כדי שאורי יוכל לחזור ולהקשיב אם תמלול נכשל.

**תיקון אופציונלי ל-v1c** (לא חוסם).

---

## אישור

**תוכל להתחיל v1c.**

תזכורת ל-v1c scope (לפי [serene-finding-pinwheel.md:142-150](../../../.claude/plans/serene-finding-pinwheel.md#L142)):

- `vault_client.py` - ripgrep search על `/home/uri/brain-os/vault/` + `read_file` + `write_note`
- 2 tools חדשים: `search_vault(query, scope?)` + `write_note(text)`
- העברת write_note הקיים מ-bot_v2.py ל-vault_client.py + tools (ה-fallback no-tool-call עדיין משתמש באותה לוגיקה - **חשוב לשמור על זה**)
- system prompt: "אם שאלה נוגעת לסיכומים, היסטוריה, או 'מה אמרתי/עשיתי' - שקול לקרוא גם search_vault וגם query_time_entries."

**Acceptance:** "מה עשיתי היום עם אסתר" → 2 tools נקראו (`query_time_entries` + `search_vault`) → תשובה מאוחדת ✓

**Commit prefix:** `[brain-os-review] v1c:`

אם אתה רוצה לסגור גם את 3 ההערות 🟡 לפני v1c (במיוחד #1 invoices/events user-scope), שווה. אם לא - אוסיף אותן ל-backlog של v2.
