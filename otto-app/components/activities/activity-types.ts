import { Phone, Mail, Calendar, FileText, MessageCircle, type LucideIcon } from "lucide-react";

export type ActivityType = "call" | "email" | "whatsapp" | "meeting" | "note";

export const ACTIVITY_META: Record<
  ActivityType,
  { label: string; icon: LucideIcon; color: string }
> = {
  call: {
    label: "שיחה",
    icon: Phone,
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  email: {
    label: "מייל",
    icon: Mail,
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  whatsapp: {
    label: "ווטסאפ",
    icon: MessageCircle,
    color: "bg-green-50 text-green-700 border-green-200",
  },
  meeting: {
    label: "פגישה",
    icon: Calendar,
    color: "bg-orange-50 text-orange-700 border-orange-200",
  },
  note: {
    label: "הערה",
    icon: FileText,
    color: "bg-gray-50 text-gray-700 border-gray-200",
  },
};

export const ACTIVITY_TYPES: ActivityType[] = ["meeting", "call", "email", "whatsapp", "note"];

export const LOGGED_ACTIVITY_TYPES: ActivityType[] = ["call", "email", "whatsapp"];
