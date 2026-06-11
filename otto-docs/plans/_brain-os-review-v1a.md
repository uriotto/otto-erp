# Brain OS Review - v1a

**Reviewer:** סוכן Brain OS (Claude Opus 4.7)
**Commit:** `b4a980e` ב-`brain-os-runtime`
**תאריך:** 2026-05-13
**ורדיקט:** ✅ עובר עם 3 תיקונים נדרשים לפני v1b (אחד קריטי)

---

## TL;DR

הקוד תואם את הספציפיקציה ברובו. git logic נשמר זהה לחלוטין. retry logic מועתק נכון. 8 ה-slash commands שלמים. אבל יש **נושא קריטי אחד** של אובדן נתונים פוטנציאלי שיורש מ-API של OTTO ו-2 בעיות UX/בטיחות שצריך לסגור לפני v1b.

חרגתם מ-scope של v1a (הוספתם stop_timer + multi-turn) - לא בעיה כשלעצמה כי הקוד טוב, רק לציין שזה רובד של v1b שכבר ירד.

---

## 🔴 בעיות שחייבות להיסגר לפני v1b

### 1. אובדן נתונים: timer overwrite שקט

**מיקום:** [otto-app/app/api/bot/timer/start/route.ts:30](../../../OTTO-erp-crm/otto-app/app/api/bot/timer/start/route.ts#L30) + [scripts/tools.py:24](../../.local/share/brain-os/scripts/tools.py#L24)

`start_timer` עושה `upsert` עם `onConflict: "user_id"`. אם רץ טיימר על לקוח א׳ ואומרים "התחל טיימר לאסתר" - **השורה נדרסת בלי ליצור time_entry. הסשן הקודם נמחק לחלוטין.**

ה-description ב-tools.py אפילו מתעד את זה: "אם יש טיימר רץ הוא יוחלף". זה לא "יוחלף" - זה "יימחק".

**תיקון:**
- אופציה א׳ (מומלצת): ב-otto_client.start_timer - לפני שליחה, לעשות `GET /active_timer`. אם יש - לעצור אותו (stop_timer יוצר entry) ואז להתחיל חדש. שלב הביניים שקוף למשתמש.
- אופציה ב׳: ה-API של OTTO עצמו צריך לעשות את ה-stop-first-then-start אטומית. עדיף ארכיטקטונית - הלוגיקה במקום אחד.
- אופציה ג׳: לדרוש אישור מהמשתמש דרך multi-turn ("יש טיימר רץ על X. לעצור אותו ולפתוח חדש?").

זה לא bug של v1a - זה bug שהיה ב-v1 (OTTO Timer API). אבל הבוט הוא הצרכן הראשון שיגרום לו לקרות בפועל, ובלי UI לראות שטיימר רץ. **חייב להיפתר לפני שיוצא לפרודקשן.**

---

### 2. דליפת שגיאות raw למשתמש

**מיקום:** [scripts/bot_v2.py:266](../../.local/share/brain-os/scripts/bot_v2.py#L266) + [scripts/bot_v2.py:257](../../.local/share/brain-os/scripts/bot_v2.py#L257)

```python
await update.message.reply_text(f"⚠️ שגיאה: {e}")
```

`{e}` יכול להכיל URL מלא של API (אולי גם param בשורת query), traceback, או שמות פנימיים. אם token של OTTO יופיע בפלט (לא נראה כרגע ב-httpx defaults, אבל אפשרי) - זה עף לטלגרם.

**תיקון:**
- ללכוד `Exception` עם `log.exception(...)` (כבר עושה).
- להחזיר למשתמש הודעה גנרית: `"⚠️ שגיאה בלתי צפויה. תבדוק את הלוג."`
- אופציה: לשמור שגיאה אחרונה לקובץ ב-`/tmp` שאפשר לקרוא דרך `/error` command.

---

### 3. continuation window בולע notes

**מיקום:** [scripts/bot_v2.py:236-248](../../.local/share/brain-os/scripts/bot_v2.py#L236-L248)

הלוגיקה: אם dispatcher שאל שאלת המשך → 120 שניות הבא **כל** הודעה נשלחת ל-dispatcher.

תרחיש שבר: Claude שואל "לאיזה לקוח?". במקום לענות, אורי קופץ למשהו אחר ושולח "תזכיר לי להתקשר לאמא". זה לא יישמר ב-vault - יילך ל-dispatcher, Claude יתבלבל ויחזיר שגיאה או יקרא tool לא נכון.

**תיקון:**
- לבדוק אם ההודעה הקודמת של הבוט הסתיימה ב-`?` (Claude שאל שאלה). אחרת לא להפעיל continuation.
- בנוסף: אם dispatcher מחזיר tools_called ריק AND reply ריק AND אין trigger words AND אין `?` במשפט האחרון של ה-assistant - לעבור ל-write_note.
- שיפור עדין: לשים ב-`pending_dispatcher` גם flag `expects_answer: True` שמסומן רק כש-Claude שאל שאלה.

---

## 🟡 שווה לתקן, לא חוסם

### 4. אין timeout על Claude API call

`anthropic.AsyncAnthropic` ברירת מחדל = 600s. אם Anthropic תקוע - אורי מחכה 10 דקות מול שום דבר.

**תיקון:** `anthropic.AsyncAnthropic(api_key=..., timeout=30.0)` או per-call `timeout=30`.

### 5. אין typing indicator במהלך tool-calling

קריאה עם 2 tools = 5-10 שניות. הבוט שותק. UX זול.

**תיקון:** `await update.message.chat.send_action("typing")` לפני הקריאה ל-`handle_message`. אופציונלית - לפני כל turn ב-loop.

### 6. heuristic של OTTO_TRIGGER_PATTERN צר מדי

תרחישים שלא נתפסים ויפלו ל-note שגוי:
- "אני עכשיו עובד על אסתר"
- "תפתח לי טיימר לחילית" (תפתח לא במילון)
- "סיימתי עם רוני" (סיימתי לא במילון)

**אופציה א׳:** להרחיב את ה-regex (לעבוד/עובד, תפתח, סיימ, נגמר, עוצר, גמרתי).
**אופציה ב׳ (אדיומטית):** **לבטל את ה-heuristic לחלוטין.** לשלוח **כל** טקסט ל-dispatcher. ה-system prompt כבר מורה לClaude "אם הוא רק כותב פתק או הערה כללית - אל תקרא לכלים, פשוט תאשר." אז אם dispatcher לא קורא tool ומחזיר תשובה ריקה/כללית → נופלים ל-write_note. **זה כבר קיים ב-bot_v2.py:269-271** - רק צריך להוריד את ה-heuristic בכניסה.

יתרון: אורי לא צריך לזכור מילות מפתח. חסרון: עלות API גם על הודעות-פתק (~$0.001 לכל הודעה, כ-$1/חודש לכל היותר). שווה את זה.

**ההמלצה:** אופציה ב׳. זה גם מסיר את הקפיצה ב-state עם continuation window.

### 7. trigger pattern יכול לתפוס שלילה

"לא רוצה טיימר" → מכיל "טיימר" → dispatcher יקבל. Claude יבין שזה לא בקשה, אבל בזבזנו קריאה. (Sniped by issue #6's fix.)

### 8. tools.py: stop_timer לפני start_timer

קוסמטי. מסדר הצגה ראוי start ואז stop. גם תיעוד `description` של start_timer מזכיר "יוחלף" - אחרי תיקון של issue #1 ה-description צריך לעדכן (לציין שטיימר רץ ייסגר אוטומטית).

### 9. customers cache - אין הגנה על מצב שגיאה

אם OTTO נופל במהלך `list_customers()` - הקריאה נכשלת, אורי מקבל "⚠️ לא הצלחתי להביא רשימת לקוחות". אבל הcache הקודם עדיין בזיכרון. ב-cold start אחרי restart - אין נפילה רכה.

**תיקון:** ב-`get_customers`, אם הקריאה החדשה נכשלת AND יש cache (גם אם תפוג) - להחזיר את ה-cache הישן עם warning בלוג. fallback רך.

---

## 🟢 מה שטוב - תיעוד לעתיד

1. **git logic זהה לחלוטין** ל-v1 (bot.py:143-186 ↔ bot_v2.py:171-218). המעבר מסוכן עוקף.
2. **retry logic** ב-dispatcher.py:37-61 - נכון, מטפל ב-429/5xx/529/connection/timeout עם exponential backoff (3s → 6s → 12s → 24s → 48s = עד דקה וחצי). זה בדיוק הדפוס מ-`_claude-call.sh`.
3. **AUTHORIZED_CHAT_ID** מבוקר בכל handler ופלת.
4. **service unit** `ExecStart` עודכן ל-bot_v2.py. rollback = שורה אחת חזרה.
5. **OTTO API contract match** מאומת לפי הקבצים:
   - `customers` → `{customers: [{id,name}]}` ✓
   - `timer/start` body `{customer_id, source, notes?}` ✓
   - `timer/start` response `{started, started_at}` ✓
   - `timer/stop` response `{stopped, entry_id, duration_minutes}` ✓
6. **SYSTEM_PROMPT** קצר, ממוקד, עברית, מורה ל-clarification.
7. **customers cache עם TTL** - תכנון נכון, חוסך 90% מהקריאות.

---

## הערות על scope ויחסי עבודה

הספציפיקציה ל-v1a אמרה: **רק `start_timer`**. בפועל:
- ✅ `start_timer` (כצפוי)
- ➕ `stop_timer` (תוכנן ל-v1b)
- ➕ multi-turn continuation (תוכנן ל-v1b)

**זה לא הופך את הקוד לרע** - הוא יציב והלוגיקה נכונה. אבל זה שובר את העיקרון של checkpoints קטנים. אם ה-multi-turn היה מתפוצץ באמצע, היה קשה יותר לבודד את הסיבה.

**להבא:** אם סוכן OTTO רואה הזדמנות לאזן scope - לציין במפורש בקומיט. אני יכול לאשר בזמן אמת.

---

## משימות לפני v1b

חובה:
- [ ] תיקון issue #1 (timer overwrite) - או ב-OTTO API או ב-otto_client.py
- [ ] תיקון issue #2 (דליפת error)
- [ ] תיקון issue #3 (continuation בולע notes)

מומלץ:
- [ ] תיקון issue #4 (timeout ל-Anthropic)
- [ ] החלפת issue #6 ל-אופציה ב׳ (להסיר את ה-heuristic, לסמוך על Claude)

אחרי שזה ייסגר - אפשר להמשיך ל-v1b (voice + read endpoints).
