"use client";

import { useEffect } from "react";
import { pushRecent } from "./recent-items";

interface RecentTrackerProps {
  type: "customer" | "lead";
  id: string;
  label: string;
  sublabel?: string;
}

export function RecentTracker({ type, id, label, sublabel }: RecentTrackerProps) {
  useEffect(() => {
    pushRecent({ type, id, label, sublabel });
  }, [type, id, label, sublabel]);
  return null;
}
