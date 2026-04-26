import { Phone, Mail, Calendar, FileText, CheckSquare, type LucideIcon } from "lucide-react";

export type ActivityType = "call" | "email" | "meeting" | "note" | "task";

export const ACTIVITY_META: Record<
  ActivityType,
  { label: string; icon: LucideIcon; color: string }
> = {
  call: {
    label: "שיחה",
    icon: Phone,
    color: "bg-blue-50 text-blue-600 border-blue-200",
  },
  email: {
    label: "אימייל",
    icon: Mail,
    color: "bg-purple-50 text-purple-600 border-purple-200",
  },
  meeting: {
    label: "פגישה",
    icon: Calendar,
    color: "bg-orange-50 text-orange-600 border-orange-200",
  },
  note: {
    label: "הערה",
    icon: FileText,
    color: "bg-gray-50 text-gray-600 border-gray-200",
  },
  task: {
    label: "משימה",
    icon: CheckSquare,
    color: "bg-green-50 text-green-600 border-green-200",
  },
};

export const ACTIVITY_TYPES: ActivityType[] = ["call", "email", "meeting", "note", "task"];
