"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, Square, RotateCcw, Save, ChevronRight, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createRecording } from "../actions";
import { useToast } from "@/components/ui/toast";

interface Customer {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
  customer_id: string | null;
}

interface Props {
  customers: Customer[];
  projects: Project[];
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0)
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function todayTitle(): string {
  return `הקלטה מ-${new Date().toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" })}`;
}

export function RecorderClient({ customers, projects }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const [customerId, setCustomerId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState(todayTitle);

  const [state, setState] = useState<"idle" | "recording" | "preview">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [micBlocked, setMicBlocked] = useState(false);

  // Check permission status on mount
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions) return;
    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((result) => {
        if (result.state === "denied") setMicBlocked(true);
        result.onchange = () => setMicBlocked(result.state === "denied");
      })
      .catch(() => {
        /* browser doesn't support permissions API */
      });
  }, []);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Filter projects by selected customer
  const filteredProjects = customerId
    ? projects.filter((p) => p.customer_id === customerId)
    : projects;

  // Reset project if not in filtered list
  useEffect(() => {
    if (projectId && customerId) {
      const exists = filteredProjects.some((p) => p.id === projectId);
      if (!exists) setProjectId("");
    }
  }, [customerId, filteredProjects, projectId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/ogg")
          ? "audio/ogg"
          : "";

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const recorded = new Blob(chunksRef.current, {
          type: mimeType || "audio/webm",
        });
        setBlob(recorded);
        const url = URL.createObjectURL(recorded);
        setAudioUrl(url);
        setState("preview");
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      };

      recorder.start(1000);
      startTimeRef.current = Date.now();
      setElapsed(0);
      setState("recording");

      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 500);
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        if (navigator.permissions) {
          navigator.permissions
            .query({ name: "microphone" as PermissionName })
            .then((result) => {
              if (result.state === "denied") {
                setMicBlocked(true);
                setError(null);
              } else {
                setError(
                  "לא אושרה גישה למיקרופון. לחץ 'התחל הקלטה' שוב ואשר את הגישה בחלון שיפתח.",
                );
              }
            })
            .catch(() => {
              setError("לא אושרה גישה למיקרופון. אנא אשר גישה כשהדפדפן שואל.");
            });
        } else {
          setError("לא אושרה גישה למיקרופון. אנא אשר גישה כשהדפדפן שואל.");
        }
      } else if (err instanceof DOMException && err.name === "NotFoundError") {
        setError("לא נמצא מיקרופון במכשיר זה.");
      } else {
        setError("שגיאה בהפעלת המיקרופון. נסה שוב.");
      }
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const resetRecording = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setBlob(null);
    setElapsed(0);
    setState("idle");
    setError(null);
  }, [audioUrl]);

  const saveRecording = useCallback(() => {
    if (!blob) return;

    startTransition(async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          toast.show("לא מחובר", "error");
          return;
        }

        const { data: profile } = await supabase
          .from("users")
          .select("tenant_id")
          .eq("id", user.id)
          .single();

        if (!profile) {
          toast.show("שגיאה בטעינת פרופיל", "error");
          return;
        }

        const fileExt = blob.type.includes("ogg") ? "ogg" : "webm";
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const storagePath = `${profile.tenant_id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("recordings")
          .upload(storagePath, blob, { contentType: blob.type });

        if (uploadError) {
          toast.show(`שגיאה בהעלאה: ${uploadError.message}`, "error");
          return;
        }

        const result = await createRecording({
          title: title || todayTitle(),
          customer_id: customerId || null,
          project_id: projectId || null,
          storage_path: storagePath,
          duration_seconds: elapsed,
          file_size: blob.size,
        });

        if (!result.ok) {
          toast.show(result.error, "error");
          return;
        }

        toast.show("ההקלטה נשמרה בהצלחה", "success");
        router.push("/recordings");
      } catch (err) {
        toast.show("שגיאה לא צפויה בשמירת ההקלטה", "error");
      }
    });
  }, [blob, title, customerId, projectId, elapsed, router, toast]);

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center gap-2">
        <button
          onClick={() => router.push("/recordings")}
          className="text-ink-faded hover:text-navy flex items-center gap-1 text-sm transition-colors"
        >
          <ChevronRight size={16} className="rtl:rotate-0" />
          הקלטות
        </button>
        <span className="text-ink-faded text-sm">/</span>
        <span className="text-navy text-sm font-medium">הקלטה חדשה</span>
      </div>

      <div className="mx-auto max-w-lg">
        {/* Fields */}
        <div className="border-ink-line bg-cream-paper mb-6 space-y-4 rounded-xl border p-5">
          <div>
            <label className="text-navy mb-1 block text-sm font-medium">כותרת</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border-ink-line bg-cream-paper text-navy placeholder:text-ink-faded focus:border-navy w-full rounded-lg border px-3 py-2 text-sm transition-colors outline-none"
              placeholder="שם ההקלטה"
            />
          </div>

          <div>
            <label className="text-navy mb-1 block text-sm font-medium">לקוח (אופציונלי)</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="border-ink-line bg-cream-paper text-navy focus:border-navy w-full rounded-lg border px-3 py-2 text-sm transition-colors outline-none"
            >
              <option value="">— ללא לקוח —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-navy mb-1 block text-sm font-medium">פרויקט (אופציונלי)</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="border-ink-line bg-cream-paper text-navy focus:border-navy w-full rounded-lg border px-3 py-2 text-sm transition-colors outline-none disabled:opacity-50"
            >
              <option value="">— ללא פרויקט —</option>
              {filteredProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Recorder */}
        <div className="border-ink-line bg-cream-paper rounded-xl border p-6 text-center">
          {state === "idle" && (
            <>
              <div
                className={`mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full ${micBlocked ? "bg-red-500/10" : "bg-navy/8"}`}
              >
                {micBlocked ? (
                  <MicOff size={32} className="text-red-500" />
                ) : (
                  <Mic size={32} className="text-navy opacity-60" />
                )}
              </div>
              {micBlocked ? (
                <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-start text-sm text-red-700">
                  <p className="mb-2 font-semibold">גישה למיקרופון נחסמה</p>
                  {/iPhone|iPad|iPod/.test(
                    typeof navigator !== "undefined" ? navigator.userAgent : "",
                  ) ? (
                    <p>
                      עבור להגדרות הטלפון ← פרטיות ואבטחה ← מיקרופון ← אפשר לדפדפן, ואז חזור לכאן.
                    </p>
                  ) : /Android/.test(
                      typeof navigator !== "undefined" ? navigator.userAgent : "",
                    ) ? (
                    <p>
                      עבור להגדרות הטלפון ← אפליקציות ← דפדפן ← הרשאות ← מיקרופון ← אפשר, ואז חזור
                      לכאן.
                    </p>
                  ) : (
                    <ol className="list-decimal space-y-1 ps-4">
                      <li>לחץ על האייקון משמאל לכתובת האתר (מנעול, עיגול-i, או אייקון כוונון)</li>
                      <li>
                        בחר <strong>הגדרות אתר</strong> / <strong>Site settings</strong>
                      </li>
                      <li>
                        מיקרופון ← שנה ל-<strong>אפשר</strong>
                      </li>
                      <li>רענן את הדף</li>
                    </ol>
                  )}
                </div>
              ) : error ? (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}
              <button
                onClick={() => {
                  setMicBlocked(false);
                  setError(null);
                  startRecording();
                }}
                className="bg-navy text-cream-paper hover:bg-navy/90 inline-flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-semibold transition-colors"
              >
                <Mic size={18} />
                {micBlocked ? "נסה שוב" : "התחל הקלטה"}
              </button>
              {!micBlocked && <p className="text-ink-faded mt-3 text-xs">תידרש הרשאה למיקרופון</p>}
            </>
          )}

          {state === "recording" && (
            <>
              <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full">
                <span className="absolute inset-0 animate-ping rounded-full bg-red-500/20" />
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
                  <Mic size={32} className="text-red-500" />
                </div>
              </div>
              <div className="mb-5 flex items-center justify-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                <span className="text-ink-soft text-sm">מקליט</span>
              </div>
              <div className="text-navy mb-6 text-4xl font-bold tabular-nums" dir="ltr">
                {formatTime(elapsed)}
              </div>
              <button
                onClick={stopRecording}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-red-400 bg-red-50 px-8 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100"
              >
                <Square size={18} />
                עצור
              </button>
            </>
          )}

          {state === "preview" && blob && (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                <Clock size={28} className="text-green-600" />
              </div>
              <p className="text-navy mb-1 text-sm font-semibold">ההקלטה הסתיימה</p>
              <p className="text-ink-faded mb-4 text-xs" dir="ltr">
                {formatTime(elapsed)}
              </p>

              {audioUrl && (
                <audio
                  src={audioUrl}
                  controls
                  preload="auto"
                  className="mx-auto mb-5 w-full max-w-xs"
                />
              )}

              <div className="flex justify-center gap-3">
                <button
                  onClick={resetRecording}
                  className="border-ink-line text-ink-soft hover:text-navy flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
                >
                  <RotateCcw size={15} />
                  הקלט מחדש
                </button>
                <button
                  onClick={saveRecording}
                  disabled={isPending}
                  className="bg-navy text-cream-paper hover:bg-navy/90 flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  <Save size={15} />
                  {isPending ? "שומר..." : "שמור"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
