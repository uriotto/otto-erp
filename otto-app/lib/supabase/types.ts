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
          company: string | null;
          created_at: string;
          email: string | null;
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
          company?: string | null;
          created_at?: string;
          email?: string | null;
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
          company?: string | null;
          created_at?: string;
          email?: string | null;
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
    Views: { [_ in never]: never };
    Functions: {
      convert_lead_to_customer: { Args: { p_lead_id: string }; Returns: string };
      current_customer_id: { Args: never; Returns: string };
      current_tenant_id: { Args: never; Returns: string };
      current_user_role: { Args: never; Returns: string };
    };
    Enums: {
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
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"];
export type Enums<T extends keyof DefaultSchema["Enums"]> = DefaultSchema["Enums"][T];
