export type CustomerOption = { id: string; name: string };
export type ActiveTimer = {
  session_id: string;
  revision: number;
  customer_id: string | null;
  project_id: string | null;
  task_id: string | null;
  notes: string | null;
  started_at: string;
};
export type SavedTimeEntry = {
  id: string;
  edit_version: string;
  customer_id: string | null;
  notes: string | null;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  billing_status: string;
  invoice_id: string | null;
  project_id: string | null;
  task_id: string | null;
  billable: boolean;
};
export type TimerSnapshot = {
  active: ActiveTimer | null;
  customers: CustomerOption[];
  entries: SavedTimeEntry[];
};
export type TimerResult = { error?: string; snapshot?: TimerSnapshot };

export type TimerHistoryCursor = { start_time: string; id: string };
export type TimerHistoryPage = {
  entries: SavedTimeEntry[];
  hasMore: boolean;
  cursor: TimerHistoryCursor | null;
};
export type TimerHistoryResult = { error?: string; page?: TimerHistoryPage };
