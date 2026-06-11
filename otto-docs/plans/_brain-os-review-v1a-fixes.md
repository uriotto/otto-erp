# Brain OS Review - v1a-fixes

**Reviewer:** סוכן Brain OS
**Commits:** `95e4038` (brain-os-runtime) + `18932fa` (OTTO API)
**ורדיקט:** ✅ אושר - אפשר להתחיל v1b. גילוי אחד קטן שלא חוסם.

---

## 3 חובה - כולם נסגרו נכון

### #1 timer overwrite (אובדן נתונים) ✅
[`otto-app/app/api/bot/timer/start/route.ts:31-60`](../../OTTO-erp-crm/otto-app/app/api/bot/timer/start/route.ts#L31) - קורא `active_timer`, יוצר time_entry דרך `createTimeEntryFromTimerForUser` (אותה פונקציה ש-stop משתמש בה - גם הלוגיקה משותפת), ואז עושה upsert. response כולל `stopped_previous`. אטומי-מספיק לרזולוציה שלנו (אין concurrent writes על אותו user_id).

### #2 דליפת שגיאות ✅
`bot_v2.py` - שני `except` הוחלפו ל-`log.exception()` + הודעה גנרית. אין יותר `{e}` בטלגרם.

### #3 continuation window ✅
`_ends_with_question` מתעלם מ-whitespace, בודק `?` ASCII או `؟`. `expects_answer` נשמר ב-pending state. אם Claude לא שואל - history לא מועבר → הדיספצ'ר מקבל הקשר חדש → fallback ל-note אם זה פתק. עובד בדיוק כמו שצריך.

## 2 מומלצים - שניהם נסגרו

### #4 Anthropic timeout ✅
30 שניות. מתועד בקבוע נפרד `ANTHROPIC_TIMEOUT_SEC`.

### #5 הסרת OTTO_TRIGGER_PATTERN ✅
Regex נמחק, import של `re` נוקה. כל טקסט חופשי הולך ל-dispatcher. ה-fallback ל-write_note שכבר קיים ב-`bot_v2.py` (תנאי `not tools_called and not reply`) מטפל בפתקים. הארכיטקטורה הרבה יותר נקייה - אורי לא צריך לזכור מילות מפתח, וה-system prompt של Claude כבר אומר לו "אם זה פתק - אל תקרא לכלים, אל תענה".

## בונוסים שנעשו ולא ביקשתי

- typing indicator בכל קריאה לדיספצ'ר. תיקון UX הגון.
- ניקוי imports (`asyncio`, `re`).
- commit message מסודר עם references למספרי ה-issues.

---

## 🟡 גילוי חדש (לא חוסם, אבל שווה לסגור ב-v1b)

### `stopped_previous` לא מופיע למשתמש

[`scripts/tools.py:59`](../../.local/share/brain-os/scripts/tools.py#L59) מחזיר:

```python
return f"הטיימר הופעל. start_time={result.get('started_at')}"
```

אבל ה-API עכשיו מחזיר `stopped_previous: {entry_id, duration_minutes}` כשהיה טיימר קודם. ה-bot מתעלם מזה. תרחיש:

- אורי רץ טיימר על אסתר 45 דקות.
- שולח "התחל טיימר ללב וחסד".
- ה-API עוצר את אסתר, יוצר time_entry של 45 דקות, מתחיל לב וחסד.
- Claude מקבל back "הטיימר הופעל. start_time=...".
- Claude עונה: "התחלתי טיימר ללב וחסד".

אורי לא יודע שהסשן של אסתר נשמר. הוא אולי חושב שהוא איבד אותו, או לא מודע שהסשן נסגר.

**תיקון פשוט (תוסיף ל-v1b):**

```python
if name == "start_timer":
    result = await otto.start_timer(customer_id, notes)
    msg = f"הטיימר הופעל. start_time={result.get('started_at')}"
    prev = result.get("stopped_previous")
    if prev:
        msg += f" (קודם נסגר טיימר של {prev['duration_minutes']} דק׳ והופך לרשומת זמן {prev['entry_id']})"
    return msg
```

Claude יקבל את המידע ויידע להגיד לאורי "התחלתי טיימר ללב וחסד. הסשן הקודם של אסתר נסגר ונשמר כ-45 דקות".

זה לא תיקון חוסם כי הנתונים לא הולכים לאיבוד יותר - רק שקיפות מול המשתמש. שווה לסגור עם תיקוני v1b.

### #9 customers cache soft fallback - הושאר ל-v1b כמתועד ✓

---

## אישור

**תוכל להתחיל v1b.**

תזכורת קצרה ל-v1b scope (לפי [serene-finding-pinwheel.md](../../../.claude/plans/serene-finding-pinwheel.md#L115)):

- Whisper API + cap 1000 דק׳/חודש (`whisper-usage.json`)
- 4 read endpoints חדשים ב-OTTO: time-entries, invoices, notifications, events
- `voice.py` חדש לבוט
- 6 tools חדשים: stop_timer (כבר קיים!), log_time, query_time_entries, list_invoices, list_notifications, list_events
- multi-turn dispatcher (כבר קיים בפועל!)
- customer cache soft fallback (issue #9)
- surface `stopped_previous` (גילוי חדש)

שים לב ש-stop_timer + multi-turn כבר נכנסו ב-v1a בפועל, אז v1b בעיקר voice + read endpoints + tools.
