export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
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
        Relationships: [
          {
            foreignKeyName: "activities_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_invocations: {
        Row: {
          agent_id: string;
          completed_at: string | null;
          context_id: string;
          context_type: string;
          created_at: string;
          error: string | null;
          id: string;
          result_html: string | null;
          status: string;
          tenant_id: string;
        };
        Insert: {
          agent_id: string;
          completed_at?: string | null;
          context_id: string;
          context_type: string;
          created_at?: string;
          error?: string | null;
          id?: string;
          result_html?: string | null;
          status?: string;
          tenant_id: string;
        };
        Update: {
          agent_id?: string;
          completed_at?: string | null;
          context_id?: string;
          context_type?: string;
          created_at?: string;
          error?: string | null;
          id?: string;
          result_html?: string | null;
          status?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agent_invocations_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "external_agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_invocations_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_slots: {
        Row: {
          booking_type_id: string;
          created_at: string;
          end_at: string;
          guest_email: string;
          guest_name: string;
          guest_phone: string | null;
          id: string;
          notes: string | null;
          start_at: string;
          status: string;
          tenant_id: string;
        };
        Insert: {
          booking_type_id: string;
          created_at?: string;
          end_at: string;
          guest_email: string;
          guest_name: string;
          guest_phone?: string | null;
          id?: string;
          notes?: string | null;
          start_at: string;
          status?: string;
          tenant_id: string;
        };
        Update: {
          booking_type_id?: string;
          created_at?: string;
          end_at?: string;
          guest_email?: string;
          guest_name?: string;
          guest_phone?: string | null;
          id?: string;
          notes?: string | null;
          start_at?: string;
          status?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_slots_booking_type_id_fkey";
            columns: ["booking_type_id"];
            isOneToOne: false;
            referencedRelation: "booking_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_slots_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_types: {
        Row: {
          color: string;
          created_at: string;
          description: string | null;
          duration_minutes: number;
          id: string;
          is_active: boolean;
          slug: string;
          tenant_id: string;
          title: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          description?: string | null;
          duration_minutes?: number;
          id?: string;
          is_active?: boolean;
          slug: string;
          tenant_id: string;
          title: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          description?: string | null;
          duration_minutes?: number;
          id?: string;
          is_active?: boolean;
          slug?: string;
          tenant_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_types_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      contacts: {
        Row: {
          created_at: string;
          customer_id: string | null;
          email: string | null;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
          role: string | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          customer_id?: string | null;
          email?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
          role?: string | null;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string | null;
          email?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          role?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contacts_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_credentials: {
        Row: {
          created_at: string;
          credential_type: string;
          customer_id: string;
          id: string;
          label: string;
          notes: string | null;
          secret_encrypted: string | null;
          tenant_id: string;
          url: string | null;
          username: string | null;
        };
        Insert: {
          created_at?: string;
          credential_type?: string;
          customer_id: string;
          id?: string;
          label: string;
          notes?: string | null;
          secret_encrypted?: string | null;
          tenant_id: string;
          url?: string | null;
          username?: string | null;
        };
        Update: {
          created_at?: string;
          credential_type?: string;
          customer_id?: string;
          id?: string;
          label?: string;
          notes?: string | null;
          secret_encrypted?: string | null;
          tenant_id?: string;
          url?: string | null;
          username?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customer_credentials_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_credentials_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          active: boolean;
          address: string | null;
          billing_model_default: string | null;
          company: string | null;
          company_registration_number: string | null;
          created_at: string;
          email: string | null;
          hourly_rate_override: number | null;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
          portal_enabled: boolean;
          portal_last_login: string | null;
          retainer_monthly_amount: number | null;
          status: string;
          tags: string[];
          tenant_id: string;
          updated_at: string;
          website: string | null;
        };
        Insert: {
          active?: boolean;
          address?: string | null;
          billing_model_default?: string | null;
          company?: string | null;
          company_registration_number?: string | null;
          created_at?: string;
          email?: string | null;
          hourly_rate_override?: number | null;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
          portal_enabled?: boolean;
          portal_last_login?: string | null;
          retainer_monthly_amount?: number | null;
          status?: string;
          tags?: string[];
          tenant_id: string;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          active?: boolean;
          address?: string | null;
          billing_model_default?: string | null;
          company?: string | null;
          company_registration_number?: string | null;
          created_at?: string;
          email?: string | null;
          hourly_rate_override?: number | null;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          portal_enabled?: boolean;
          portal_last_login?: string | null;
          retainer_monthly_amount?: number | null;
          status?: string;
          tags?: string[];
          tenant_id?: string;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          created_at: string;
          created_by: string | null;
          customer_id: string | null;
          extracted_text: string | null;
          file_path: string | null;
          file_size_bytes: number | null;
          file_source: Database["public"]["Enums"]["file_source"];
          file_url: string | null;
          id: string;
          mime_type: string | null;
          notes: string | null;
          project_id: string | null;
          signature_data: string | null;
          signature_required: boolean;
          signed_at: string | null;
          signed_by_email: string | null;
          signed_by_name: string | null;
          tags: string[];
          tenant_id: string;
          title: string;
          type: Database["public"]["Enums"]["document_type"];
          updated_at: string;
          visible_to_client: boolean;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          extracted_text?: string | null;
          file_path?: string | null;
          file_size_bytes?: number | null;
          file_source?: Database["public"]["Enums"]["file_source"];
          file_url?: string | null;
          id?: string;
          mime_type?: string | null;
          notes?: string | null;
          project_id?: string | null;
          signature_data?: string | null;
          signature_required?: boolean;
          signed_at?: string | null;
          signed_by_email?: string | null;
          signed_by_name?: string | null;
          tags?: string[];
          tenant_id: string;
          title: string;
          type?: Database["public"]["Enums"]["document_type"];
          updated_at?: string;
          visible_to_client?: boolean;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          extracted_text?: string | null;
          file_path?: string | null;
          file_size_bytes?: number | null;
          file_source?: Database["public"]["Enums"]["file_source"];
          file_url?: string | null;
          id?: string;
          mime_type?: string | null;
          notes?: string | null;
          project_id?: string | null;
          signature_data?: string | null;
          signature_required?: boolean;
          signed_at?: string | null;
          signed_by_email?: string | null;
          signed_by_name?: string | null;
          tags?: string[];
          tenant_id?: string;
          title?: string;
          type?: Database["public"]["Enums"]["document_type"];
          updated_at?: string;
          visible_to_client?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "documents_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      event_guests: {
        Row: {
          created_at: string;
          email: string;
          event_id: string;
          id: string;
          name: string | null;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          event_id: string;
          id?: string;
          name?: string | null;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          event_id?: string;
          id?: string;
          name?: string | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_guests_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_guests_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          all_day: boolean;
          created_at: string;
          customer_id: string | null;
          description: string | null;
          end_at: string;
          google_event_id: string | null;
          id: string;
          location: string | null;
          meeting_url: string | null;
          project_id: string | null;
          start_at: string;
          tenant_id: string;
          title: string;
          type: string;
          updated_at: string | null;
        };
        Insert: {
          all_day?: boolean;
          created_at?: string;
          customer_id?: string | null;
          description?: string | null;
          end_at: string;
          google_event_id?: string | null;
          id?: string;
          location?: string | null;
          meeting_url?: string | null;
          project_id?: string | null;
          start_at: string;
          tenant_id: string;
          title: string;
          type?: string;
          updated_at?: string | null;
        };
        Update: {
          all_day?: boolean;
          created_at?: string;
          customer_id?: string | null;
          description?: string | null;
          end_at?: string;
          google_event_id?: string | null;
          id?: string;
          location?: string | null;
          meeting_url?: string | null;
          project_id?: string | null;
          start_at?: string;
          tenant_id?: string;
          title?: string;
          type?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "events_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      expenses: {
        Row: {
          amount: number;
          category: string;
          created_at: string;
          created_by: string | null;
          currency: string;
          customer_id: string | null;
          description: string | null;
          id: string;
          invoice_id: string | null;
          invoiced: boolean;
          occurred_on: string;
          project_id: string | null;
          receipt_url: string | null;
          reimbursable: boolean;
          tenant_id: string;
        };
        Insert: {
          amount: number;
          category: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          customer_id?: string | null;
          description?: string | null;
          id?: string;
          invoice_id?: string | null;
          invoiced?: boolean;
          occurred_on?: string;
          project_id?: string | null;
          receipt_url?: string | null;
          reimbursable?: boolean;
          tenant_id: string;
        };
        Update: {
          amount?: number;
          category?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          customer_id?: string | null;
          description?: string | null;
          id?: string;
          invoice_id?: string | null;
          invoiced?: boolean;
          occurred_on?: string;
          project_id?: string | null;
          receipt_url?: string | null;
          reimbursable?: boolean;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices_aging";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      external_agents: {
        Row: {
          created_at: string;
          description: string | null;
          icon: string;
          id: string;
          is_active: boolean;
          name: string;
          tenant_id: string;
          trigger_contexts: string[];
          webhook_url: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          icon?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          tenant_id: string;
          trigger_contexts?: string[];
          webhook_url: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          icon?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          tenant_id?: string;
          trigger_contexts?: string[];
          webhook_url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "external_agents_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: "hour_banks_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hour_banks_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hour_banks_parent_bank_id_fkey";
            columns: ["parent_bank_id"];
            isOneToOne: false;
            referencedRelation: "hour_banks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hour_banks_parent_bank_id_fkey";
            columns: ["parent_bank_id"];
            isOneToOne: false;
            referencedRelation: "hour_banks_summary";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hour_banks_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      invoice_items: {
        Row: {
          amount: number | null;
          description: string;
          id: string;
          invoice_id: string;
          order_index: number;
          quantity: number;
          unit_price: number;
        };
        Insert: {
          amount?: number | null;
          description: string;
          id?: string;
          invoice_id: string;
          order_index?: number;
          quantity?: number;
          unit_price?: number;
        };
        Update: {
          amount?: number | null;
          description?: string;
          id?: string;
          invoice_id?: string;
          order_index?: number;
          quantity?: number;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices_aging";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: {
          created_at: string;
          created_by: string | null;
          currency: string;
          customer_id: string;
          document_type: Database["public"]["Enums"]["invoice_document_type"] | null;
          due_date: string | null;
          finbot_invoice_id: string | null;
          finbot_url: string | null;
          hour_bank_id: string | null;
          id: string;
          issue_date: string;
          notes: string | null;
          number: string | null;
          paid_at: string | null;
          project_id: string | null;
          status: Database["public"]["Enums"]["invoice_status"];
          subtotal: number;
          tax_amount: number | null;
          tax_rate: number;
          tenant_id: string;
          total_amount: number | null;
          type: Database["public"]["Enums"]["invoice_type"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          customer_id: string;
          document_type?: Database["public"]["Enums"]["invoice_document_type"] | null;
          due_date?: string | null;
          finbot_invoice_id?: string | null;
          finbot_url?: string | null;
          hour_bank_id?: string | null;
          id?: string;
          issue_date?: string;
          notes?: string | null;
          number?: string | null;
          paid_at?: string | null;
          project_id?: string | null;
          status?: Database["public"]["Enums"]["invoice_status"];
          subtotal?: number;
          tax_amount?: number | null;
          tax_rate?: number;
          tenant_id: string;
          total_amount?: number | null;
          type?: Database["public"]["Enums"]["invoice_type"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          customer_id?: string;
          document_type?: Database["public"]["Enums"]["invoice_document_type"] | null;
          due_date?: string | null;
          finbot_invoice_id?: string | null;
          finbot_url?: string | null;
          hour_bank_id?: string | null;
          id?: string;
          issue_date?: string;
          notes?: string | null;
          number?: string | null;
          paid_at?: string | null;
          project_id?: string | null;
          status?: Database["public"]["Enums"]["invoice_status"];
          subtotal?: number;
          tax_amount?: number | null;
          tax_rate?: number;
          tenant_id?: string;
          total_amount?: number | null;
          type?: Database["public"]["Enums"]["invoice_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_hour_bank_id_fkey";
            columns: ["hour_bank_id"];
            isOneToOne: false;
            referencedRelation: "hour_banks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_hour_bank_id_fkey";
            columns: ["hour_bank_id"];
            isOneToOne: false;
            referencedRelation: "hour_banks_summary";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_converted_to_customer_id_fkey";
            columns: ["converted_to_customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      marketing_content: {
        Row: {
          body: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          notes: string | null;
          platform: Database["public"]["Enums"]["content_platform"];
          published_at: string | null;
          scheduled_date: string | null;
          status: Database["public"]["Enums"]["content_status"];
          tags: string[] | null;
          tenant_id: string;
          title: string;
          updated_at: string;
          utm_campaign: string | null;
          utm_medium: string | null;
          utm_source: string | null;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          notes?: string | null;
          platform?: Database["public"]["Enums"]["content_platform"];
          published_at?: string | null;
          scheduled_date?: string | null;
          status?: Database["public"]["Enums"]["content_status"];
          tags?: string[] | null;
          tenant_id: string;
          title: string;
          updated_at?: string;
          utm_campaign?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          notes?: string | null;
          platform?: Database["public"]["Enums"]["content_platform"];
          published_at?: string | null;
          scheduled_date?: string | null;
          status?: Database["public"]["Enums"]["content_status"];
          tags?: string[] | null;
          tenant_id?: string;
          title?: string;
          updated_at?: string;
          utm_campaign?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "marketing_content_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketing_content_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: "milestones_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "milestones_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          link: string | null;
          read_at: string | null;
          severity: Database["public"]["Enums"]["notification_severity"];
          tenant_id: string;
          title: string;
          user_id: string | null;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          link?: string | null;
          read_at?: string | null;
          severity?: Database["public"]["Enums"]["notification_severity"];
          tenant_id: string;
          title: string;
          user_id?: string | null;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          link?: string | null;
          read_at?: string | null;
          severity?: Database["public"]["Enums"]["notification_severity"];
          tenant_id?: string;
          title?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          card_last_4: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          invoice_id: string;
          method: Database["public"]["Enums"]["payment_method"];
          notes: string | null;
          paid_at: string;
          reference: string | null;
          tenant_id: string;
        };
        Insert: {
          amount: number;
          card_last_4?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          invoice_id: string;
          method?: Database["public"]["Enums"]["payment_method"];
          notes?: string | null;
          paid_at?: string;
          reference?: string | null;
          tenant_id: string;
        };
        Update: {
          amount?: number;
          card_last_4?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          invoice_id?: string;
          method?: Database["public"]["Enums"]["payment_method"];
          notes?: string | null;
          paid_at?: string;
          reference?: string | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices_aging";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      project_payment_schedule: {
        Row: {
          amount: number;
          created_at: string;
          description: string;
          due_date: string | null;
          id: string;
          notes: string | null;
          paid_at: string | null;
          project_id: string;
          sort_order: number;
          status: string;
          tenant_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          description: string;
          due_date?: string | null;
          id?: string;
          notes?: string | null;
          paid_at?: string | null;
          project_id: string;
          sort_order?: number;
          status?: string;
          tenant_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          description?: string;
          due_date?: string | null;
          id?: string;
          notes?: string | null;
          paid_at?: string | null;
          project_id?: string;
          sort_order?: number;
          status?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_payment_schedule_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_payment_schedule_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: "project_templates_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
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
          warranty_end: string | null;
          warranty_start: string | null;
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
          warranty_end?: string | null;
          warranty_start?: string | null;
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
          warranty_end?: string | null;
          warranty_start?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_parent_project_id_fkey";
            columns: ["parent_project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "project_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      quotes: {
        Row: {
          amount: number | null;
          created_at: string;
          customer_id: string;
          document_url: string | null;
          id: string;
          modules: Json | null;
          notes: string | null;
          project_id: string | null;
          public_token: string;
          signature_data: string | null;
          signed_at: string | null;
          signer_email: string | null;
          signer_name: string | null;
          status: string;
          tenant_id: string;
          title: string;
          valid_until: string | null;
        };
        Insert: {
          amount?: number | null;
          created_at?: string;
          customer_id: string;
          document_url?: string | null;
          id?: string;
          modules?: Json | null;
          notes?: string | null;
          project_id?: string | null;
          public_token?: string;
          signature_data?: string | null;
          signed_at?: string | null;
          signer_email?: string | null;
          signer_name?: string | null;
          status?: string;
          tenant_id: string;
          title: string;
          valid_until?: string | null;
        };
        Update: {
          amount?: number | null;
          created_at?: string;
          customer_id?: string;
          document_url?: string | null;
          id?: string;
          modules?: Json | null;
          notes?: string | null;
          project_id?: string | null;
          public_token?: string;
          signature_data?: string | null;
          signed_at?: string | null;
          signer_email?: string | null;
          signer_name?: string | null;
          status?: string;
          tenant_id?: string;
          title?: string;
          valid_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotes_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotes_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      recordings: {
        Row: {
          created_at: string;
          customer_id: string | null;
          duration_seconds: number | null;
          file_size: number | null;
          id: string;
          project_id: string | null;
          recorded_at: string;
          status: string;
          storage_path: string | null;
          summary: string | null;
          tenant_id: string;
          title: string;
          transcript: string | null;
        };
        Insert: {
          created_at?: string;
          customer_id?: string | null;
          duration_seconds?: number | null;
          file_size?: number | null;
          id?: string;
          project_id?: string | null;
          recorded_at?: string;
          status?: string;
          storage_path?: string | null;
          summary?: string | null;
          tenant_id: string;
          title: string;
          transcript?: string | null;
        };
        Update: {
          created_at?: string;
          customer_id?: string | null;
          duration_seconds?: number | null;
          file_size?: number | null;
          id?: string;
          project_id?: string | null;
          recorded_at?: string;
          status?: string;
          storage_path?: string | null;
          summary?: string | null;
          tenant_id?: string;
          title?: string;
          transcript?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "recordings_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recordings_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recordings_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      reports: {
        Row: {
          approved_at: string | null;
          created_at: string;
          customer_id: string | null;
          data: Json | null;
          id: string;
          period_end: string;
          period_start: string;
          status: string;
          summary: string | null;
          tenant_id: string;
          title: string;
          type: string;
          visible_to_client: boolean;
        };
        Insert: {
          approved_at?: string | null;
          created_at?: string;
          customer_id?: string | null;
          data?: Json | null;
          id?: string;
          period_end: string;
          period_start: string;
          status?: string;
          summary?: string | null;
          tenant_id: string;
          title: string;
          type?: string;
          visible_to_client?: boolean;
        };
        Update: {
          approved_at?: string | null;
          created_at?: string;
          customer_id?: string | null;
          data?: Json | null;
          id?: string;
          period_end?: string;
          period_start?: string;
          status?: string;
          summary?: string | null;
          tenant_id?: string;
          title?: string;
          type?: string;
          visible_to_client?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "reports_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          assigned_to: string | null;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          created_via_portal: boolean;
          customer_id: string | null;
          description: string | null;
          due_at: string | null;
          due_date: string | null;
          id: string;
          lead_id: string | null;
          order_index: number;
          parent_task_id: string | null;
          portal_hidden: boolean;
          priority: Database["public"]["Enums"]["task_priority"];
          project_id: string | null;
          recurring_config: Json | null;
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
          created_via_portal?: boolean;
          customer_id?: string | null;
          description?: string | null;
          due_at?: string | null;
          due_date?: string | null;
          id?: string;
          lead_id?: string | null;
          order_index?: number;
          parent_task_id?: string | null;
          portal_hidden?: boolean;
          priority?: Database["public"]["Enums"]["task_priority"];
          project_id?: string | null;
          recurring_config?: Json | null;
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
          created_via_portal?: boolean;
          customer_id?: string | null;
          description?: string | null;
          due_at?: string | null;
          due_date?: string | null;
          id?: string;
          lead_id?: string | null;
          order_index?: number;
          parent_task_id?: string | null;
          portal_hidden?: boolean;
          priority?: Database["public"]["Enums"]["task_priority"];
          project_id?: string | null;
          recurring_config?: Json | null;
          status?: Database["public"]["Enums"]["task_status"];
          tags?: string[];
          tenant_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey";
            columns: ["parent_task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_settings: {
        Row: {
          auto_absorb_overage_default: boolean;
          default_alert_threshold_hours: number;
          default_alert_threshold_pct: number;
          default_hour_bank_expiry_months: number;
          default_hour_bank_rate: number;
          default_hourly_rate: number;
          google_access_token: string | null;
          google_calendar_id: string | null;
          google_channel_id: string | null;
          google_channel_resource_id: string | null;
          google_refresh_token: string | null;
          google_sync_token: string | null;
          google_token_expiry: string | null;
          make_webhook_url: string | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          auto_absorb_overage_default?: boolean;
          default_alert_threshold_hours?: number;
          default_alert_threshold_pct?: number;
          default_hour_bank_expiry_months?: number;
          default_hour_bank_rate?: number;
          default_hourly_rate?: number;
          google_access_token?: string | null;
          google_calendar_id?: string | null;
          google_channel_id?: string | null;
          google_channel_resource_id?: string | null;
          google_refresh_token?: string | null;
          google_sync_token?: string | null;
          google_token_expiry?: string | null;
          make_webhook_url?: string | null;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          auto_absorb_overage_default?: boolean;
          default_alert_threshold_hours?: number;
          default_alert_threshold_pct?: number;
          default_hour_bank_expiry_months?: number;
          default_hour_bank_rate?: number;
          default_hourly_rate?: number;
          google_access_token?: string | null;
          google_calendar_id?: string | null;
          google_channel_id?: string | null;
          google_channel_resource_id?: string | null;
          google_refresh_token?: string | null;
          google_sync_token?: string | null;
          google_token_expiry?: string | null;
          make_webhook_url?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: true;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
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
      time_entries: {
        Row: {
          billable: boolean;
          billing_status: Database["public"]["Enums"]["time_entry_billing_status"];
          consumed_from_bank_id: string | null;
          created_at: string;
          customer_id: string | null;
          duration_minutes: number;
          end_time: string;
          hourly_rate_at_entry: number | null;
          id: string;
          imported_from_toggl: boolean;
          invoice_id: string | null;
          is_overage: boolean;
          notes: string | null;
          project_id: string | null;
          start_time: string;
          task_id: string | null;
          tenant_id: string;
          user_id: string;
        };
        Insert: {
          billable?: boolean;
          billing_status?: Database["public"]["Enums"]["time_entry_billing_status"];
          consumed_from_bank_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          duration_minutes: number;
          end_time: string;
          hourly_rate_at_entry?: number | null;
          id?: string;
          imported_from_toggl?: boolean;
          invoice_id?: string | null;
          is_overage?: boolean;
          notes?: string | null;
          project_id?: string | null;
          start_time: string;
          task_id?: string | null;
          tenant_id: string;
          user_id: string;
        };
        Update: {
          billable?: boolean;
          billing_status?: Database["public"]["Enums"]["time_entry_billing_status"];
          consumed_from_bank_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          duration_minutes?: number;
          end_time?: string;
          hourly_rate_at_entry?: number | null;
          id?: string;
          imported_from_toggl?: boolean;
          invoice_id?: string | null;
          is_overage?: boolean;
          notes?: string | null;
          project_id?: string | null;
          start_time?: string;
          task_id?: string | null;
          tenant_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "time_entries_consumed_from_bank_id_fkey";
            columns: ["consumed_from_bank_id"];
            isOneToOne: false;
            referencedRelation: "hour_banks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "time_entries_consumed_from_bank_id_fkey";
            columns: ["consumed_from_bank_id"];
            isOneToOne: false;
            referencedRelation: "hour_banks_summary";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "time_entries_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "time_entries_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "time_entries_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "time_entries_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "time_entries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      user_invites: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          invited_by: string | null;
          role: string;
          tenant_id: string;
          used_at: string | null;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          invited_by?: string | null;
          role?: string;
          tenant_id: string;
          used_at?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          invited_by?: string | null;
          role?: string;
          tenant_id?: string;
          used_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_invites_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_invites_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: "users_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "users_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
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
        Insert: {
          absorbed_overage_hours?: number | null;
          alert_sent_hours?: boolean | null;
          alert_sent_pct?: boolean | null;
          alert_threshold_hours?: number | null;
          alert_threshold_pct?: number | null;
          available_hours?: never;
          consumed_hours?: never;
          created_at?: string | null;
          created_by?: string | null;
          customer_id?: string | null;
          expiry_date?: string | null;
          hourly_rate?: number | null;
          id?: string | null;
          invoice_id?: string | null;
          notes?: string | null;
          parent_bank_id?: string | null;
          purchase_date?: string | null;
          purchased_hours?: number | null;
          status?: Database["public"]["Enums"]["hour_bank_status"] | null;
          tenant_id?: string | null;
          total_amount?: number | null;
          updated_at?: string | null;
        };
        Update: {
          absorbed_overage_hours?: number | null;
          alert_sent_hours?: boolean | null;
          alert_sent_pct?: boolean | null;
          alert_threshold_hours?: number | null;
          alert_threshold_pct?: number | null;
          available_hours?: never;
          consumed_hours?: never;
          created_at?: string | null;
          created_by?: string | null;
          customer_id?: string | null;
          expiry_date?: string | null;
          hourly_rate?: number | null;
          id?: string | null;
          invoice_id?: string | null;
          notes?: string | null;
          parent_bank_id?: string | null;
          purchase_date?: string | null;
          purchased_hours?: number | null;
          status?: Database["public"]["Enums"]["hour_bank_status"] | null;
          tenant_id?: string | null;
          total_amount?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "hour_banks_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hour_banks_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hour_banks_parent_bank_id_fkey";
            columns: ["parent_bank_id"];
            isOneToOne: false;
            referencedRelation: "hour_banks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hour_banks_parent_bank_id_fkey";
            columns: ["parent_bank_id"];
            isOneToOne: false;
            referencedRelation: "hour_banks_summary";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hour_banks_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices_aging: {
        Row: {
          age_bucket: string | null;
          customer_id: string | null;
          days_overdue: number | null;
          due_date: string | null;
          id: string | null;
          issue_date: string | null;
          number: string | null;
          paid_amount: number | null;
          status: Database["public"]["Enums"]["invoice_status"] | null;
          tenant_id: string | null;
          total_amount: number | null;
        };
        Insert: {
          age_bucket?: never;
          customer_id?: string | null;
          days_overdue?: never;
          due_date?: string | null;
          id?: string | null;
          issue_date?: string | null;
          number?: string | null;
          paid_amount?: never;
          status?: Database["public"]["Enums"]["invoice_status"] | null;
          tenant_id?: string | null;
          total_amount?: number | null;
        };
        Update: {
          age_bucket?: never;
          customer_id?: string | null;
          days_overdue?: never;
          due_date?: string | null;
          id?: string | null;
          issue_date?: string | null;
          number?: string | null;
          paid_amount?: never;
          status?: Database["public"]["Enums"]["invoice_status"] | null;
          tenant_id?: string | null;
          total_amount?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      allocate_time_entry_to_bank: {
        Args: { p_entry_id: string };
        Returns: {
          entry_id: string;
          status: Database["public"]["Enums"]["time_entry_billing_status"];
        }[];
      };
      backfill_pending_entries_to_bank: {
        Args: { p_bank_id: string };
        Returns: number;
      };
      check_bank_alerts: { Args: { p_bank_id: string }; Returns: undefined };
      convert_lead_to_customer: { Args: { p_lead_id: string }; Returns: string };
      current_customer_id: { Args: never; Returns: string };
      current_tenant_id: { Args: never; Returns: string };
      current_user_role: { Args: never; Returns: string };
      portal_customer_id: { Args: never; Returns: string };
      process_expired_hour_banks: { Args: never; Returns: undefined };
      recalculate_bank: { Args: { p_bank_id: string }; Returns: undefined };
      show_limit: { Args: never; Returns: number };
      show_trgm: { Args: { "": string }; Returns: string[] };
      unaccent: { Args: { "": string }; Returns: string };
    };
    Enums: {
      content_platform:
        | "linkedin"
        | "instagram"
        | "facebook"
        | "twitter"
        | "blog"
        | "email"
        | "whatsapp"
        | "other";
      content_status: "idea" | "planned" | "in_progress" | "published" | "cancelled";
      document_type: "contract" | "spec" | "deliverable" | "reference" | "other";
      file_source: "storage" | "drive";
      hour_bank_status: "draft" | "active" | "depleted" | "expired" | "cancelled";
      invoice_document_type: "payment_request" | "tax_invoice" | "tax_invoice_receipt" | "receipt";
      invoice_status:
        | "draft"
        | "pending_review"
        | "sent"
        | "partial"
        | "paid"
        | "overdue"
        | "cancelled";
      invoice_type: "advance" | "monthly_hours" | "project" | "expense" | "overage" | "other";
      notification_severity: "info" | "warning" | "critical" | "success";
      payment_method: "bank_transfer" | "credit_card" | "bit" | "cash" | "check" | "other";
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
      time_entry_billing_status:
        | "pending"
        | "allocated_to_bank"
        | "overage"
        | "invoiced"
        | "cancelled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      content_platform: [
        "linkedin",
        "instagram",
        "facebook",
        "twitter",
        "blog",
        "email",
        "whatsapp",
        "other",
      ],
      content_status: ["idea", "planned", "in_progress", "published", "cancelled"],
      document_type: ["contract", "spec", "deliverable", "reference", "other"],
      file_source: ["storage", "drive"],
      hour_bank_status: ["draft", "active", "depleted", "expired", "cancelled"],
      invoice_document_type: ["payment_request", "tax_invoice", "tax_invoice_receipt", "receipt"],
      invoice_status: [
        "draft",
        "pending_review",
        "sent",
        "partial",
        "paid",
        "overdue",
        "cancelled",
      ],
      invoice_type: ["advance", "monthly_hours", "project", "expense", "overage", "other"],
      notification_severity: ["info", "warning", "critical", "success"],
      payment_method: ["bank_transfer", "credit_card", "bit", "cash", "check", "other"],
      project_billing_model: ["hourly", "hour_bank", "fixed_price", "retainer"],
      project_health: ["on_track", "at_risk", "off_track"],
      project_phase: ["discovery", "specification", "development", "qa", "launch", "maintenance"],
      project_status: ["planning", "active", "on_hold", "completed", "cancelled"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "review", "done", "cancelled"],
      time_entry_billing_status: [
        "pending",
        "allocated_to_bank",
        "overage",
        "invoiced",
        "cancelled",
      ],
    },
  },
} as const;
