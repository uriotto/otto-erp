import {
  Home,
  Clock,
  PlusCircle,
  Users,
  FolderKanban,
  CheckSquare,
  Timer,
  LayoutGrid,
  Banknote,
  FileText,
  FolderOpen,
  Mic,
  Sparkles,
  Megaphone,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "ראשי",
    items: [
      { label: "בית", href: "/dashboard", icon: Home },
      { label: "היום", href: "/today", icon: Clock },
      { label: "לידים", href: "/leads", icon: PlusCircle },
    ],
  },
  {
    label: "עבודה",
    items: [
      { label: "לקוחות", href: "/customers", icon: Users },
      { label: "פרויקטים", href: "/projects", icon: FolderKanban },
      { label: "משימות", href: "/tasks", icon: CheckSquare },
      { label: "שעות", href: "/time", icon: Timer },
      { label: "בנק שעות", href: "/hour-banks", icon: LayoutGrid },
    ],
  },
  {
    label: "כסף ומסמכים",
    items: [
      { label: "פיננסים", href: "/finance", icon: Banknote },
      { label: "הצעות מחיר", href: "/quotes", icon: FileText },
      { label: "מסמכים", href: "/documents", icon: FolderOpen },
    ],
  },
  {
    label: "חכם",
    items: [
      { label: "הקלטות", href: "/recordings", icon: Mic },
      { label: "סוכנים", href: "/agents", icon: Sparkles },
      { label: "שיווק", href: "/marketing", icon: Megaphone },
    ],
  },
];
