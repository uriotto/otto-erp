# Brain OS Review - v1c

**Reviewer:** סוכן Brain OS
**Commit:** `b31926b` (brain-os-runtime)
**ורדיקט:** ✅ אושר. v1 הושלם. 2 הערות 🟡 קטנות לתיקון בהמשך.

---

## Scope - תואם בדיוק

| נדרש | בוצע |
| --- | --- |
| `vault_client.py` עם search/write | ✅ |
| ripgrep search + scope filter | ✅ עם 9 scopes ממופים |
| write_note מוגבל ל-`10_Daily/notes/` | ✅ |
| git pull → append → commit → push char-by-char כמו v1 | ✅ מאומת בדיפ |
| 2 tools חדשים ב-Claude (search_vault, write_note) | ✅ |
| העברת לוגיקת write_note מ-bot_v2 → vault_client | ✅ |
| ניקוי imports לא בשימוש | ✅ (VAULT_DIR, datetime, ZoneInfo) |
| fallback no-tool-no-reply נשמר כ-defense-in-depth | ✅ |
| system prompt על שילוב query_time_entries + search_vault | ✅ |
| system prompt דורש write_note (לא לשתוק על פתק) | ✅ |

**WriteResult dataclass** - מהלך טוב. ה-caller (bot_v2.py + tools.py) מקבל git_synced flag במקום לנחש. ניקוי.

---

## 🟢 נקודות חזקות

1. **bot_v2.py דק יותר** - 57 שורות הוצאו, write_note הפך wrapper של 6 שורות. ניקוי ארכיטקטוני.
2. **scope mapping מבוקר** - לא מאפשרת path traversal. `../etc` → לא ב-dict → falls back ל-VAULT_DIR.
3. **git logic מאומת char-by-char** מול bot.py המקורי. אין regression.
4. **write_note בתור tool first-class** - לא רק fallback. Claude יכול לקרוא לו במכוון. ה-fallback נשאר כ-safety net.
5. **system prompt קצר וברור** - הוראה ספציפית "אל תיענה בלי כלי - הפתק חייב להישמר". ה-fallback בכל מקרה תופס, אבל זה מורה ל-Claude לעשות זאת ביוזמתו.

---

## 🟡 הערות לתיקון (לא חוסם)

### #1 ripgrep רץ ב-regex mode (אין `-F`)

[`vault_client.py:67-75`](../../.local/share/brain-os/scripts/vault_client.py#L67) - `rg` ללא `--fixed-strings`. Claude יכול לשלוח query כמו `"אסתר?"` או `"C++"` ו-ripgrep יפרש את `?` או `+` כ-regex. תוצאות: מצלם מטה או נופל ב-regex parsing error.

**תיקון:**
```python
"rg", "--fixed-strings", "--no-heading", ...
```

או, אם רוצים גמישות regex כשClaude יודע מה הוא עושה - להוסיף flag אופציונלי ב-tool schema. אבל ברירת המחדל צריכה להיות `-F`.

### #2 `-C 2` context lines מסוננים שקטית

[`vault_client.py:71`](../../.local/share/brain-os/scripts/vault_client.py#L71) - `-C 2` מבקש 2 שורות context לפני ואחרי כל hit. ripgrep מפיק אותן בפורמט `path-line_no-content` (עם `-` במקום `:`).

הפרסר ב-[`vault_client.py:92-99`](../../.local/share/brain-os/scripts/vault_client.py#L92) עושה `split(":", 2)`. context lines אין להן `:` כמפריד → `len(parts) < 3` → דולגים עליהן. **כלומר ה-`-C 2` היום פס נטו לפח.** עובד, אבל לא מנצל את ה-context שביקשו.

**תיקון 2 אופציות:**
- א׳ (הכי פשוט): להוריד `-C 2`. החיפוש יחזיר רק שורות hit. פחות הקשר ל-Claude, אבל ברור.
- ב׳: לעבד גם שורות `-` ולצרף אותן ל-hit הסמוך. מורכב יותר.

**ההמלצה:** א׳. 2 שורות context בעברית לרוב לא קריטיות, ו-Claude יכול לבקש `read_file` אם רוצה (בעתיד).

---

## 🟢 הערה אינפורמטיבית (לא דורש פעולה)

### write_note(text=...) - Claude עלול לפרפרז

ה-tool description אומר "תוכן ההערה לשמירה (כפי שאורי כתב, ללא עיבוד)" - אבל זה הוראה ל-Claude, לא enforce. Claude עלול לשלוח `text="להתקשר לדני"` כשאורי כתב "תזכיר לי להתקשר לדני". פחות מילים = פחות הקשר.

ה-fallback (no-tool-no-reply) משתמש ב-`text` המקורי מהמשתמש. אז אם Claude כן קורא write_note אבל מפרפרז - אורי מאבד את הניסוח המקורי.

**לא דורש תיקון עכשיו** - רק להיות מודע. אם זה יתחיל לקרות, אפשר:
- להחמיר את ה-tool description ("העתק מילה במילה")
- או לעקוף: ב-execute_tool של write_note - להתעלם מ-Claude's text ולהשתמש ב-`user_text` המקורי (אבל זה דורש להעביר אותו ל-execute_tool).

---

## אישור

✅ **v1 הושלם.**

הכל חי ופרוס:
- `brain-os-runtime` ב-VPS, systemd active
- 7 tools פעילים (start_timer, stop_timer, log_time, query_time_entries, list_invoices, list_notifications, list_events, search_vault, write_note)
- voice messages עם cap
- 8 slash commands ישנות נשמרו

**Backlog ל-v2** (לעת עתה, לא דחוף):
- invoices/events user-scope (v1b #1)
- Whisper TOCTOU (v1b #2)
- audio fallback בכשל תמלול (v1b #3)
- ripgrep `-F` (v1c #1)
- `-C 2` context handling (v1c #2)
- write_note - paraphrase guard (v1c info)
- `read_file` tool (להבא, להעמקה כש-search_vault מחזיר hit מעניין)
- proactive push (התראות יזומות שמכבדות sacred-hours-guard)
