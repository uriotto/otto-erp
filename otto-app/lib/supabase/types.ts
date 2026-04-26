export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      activities: {
        Row: {
          body: string | null;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          customer_id: string | null;
          due_at: string | null;
          end_at: string | null;
          id: string;
          lead_id: string | null;
          occurred_at: string;
          tenant_id: string;
          title: string;
          type: string;
        };
        Insert: {
          body?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          due_at?: string | null;
          end_at?: string | null;
          id?: string;
          lead_id?: string | null;
          occurred_at?: string;
          tenant_id: string;
          title: string;
          type: string;
        };
        Update: {
          body?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          due_at?: string | null;
          end_at?: string | null;
          id?: string;
          lead_id?: string | null;
          occurred_at?: string;
          tenant_id?: string;
          title?: string;
          type?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          address: string | null;
          billing_model_default: string | null;
          company: string | null;
          created_at: string;
          email: string | null;
          hourly_rate_override: number | null;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
          status: string;
          tags: string[];
          tenant_id: string;
          updated_at: string;
          website: string | null;
        };
        Insert: {
          address?: string | null;
          billing_model_default?: string | null;
          company?: string | null;
          created_at?: string;
          email?: string | null;
          hourly_rate_override?: number | null;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
          status?: string;
          tags?: string[];
          tenant_id: string;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          address?: string | null;
          billing_model_default?: string | null;
          company?: string | null;
          created_at?: string;
          email?: string | null;
          hourly_rate_override?: number | null;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          status?: string;
          tags?: string[];
          tenant_id?: string;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [];
      };
      hour_banks: {
        Row: {
          absorbed_overage_hours: number;
          alert_sent_hours: boolean;
          alert_sent_pct: boolean;
          alert_threshold_hours: number;
          alert_threshold_pct: number;
          created_at: string;
          created_by: string | null;
          customer_id: string;
          expiry_date: string | null;
          hourly_rate: number;
          id: string;
          invoice_id: string | null;
          notes: string | null;
          parent_bank_id: string | null;
          purchase_date: string;
          purchased_hours: number;
          status: Database["public"]["Enums"]["hour_bank_status"];
          tenant_id: string;
          total_amount: number | null;
          updated_at: string;
        };
        Insert: {
          absorbed_overage_hours?: number;
          alert_sent_hours?: boolean;
          alert_sent_pct?: boolean;
          alert_threshold_hours?: number;
          alert_threshold_pct?: number;
          created_at?: string;
          created_by?: string | null;
          customer_id: string;
          expiry_date?: string | null;
          hourly_rate: number;
          id?: string;
          invoice_id?: string | null;
          notes?: string | null;
          parent_bank_id?: string | null;
          purchase_date?: string;
          purchased_hours: number;
          status?: Database["public"]["Enums"]["hour_bank_status"];
          tenant_id: string;
          total_amount?: number | null;
          updated_at?: string;
        };
        Update: {
          absorbed_overage_hours?: number;
          alert_sent_hours?: boolean;
          alert_sent_pct?: boolean;
          alert_threshold_hours?: number;
          alert_threshold_pct?: number;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string;
          expiry_date?: string | null;
          hourly_rate?: number;
          id?: string;
          invoice_id?: string | null;
          notes?: string | null;
          parent_bank_id?: string | null;
          purchase_date?: string;
          purchased_hours?: number;
          status?: Database["public"]["Enums"]["hour_bank_status"];
          tenant_id?: string;
          total_amount?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      tenant_settings: {
        Row: {
          auto_absorb_overage_default: boolean;
          default_alert_threshold_hours: number;
          default_alert_threshold_pct: number;
          default_hour_bank_expiry_months: number;
          default_hourly_rate: number;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          auto_absorb_overage_default?: boolean;
          default_alert_threshold_hours?: number;
          default_alert_threshold_pct?: number;
          default_hour_bank_expiry_months?: number;
          default_hourly_rate?: number;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          auto_absorb_overage_default?: boolean;
          default_alert_threshold_hours?: number;
          default_alert_threshold_pct?: number;
          default_hour_bank_expiry_months?: number;
          default_hourly_rate?: number;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          assigned_to: string | null;
          company: string | null;
          converted_to_customer_id: string | null;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
          source: string | null;
          status: string;
          tags: string[];
          tenant_id: string;
          updated_at: string;
          value: number | null;
        };
        Insert: {
          assigned_to?: string | null;
          company?: string | null;
          converted_to_customer_id?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
          source?: string | null;
          status?: string;
          tags?: string[];
          tenant_id: string;
          updated_at?: string;
          value?: number | null;
        };
        Update: {
          assigned_to?: string | null;
          company?: string | null;
          converted_to_customer_id?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          source?: string | null;
          status?: string;
          tags?: string[];
          tenant_id?: string;
          updated_at?: string;
          value?: number | null;
        };
        Relationships: [];
      };
      milestones: {
        Row: {
          completed_at: string | null;
          created_at: string;
          description: string | null;
          due_date: string | null;
          id: string;
          name: string;
          order_index: number;
          project_id: string;
          tenant_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          name: string;
          order_index?: number;
          project_id: string;
          tenant_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          name?: string;
          order_index?: number;
          project_id?: string;
          tenant_id?: string;
        };
        Relationships: [];
      };
      project_templates: {
        Row: {
          created_at: string;
          default_billing_model: Database["public"]["Enums"]["project_billing_model"] | null;
          default_estimated_hours: number | null;
          description: string | null;
          id: string;
          name: string;
          phases_template: Json;
          tasks_template: Json;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          default_billing_model?: Database["public"]["Enums"]["project_billing_model"] | null;
          default_estimated_hours?: number | null;
          description?: string | null;
          id?: string;
          name: string;
          phases_template?: Json;
          tasks_template?: Json;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          default_billing_model?: Database["public"]["Enums"]["project_billing_model"] | null;
          default_estimated_hours?: number | null;
          description?: string | null;
          id?: string;
          name?: string;
          phases_template?: Json;
          tasks_template?: Json;
          tenant_id?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          billing_model: Database["public"]["Enums"]["project_billing_model"];
          budget: number | null;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          customer_id: string | null;
          deleted_at: string | null;
          description: string | null;
          due_date: string | null;
          estimated_hours: number | null;
          google_drive_folder_id: string | null;
          health: Database["public"]["Enums"]["project_health"];
          id: string;
          name: string;
          parent_project_id: string | null;
          phase: Database["public"]["Enums"]["project_phase"] | null;
          start_date: string | null;
          status: Database["public"]["Enums"]["project_status"];
          tags: string[];
          template_id: string | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          billing_model?: Database["public"]["Enums"]["project_billing_model"];
          budget?: number | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          due_date?: string | null;
          estimated_hours?: number | null;
          google_drive_folder_id?: string | null;
          health?: Database["public"]["Enums"]["project_health"];
          id?: string;
          name: string;
          parent_project_id?: string | null;
          phase?: Database["public"]["Enums"]["project_phase"] | null;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["project_status"];
          tags?: string[];
          template_id?: string | null;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          billing_model?: Database["public"]["Enums"]["project_billing_model"];
          budget?: number | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          due_date?: string | null;
          estimated_hours?: number | null;
          google_drive_folder_id?: string | null;
          health?: Database["public"]["Enums"]["project_health"];
          id?: string;
          name?: string;
          parent_project_id?: string | null;
          phase?: Database["public"]["Enums"]["project_phase"] | null;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["project_status"];
          tags?: string[];
          template_id?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          assigned_to: string | null;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          due_date: string | null;
          id: string;
          order_index: number;
          parent_task_id: string | null;
          priority: Database["public"]["Enums"]["task_priority"];
          project_id: string | null;
          status: Database["public"]["Enums"]["task_status"];
          tags: string[];
          tenant_id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          assigned_to?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          order_index?: number;
          parent_task_id?: string | null;
          priority?: Database["public"]["Enums"]["task_priority"];
          project_id?: string | null;
          status?: Database["public"]["Enums"]["task_status"];
          tags?: string[];
          tenant_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          order_index?: number;
          parent_task_id?: string | null;
          priority?: Database["public"]["Enums"]["task_priority"];
          project_id?: string | null;
          status?: Database["public"]["Enums"]["task_status"];
          tags?: string[];
          tenant_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      time_entries: {
        Row: {
          billable: boolean;
          billing_status: string;
          customer_id: string | null;
          duration_minutes: number | null;
          end_time: string | null;
          hourly_rate_at_entry: number | null;
          id: string;
          imported_from_toggl: boolean;
          notes: string | null;
          project_id: string | null;
          start_time: string;
          task_id: string | null;
          tenant_id: string;
          user_id: string;
        };
        Insert: {
          billable?: boolean;
          billing_status?: string;
          customer_id?: string | null;
          duration_minutes?: number | null;
          end_time?: string | null;
          hourly_rate_at_entry?: number | null;
          id?: string;
          imported_from_toggl?: boolean;
          notes?: string | null;
          project_id?: string | null;
          start_time: string;
          task_id?: string | null;
          tenant_id: string;
          user_id: string;
        };
        Update: {
          billable?: boolean;
          billing_status?: string;
          customer_id?: string | null;
          duration_minutes?: number | null;
          end_time?: string | null;
          hourly_rate_at_entry?: number | null;
          id?: string;
          imported_from_toggl?: boolean;
          notes?: string | null;
          project_id?: string | null;
          start_time?: string;
          task_id?: string | null;
          tenant_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      tenants: {
        Row: {
          created_at: string;
          id: string;
          logo_url: string | null;
          name: string;
          plan: string;
          settings: Json;
          slug: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          logo_url?: string | null;
          name: string;
          plan?: string;
          settings?: Json;
          slug: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          logo_url?: string | null;
          name?: string;
          plan?: string;
          settings?: Json;
          slug?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          customer_id: string | null;
          email: string;
          full_name: string | null;
          id: string;
          last_seen_at: string | null;
          role: string;
          settings: Json;
          tenant_id: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          customer_id?: string | null;
          email: string;
          full_name?: string | null;
          id: string;
          last_seen_at?: string | null;
          role?: string;
          settings?: Json;
          tenant_id: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          customer_id?: string | null;
          email?: string;
          full_name?: string | null;
          id?: string;
          last_seen_at?: string | null;
          role?: string;
          settings?: Json;
          tenant_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      hour_banks_summary: {
        Row: {
          absorbed_overage_hours: number | null;
          alert_sent_hours: boolean | null;
          alert_sent_pct: boolean | null;
          alert_threshold_hours: number | null;
          alert_threshold_pct: number | null;
          available_hours: number | null;
          consumed_hours: number | null;
          created_at: string | null;
          created_by: string | null;
          customer_id: string | null;
          expiry_date: string | null;
          hourly_rate: number | null;
          id: string | null;
          invoice_id: string | null;
          notes: string | null;
          parent_bank_id: string | null;
          purchase_date: string | null;
          purchased_hours: number | null;
          status: Database["public"]["Enums"]["hour_bank_status"] | null;
          tenant_id: string | null;
          total_amount: number | null;
          updated_at: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      convert_lead_to_customer: { Args: { p_lead_id: string }; Returns: string };
      current_customer_id: { Args: never; Returns: string };
      current_tenant_id: { Args: never; Returns: string };
      current_user_role: { Args: never; Returns: string };
    };
    Enums: {
      hour_bank_status: "active" | "depleted" | "expired" | "cancelled";
      project_billing_model: "hourly" | "hour_bank" | "fixed_price" | "retainer";
      project_health: "on_track" | "at_risk" | "off_track";
      project_phase:
        | "discovery"
        | "specification"
        | "development"
        | "qa"
        | "launch"
        | "maintenance";
      project_status: "planning" | "active" | "on_hold" | "completed" | "cancelled";
      task_priority: "low" | "medium" | "high" | "urgent";
      task_status: "todo" | "in_progress" | "review" | "done" | "cancelled";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Row"];
export type Views<T extends keyof DefaultSchema["Views"]> = DefaultSchema["Views"][T]["Row"];
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"];
export type Enums<T extends keyof DefaultSchema["Enums"]> = DefaultSchema["Enums"][T];
