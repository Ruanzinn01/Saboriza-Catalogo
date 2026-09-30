export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      asset_consignments: {
        Row: {
          asset_unit_id: string
          company_id: string | null
          consigned_at: string
          created_by: string
          customer_id: string
          id: string
          is_active: boolean
          returned_at: string | null
        }
        Insert: {
          asset_unit_id: string
          company_id?: string | null
          consigned_at?: string
          created_by?: string
          customer_id: string
          id?: string
          is_active?: boolean
          returned_at?: string | null
        }
        Update: {
          asset_unit_id?: string
          company_id?: string | null
          consigned_at?: string
          created_by?: string
          customer_id?: string
          id?: string
          is_active?: boolean
          returned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_consignments_asset_unit_id_fkey"
            columns: ["asset_unit_id"]
            isOneToOne: false
            referencedRelation: "asset_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_consignments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_inventory_checks: {
        Row: {
          asset_unit_id: string
          checked_at: string
          checked_by: string
          company_id: string | null
          id: string
          notes: string | null
          result: string
        }
        Insert: {
          asset_unit_id: string
          checked_at?: string
          checked_by?: string
          company_id?: string | null
          id?: string
          notes?: string | null
          result: string
        }
        Update: {
          asset_unit_id?: string
          checked_at?: string
          checked_by?: string
          company_id?: string | null
          id?: string
          notes?: string | null
          result?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_inventory_checks_asset_unit_id_fkey"
            columns: ["asset_unit_id"]
            isOneToOne: false
            referencedRelation: "asset_units"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_models: {
        Row: {
          category: string
          company_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          category?: string
          company_id?: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      asset_movements: {
        Row: {
          asset_unit_id: string
          company_id: string | null
          created_at: string
          created_by: string
          from_unit_id: string | null
          id: string
          notes: string | null
          responsible_employee_id: string | null
          to_unit_id: string | null
          type: string
        }
        Insert: {
          asset_unit_id: string
          company_id?: string | null
          created_at?: string
          created_by?: string
          from_unit_id?: string | null
          id?: string
          notes?: string | null
          responsible_employee_id?: string | null
          to_unit_id?: string | null
          type: string
        }
        Update: {
          asset_unit_id?: string
          company_id?: string | null
          created_at?: string
          created_by?: string
          from_unit_id?: string | null
          id?: string
          notes?: string | null
          responsible_employee_id?: string | null
          to_unit_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_movements_asset_unit_id_fkey"
            columns: ["asset_unit_id"]
            isOneToOne: false
            referencedRelation: "asset_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_movements_from_unit_id_fkey"
            columns: ["from_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_movements_responsible_employee_id_fkey"
            columns: ["responsible_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_movements_to_unit_id_fkey"
            columns: ["to_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_units: {
        Row: {
          acquisition_date: string | null
          acquisition_value: number
          asset_model_id: string
          company_id: string | null
          created_at: string
          current_responsible_id: string | null
          current_unit_id: string | null
          estimated_current_value: number | null
          expense_id: string | null
          id: string
          managerial_value: number | null
          status: string
          updated_at: string
        }
        Insert: {
          acquisition_date?: string | null
          acquisition_value: number
          asset_model_id: string
          company_id?: string | null
          created_at?: string
          current_responsible_id?: string | null
          current_unit_id?: string | null
          estimated_current_value?: number | null
          expense_id?: string | null
          id?: string
          managerial_value?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          acquisition_date?: string | null
          acquisition_value?: number
          asset_model_id?: string
          company_id?: string | null
          created_at?: string
          current_responsible_id?: string | null
          current_unit_id?: string | null
          estimated_current_value?: number | null
          expense_id?: string | null
          id?: string
          managerial_value?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_units_asset_model_id_fkey"
            columns: ["asset_model_id"]
            isOneToOne: false
            referencedRelation: "asset_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_units_current_responsible_id_fkey"
            columns: ["current_responsible_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_units_current_unit_id_fkey"
            columns: ["current_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_units_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          actor_type: string
          actor_user_id: string | null
          causation_id: string | null
          company_id: string | null
          correlation_id: string
          employee_id: string | null
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          idempotency_key: string | null
          occurred_at: string
          payload: Json
          recorded_at: string
          schema_version: number
          unit_id: string | null
        }
        Insert: {
          actor_type: string
          actor_user_id?: string | null
          causation_id?: string | null
          company_id?: string | null
          correlation_id?: string
          employee_id?: string | null
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          idempotency_key?: string | null
          occurred_at?: string
          payload?: Json
          recorded_at?: string
          schema_version?: number
          unit_id?: string | null
        }
        Update: {
          actor_type?: string
          actor_user_id?: string | null
          causation_id?: string | null
          company_id?: string | null
          correlation_id?: string
          employee_id?: string | null
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          idempotency_key?: string | null
          occurred_at?: string
          payload?: Json
          recorded_at?: string
          schema_version?: number
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_company_id_unit_id_fkey"
            columns: ["company_id", "unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      billing_credit_snapshots: {
        Row: {
          available_after: number
          billing_id: string
          commitments: number
          company_id: string | null
          created_at: string
          credit_limit: number
          current_exposure: number
          excess: number
          financed_part: number
          fingerprint: string
          id: string
          open_receivables: number
          overdue_amount: number
          overdue_count: number
          projected_exposure: number
        }
        Insert: {
          available_after?: number
          billing_id: string
          commitments?: number
          company_id?: string | null
          created_at?: string
          credit_limit?: number
          current_exposure?: number
          excess?: number
          financed_part?: number
          fingerprint: string
          id?: string
          open_receivables?: number
          overdue_amount?: number
          overdue_count?: number
          projected_exposure?: number
        }
        Update: {
          available_after?: number
          billing_id?: string
          commitments?: number
          company_id?: string | null
          created_at?: string
          credit_limit?: number
          current_exposure?: number
          excess?: number
          financed_part?: number
          fingerprint?: string
          id?: string
          open_receivables?: number
          overdue_amount?: number
          overdue_count?: number
          projected_exposure?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_credit_snapshots_billing_id_fkey"
            columns: ["billing_id"]
            isOneToOne: false
            referencedRelation: "billings"
            referencedColumns: ["id"]
          },
        ]
      }
      billings: {
        Row: {
          company_id: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          customer_id: string
          fiscal_choice: string | null
          id: string
          idempotency_key: string | null
          order_id: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          customer_id: string
          fiscal_choice?: string | null
          id?: string
          idempotency_key?: string | null
          order_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          customer_id?: string
          fiscal_choice?: string | null
          id?: string
          idempotency_key?: string | null
          order_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      business_groups: {
        Row: {
          created_at: string
          display_name: string
          id: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      categories: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          tagline: string
          updated_at: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          tagline?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          tagline?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      charges: {
        Row: {
          company_id: string | null
          created_at: string
          external_id: string | null
          id: string
          idempotency_key: string
          installment_id: string
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          idempotency_key: string
          installment_id: string
          provider?: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          idempotency_key?: string
          installment_id?: string
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "charges_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          default_timezone: string
          display_name: string
          document: string | null
          environment_status: string
          id: string
          legal_name: string | null
          segment: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          default_timezone?: string
          display_name: string
          document?: string | null
          environment_status?: string
          id?: string
          legal_name?: string | null
          segment: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          default_timezone?: string
          display_name?: string
          document?: string | null
          environment_status?: string
          id?: string
          legal_name?: string | null
          segment?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      company_closing_settings: {
        Row: {
          automation_enabled: boolean
          company_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          automation_enabled?: boolean
          company_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          automation_enabled?: boolean
          company_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_closing_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_partners: {
        Row: {
          company_id: string
          created_at: string
          document: string | null
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          document?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          document?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          code: string
          company_id: string
          created_at: string
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          code: string
          company_id?: string
          created_at?: string
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupons_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_commitments: {
        Row: {
          amount: number
          company_id: string | null
          converted_receivable_id: string | null
          created_at: string
          customer_id: string
          id: string
          order_id: string | null
          origin: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          company_id?: string | null
          converted_receivable_id?: string | null
          created_at?: string
          customer_id: string
          id?: string
          order_id?: string | null
          origin?: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          company_id?: string | null
          converted_receivable_id?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          order_id?: string | null
          origin?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_commitments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_commitments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_releases: {
        Row: {
          billing_id: string
          company_id: string | null
          created_at: string
          id: string
          reason: string
          snapshot_id: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          billing_id: string
          company_id?: string | null
          created_at?: string
          id?: string
          reason: string
          snapshot_id?: string | null
          status?: string
          type: string
          user_id?: string
        }
        Update: {
          billing_id?: string
          company_id?: string | null
          created_at?: string
          id?: string
          reason?: string
          snapshot_id?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_releases_billing_id_fkey"
            columns: ["billing_id"]
            isOneToOne: false
            referencedRelation: "billings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_releases_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "billing_credit_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_credit: {
        Row: {
          company_id: string | null
          created_at: string
          credit_limit: number
          customer_id: string
          policy_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          credit_limit?: number
          customer_id: string
          policy_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          credit_limit?: number
          customer_id?: string
          policy_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_credit_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string
          cep: string
          city: string
          cnpj: string
          company_id: string
          company_name: string
          created_at: string
          email: string
          id: string
          ie: string
          name: string
          neighborhood: string
          phone: string
          state: string
          trade_name: string
          updated_at: string
        }
        Insert: {
          address?: string
          cep?: string
          city?: string
          cnpj?: string
          company_id?: string
          company_name: string
          created_at?: string
          email?: string
          id?: string
          ie?: string
          name: string
          neighborhood?: string
          phone: string
          state?: string
          trade_name?: string
          updated_at?: string
        }
        Update: {
          address?: string
          cep?: string
          city?: string
          cnpj?: string
          company_id?: string
          company_name?: string
          created_at?: string
          email?: string
          id?: string
          ie?: string
          name?: string
          neighborhood?: string
          phone?: string
          state?: string
          trade_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_er_reservations: {
        Row: {
          company_id: string
          er_code: string
          order_id: string
          reserved_at: string
          reserved_by: string
          used_at: string | null
        }
        Insert: {
          company_id: string
          er_code: string
          order_id: string
          reserved_at?: string
          reserved_by: string
          used_at?: string | null
        }
        Update: {
          company_id?: string
          er_code?: string
          order_id?: string
          reserved_at?: string
          reserved_by?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_er_reservations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_er_reservations_order_company_fkey"
            columns: ["company_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "delivery_er_reservations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      diary_evaluations: {
        Row: {
          commitment_grade: string
          company_id: string
          created_at: string
          diary_id: string
          employee_id: string
          id: string
          note: string | null
          pace_grade: string
          quality_grade: string
          updated_at: string
        }
        Insert: {
          commitment_grade: string
          company_id?: string
          created_at?: string
          diary_id: string
          employee_id: string
          id?: string
          note?: string | null
          pace_grade: string
          quality_grade: string
          updated_at?: string
        }
        Update: {
          commitment_grade?: string
          company_id?: string
          created_at?: string
          diary_id?: string
          employee_id?: string
          id?: string
          note?: string | null
          pace_grade?: string
          quality_grade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diary_evaluations_company_id_diary_id_fkey"
            columns: ["company_id", "diary_id"]
            isOneToOne: false
            referencedRelation: "production_diaries"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "diary_evaluations_company_id_employee_id_fkey"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "diary_evaluations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diary_evaluations_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "production_diaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diary_evaluations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      diary_occurrences: {
        Row: {
          company_id: string
          created_at: string
          description: string
          diary_id: string
          employee_id: string
          id: string
          occurrence_type: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          description: string
          diary_id: string
          employee_id: string
          id?: string
          occurrence_type: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string
          diary_id?: string
          employee_id?: string
          id?: string
          occurrence_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "diary_occurrences_company_id_diary_id_fkey"
            columns: ["company_id", "diary_id"]
            isOneToOne: false
            referencedRelation: "production_diaries"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "diary_occurrences_company_id_employee_id_fkey"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "diary_occurrences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diary_occurrences_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "production_diaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diary_occurrences_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      diary_other_activities: {
        Row: {
          activity: string
          company_id: string
          created_at: string
          diary_id: string
          employee_id: string
          id: string
          period: string | null
        }
        Insert: {
          activity: string
          company_id?: string
          created_at?: string
          diary_id: string
          employee_id: string
          id?: string
          period?: string | null
        }
        Update: {
          activity?: string
          company_id?: string
          created_at?: string
          diary_id?: string
          employee_id?: string
          id?: string
          period?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diary_other_activities_company_id_diary_id_fkey"
            columns: ["company_id", "diary_id"]
            isOneToOne: false
            referencedRelation: "production_diaries"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "diary_other_activities_company_id_employee_id_fkey"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "diary_other_activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diary_other_activities_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "production_diaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diary_other_activities_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          company_id: string
          created_at: string
          doc_type: string
          employee_id: string
          expires_at: string | null
          file_name: string | null
          id: string
          issued_at: string | null
          reference: string
          shared_meu360: boolean
          storage_path: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          doc_type: string
          employee_id: string
          expires_at?: string | null
          file_name?: string | null
          id?: string
          issued_at?: string | null
          reference: string
          shared_meu360?: boolean
          storage_path: string
        }
        Update: {
          company_id?: string
          created_at?: string
          doc_type?: string
          employee_id?: string
          expires_at?: string | null
          file_name?: string | null
          id?: string
          issued_at?: string | null
          reference?: string
          shared_meu360?: boolean
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_company_id_employee_id_fkey"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "employee_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_tasks: {
        Row: {
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          employee_id: string
          id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          employee_id: string
          id?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          employee_id?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_tasks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address_number: string | null
          admin_access_linked: boolean
          admin_access_role_label: string | null
          admin_access_scope: string | null
          admin_access_status: string | null
          admission_date: string | null
          advances_sample: number
          birth_date: string | null
          birthplace: string | null
          can_operate_production: boolean
          cep: string | null
          city: string | null
          code: string
          commission_rate_percent: number | null
          company_id: string
          complement: string | null
          cost_center: string | null
          cpf: string | null
          created_at: string
          department: string | null
          email: string | null
          emergency_name: string | null
          emergency_phone: string | null
          emergency_relationship: string | null
          employment_end_date: string | null
          employment_notes: string | null
          employment_regime: string | null
          employment_start_date: string | null
          employment_type: string | null
          id: string
          lotation_effective_date: string | null
          manager_id: string | null
          marital_status: string | null
          meu360_enabled: boolean
          monthly_divisor: number
          name: string
          nationality: string | null
          neighborhood: string | null
          notes: string | null
          overtime_minutes_sample: number
          personal_access_state: string
          personal_email: string | null
          phone: string | null
          photo_url: string | null
          pix_key: string | null
          rg: string | null
          rg_issuer: string | null
          role: string | null
          salary_additions: number
          salary_base: number | null
          salary_benefits: string | null
          salary_effective_date: string | null
          social_name: string | null
          state: string | null
          status: string
          street: string | null
          termination_date: string | null
          termination_reason: string | null
          timesheet_break: string | null
          timesheet_break_minutes: number
          timesheet_enabled: boolean
          timesheet_expected_end: string | null
          timesheet_expected_start: string | null
          timesheet_from: string | null
          timesheet_overtime_bank: string | null
          timesheet_overtime_mode: string | null
          timesheet_overtime_percent: number
          timesheet_pin_hash: string | null
          timesheet_schedule_label: string | null
          timesheet_standard_hours: string | null
          timesheet_tolerance_minutes: number
          timesheet_until: string | null
          timesheet_weekly_hours: string | null
          tool_links: Json
          unit_id: string | null
          updated_at: string
          work_location: string | null
        }
        Insert: {
          address_number?: string | null
          admin_access_linked?: boolean
          admin_access_role_label?: string | null
          admin_access_scope?: string | null
          admin_access_status?: string | null
          admission_date?: string | null
          advances_sample?: number
          birth_date?: string | null
          birthplace?: string | null
          can_operate_production?: boolean
          cep?: string | null
          city?: string | null
          code?: string
          commission_rate_percent?: number | null
          company_id?: string
          complement?: string | null
          cost_center?: string | null
          cpf?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          emergency_name?: string | null
          emergency_phone?: string | null
          emergency_relationship?: string | null
          employment_end_date?: string | null
          employment_notes?: string | null
          employment_regime?: string | null
          employment_start_date?: string | null
          employment_type?: string | null
          id?: string
          lotation_effective_date?: string | null
          manager_id?: string | null
          marital_status?: string | null
          meu360_enabled?: boolean
          monthly_divisor?: number
          name: string
          nationality?: string | null
          neighborhood?: string | null
          notes?: string | null
          overtime_minutes_sample?: number
          personal_access_state?: string
          personal_email?: string | null
          phone?: string | null
          photo_url?: string | null
          pix_key?: string | null
          rg?: string | null
          rg_issuer?: string | null
          role?: string | null
          salary_additions?: number
          salary_base?: number | null
          salary_benefits?: string | null
          salary_effective_date?: string | null
          social_name?: string | null
          state?: string | null
          status?: string
          street?: string | null
          termination_date?: string | null
          termination_reason?: string | null
          timesheet_break?: string | null
          timesheet_break_minutes?: number
          timesheet_enabled?: boolean
          timesheet_expected_end?: string | null
          timesheet_expected_start?: string | null
          timesheet_from?: string | null
          timesheet_overtime_bank?: string | null
          timesheet_overtime_mode?: string | null
          timesheet_overtime_percent?: number
          timesheet_pin_hash?: string | null
          timesheet_schedule_label?: string | null
          timesheet_standard_hours?: string | null
          timesheet_tolerance_minutes?: number
          timesheet_until?: string | null
          timesheet_weekly_hours?: string | null
          tool_links?: Json
          unit_id?: string | null
          updated_at?: string
          work_location?: string | null
        }
        Update: {
          address_number?: string | null
          admin_access_linked?: boolean
          admin_access_role_label?: string | null
          admin_access_scope?: string | null
          admin_access_status?: string | null
          admission_date?: string | null
          advances_sample?: number
          birth_date?: string | null
          birthplace?: string | null
          can_operate_production?: boolean
          cep?: string | null
          city?: string | null
          code?: string
          commission_rate_percent?: number | null
          company_id?: string
          complement?: string | null
          cost_center?: string | null
          cpf?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          emergency_name?: string | null
          emergency_phone?: string | null
          emergency_relationship?: string | null
          employment_end_date?: string | null
          employment_notes?: string | null
          employment_regime?: string | null
          employment_start_date?: string | null
          employment_type?: string | null
          id?: string
          lotation_effective_date?: string | null
          manager_id?: string | null
          marital_status?: string | null
          meu360_enabled?: boolean
          monthly_divisor?: number
          name?: string
          nationality?: string | null
          neighborhood?: string | null
          notes?: string | null
          overtime_minutes_sample?: number
          personal_access_state?: string
          personal_email?: string | null
          phone?: string | null
          photo_url?: string | null
          pix_key?: string | null
          rg?: string | null
          rg_issuer?: string | null
          role?: string | null
          salary_additions?: number
          salary_base?: number | null
          salary_benefits?: string | null
          salary_effective_date?: string | null
          social_name?: string | null
          state?: string | null
          status?: string
          street?: string | null
          termination_date?: string | null
          termination_reason?: string | null
          timesheet_break?: string | null
          timesheet_break_minutes?: number
          timesheet_enabled?: boolean
          timesheet_expected_end?: string | null
          timesheet_expected_start?: string | null
          timesheet_from?: string | null
          timesheet_overtime_bank?: string | null
          timesheet_overtime_mode?: string | null
          timesheet_overtime_percent?: number
          timesheet_pin_hash?: string | null
          timesheet_schedule_label?: string | null
          timesheet_standard_hours?: string | null
          timesheet_tolerance_minutes?: number
          timesheet_until?: string | null
          timesheet_weekly_hours?: string | null
          tool_links?: Json
          unit_id?: string | null
          updated_at?: string
          work_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_company_fkey"
            columns: ["company_id", "manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_unit_company_fkey"
            columns: ["company_id", "unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "employees_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      entitlements: {
        Row: {
          capability_key: string
          company_id: string
          created_at: string
          enabled: boolean
          ends_at: string | null
          id: string
          metadata: Json
          source: string
          starts_at: string
          updated_at: string
        }
        Insert: {
          capability_key: string
          company_id: string
          created_at?: string
          enabled?: boolean
          ends_at?: string | null
          id?: string
          metadata?: Json
          source?: string
          starts_at?: string
          updated_at?: string
        }
        Update: {
          capability_key?: string
          company_id?: string
          created_at?: string
          enabled?: boolean
          ends_at?: string | null
          id?: string
          metadata?: Json
          source?: string
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entitlements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          company_id: string
          competence: string | null
          created_at: string
          created_by: string
          description: string
          due_date: string | null
          employee_id: string | null
          id: string
          nature: string
          paid_amount: number | null
          paid_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string
          company_id?: string
          competence?: string | null
          created_at?: string
          created_by?: string
          description: string
          due_date?: string | null
          employee_id?: string | null
          id?: string
          nature?: string
          paid_amount?: number | null
          paid_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          company_id?: string
          competence?: string | null
          created_at?: string
          created_by?: string
          description?: string
          due_date?: string | null
          employee_id?: string | null
          id?: string
          nature?: string
          paid_amount?: number | null
          paid_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_documents: {
        Row: {
          billing_id: string
          company_id: string | null
          created_at: string
          external_id: string | null
          id: string
          key: string | null
          number: string | null
          pdf_ref: string | null
          status: string
          updated_at: string
          xml_ref: string | null
        }
        Insert: {
          billing_id: string
          company_id?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          key?: string | null
          number?: string | null
          pdf_ref?: string | null
          status?: string
          updated_at?: string
          xml_ref?: string | null
        }
        Update: {
          billing_id?: string
          company_id?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          key?: string | null
          number?: string | null
          pdf_ref?: string | null
          status?: string
          updated_at?: string
          xml_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_documents_billing_id_fkey"
            columns: ["billing_id"]
            isOneToOne: false
            referencedRelation: "billings"
            referencedColumns: ["id"]
          },
        ]
      }
      floor_execution_events: {
        Row: {
          company_id: string
          created_at: string
          employee_id: string | null
          event_type: string
          floor_execution_id: string
          id: string
          note: string | null
          quantity_delta: number | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          employee_id?: string | null
          event_type: string
          floor_execution_id: string
          id?: string
          note?: string | null
          quantity_delta?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          employee_id?: string | null
          event_type?: string
          floor_execution_id?: string
          id?: string
          note?: string | null
          quantity_delta?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "floor_execution_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floor_execution_events_floor_execution_id_fkey"
            columns: ["floor_execution_id"]
            isOneToOne: false
            referencedRelation: "floor_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      floor_executions: {
        Row: {
          assumed_at: string | null
          assumed_by_employee_id: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          id: string
          operational_quantity: number
          product_id: string
          production_record_id: string | null
          production_release_id: string | null
          route_version_label: string
          started_at: string | null
          status: string
          target_quantity: number
          unit_id: string
          updated_at: string
        }
        Insert: {
          assumed_at?: string | null
          assumed_by_employee_id?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          operational_quantity?: number
          product_id: string
          production_record_id?: string | null
          production_release_id?: string | null
          route_version_label?: string
          started_at?: string | null
          status?: string
          target_quantity: number
          unit_id?: string
          updated_at?: string
        }
        Update: {
          assumed_at?: string | null
          assumed_by_employee_id?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          operational_quantity?: number
          product_id?: string
          production_record_id?: string | null
          production_release_id?: string | null
          route_version_label?: string
          started_at?: string | null
          status?: string
          target_quantity?: number
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "floor_executions_assumed_by_employee_id_fkey"
            columns: ["assumed_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floor_executions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floor_executions_production_release_id_fkey"
            columns: ["production_release_id"]
            isOneToOne: false
            referencedRelation: "production_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      group_companies: {
        Row: {
          company_id: string
          created_at: string
          group_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          group_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_companies_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "business_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_membership_roles: {
        Row: {
          created_at: string
          group_id: string
          membership_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          membership_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          membership_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_membership_roles_group_id_membership_id_fkey"
            columns: ["group_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "group_memberships"
            referencedColumns: ["group_id", "id"]
          },
          {
            foreignKeyName: "group_membership_roles_group_id_role_id_fkey"
            columns: ["group_id", "role_id"]
            isOneToOne: false
            referencedRelation: "group_roles"
            referencedColumns: ["group_id", "id"]
          },
        ]
      }
      group_memberships: {
        Row: {
          created_at: string
          ends_at: string | null
          group_id: string
          id: string
          starts_at: string
          status: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          group_id: string
          id?: string
          starts_at?: string
          status?: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          group_id?: string
          id?: string
          starts_at?: string
          status?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "group_memberships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "business_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_permissions: {
        Row: {
          created_at: string
          description: string | null
          key: string
          name: string
          sensitivity: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
          name: string
          sensitivity?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          key?: string
          name?: string
          sensitivity?: string
        }
        Relationships: []
      }
      group_role_permissions: {
        Row: {
          created_at: string
          group_id: string
          permission_key: string
          role_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          permission_key: string
          role_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          permission_key?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_role_permissions_group_id_role_id_fkey"
            columns: ["group_id", "role_id"]
            isOneToOne: false
            referencedRelation: "group_roles"
            referencedColumns: ["group_id", "id"]
          },
          {
            foreignKeyName: "group_role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "group_permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      group_roles: {
        Row: {
          created_at: string
          description: string | null
          group_id: string
          id: string
          is_system: boolean
          key: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          group_id: string
          id?: string
          is_system?: boolean
          key: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          group_id?: string
          id?: string
          is_system?: boolean
          key?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_roles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "business_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      ibge_cities: {
        Row: {
          city_code: string
          city_name: string
          state_code: string
          state_name: string
        }
        Insert: {
          city_code: string
          city_name: string
          state_code: string
          state_name: string
        }
        Update: {
          city_code?: string
          city_name?: string
          state_code?: string
          state_name?: string
        }
        Relationships: []
      }
      installments: {
        Row: {
          amount: number
          company_id: string | null
          created_at: string
          days: number
          due_date: string
          id: string
          number: number
          payment_method_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          company_id?: string | null
          created_at?: string
          days?: number
          due_date: string
          id?: string
          number: number
          payment_method_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          company_id?: string | null
          created_at?: string
          days?: number
          due_date?: string
          id?: string
          number?: number
          payment_method_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "installments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      loading_jobs: {
        Row: {
          company_id: string
          completed_by: string | null
          created_at: string
          finished_at: string | null
          id: string
          order_id: string
          queued_at: string | null
          responsible: string | null
          started_at: string | null
          started_by: string | null
          status: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          completed_by?: string | null
          created_at?: string
          finished_at?: string | null
          id?: string
          order_id: string
          queued_at?: string | null
          responsible?: string | null
          started_at?: string | null
          started_by?: string | null
          status?: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          completed_by?: string | null
          created_at?: string
          finished_at?: string | null
          id?: string
          order_id?: string
          queued_at?: string | null
          responsible?: string | null
          started_at?: string | null
          started_by?: string | null
          status?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loading_jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loading_jobs_company_id_order_id_fkey"
            columns: ["company_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "loading_jobs_company_id_unit_id_fkey"
            columns: ["company_id", "unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "loading_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loading_jobs_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_roles: {
        Row: {
          company_id: string
          created_at: string
          membership_id: string
          role_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          membership_id: string
          role_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          membership_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_roles_company_id_membership_id_fkey"
            columns: ["company_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "membership_roles_company_id_role_id_fkey"
            columns: ["company_id", "role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      membership_unit_scopes: {
        Row: {
          company_id: string
          created_at: string
          membership_id: string
          unit_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          membership_id: string
          unit_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          membership_id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_unit_scopes_company_id_membership_id_fkey"
            columns: ["company_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "membership_unit_scopes_company_id_unit_id_fkey"
            columns: ["company_id", "unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      memberships: {
        Row: {
          company_id: string
          created_at: string
          ends_at: string | null
          id: string
          scope_mode: string
          starts_at: string
          status: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          company_id: string
          created_at?: string
          ends_at?: string | null
          id?: string
          scope_mode?: string
          starts_at?: string
          status?: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          scope_mode?: string
          starts_at?: string
          status?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "memberships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_closes: {
        Row: {
          checksum: string | null
          closed_at: string | null
          company_id: string
          competence: string
          created_at: string
          id: string
          pendencies: Json
          snapshot: Json
          status: string
        }
        Insert: {
          checksum?: string | null
          closed_at?: string | null
          company_id: string
          competence: string
          created_at?: string
          id?: string
          pendencies?: Json
          snapshot?: Json
          status: string
        }
        Update: {
          checksum?: string | null
          closed_at?: string | null
          company_id?: string
          competence?: string
          created_at?: string
          id?: string
          pendencies?: Json
          snapshot?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_closes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_checklists: {
        Row: {
          company_id: string
          created_at: string
          id: string
          items: Json
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          items?: Json
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          items?: Json
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_checklists_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      order_adjustment_requests: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          message: string
          order_id: string
          order_item_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          order_id: string
          order_item_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          order_id?: string
          order_item_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_adjustment_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_adjustment_requests_order_company_fkey"
            columns: ["company_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "order_adjustment_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_adjustment_requests_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_deliveries: {
        Row: {
          company_id: string
          created_at: string
          delivered_at: string
          delivered_by: string
          er_code: string
          id: string
          notes: string | null
          order_id: string
          pdf_path: string
          receiver_doc: string
          receiver_doc_type: string
          receiver_name: string
          receiver_role: string | null
          result: string
          signature_path: string
          total_not_delivered: number
        }
        Insert: {
          company_id: string
          created_at?: string
          delivered_at: string
          delivered_by: string
          er_code: string
          id?: string
          notes?: string | null
          order_id: string
          pdf_path: string
          receiver_doc: string
          receiver_doc_type: string
          receiver_name: string
          receiver_role?: string | null
          result: string
          signature_path: string
          total_not_delivered?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          delivered_at?: string
          delivered_by?: string
          er_code?: string
          id?: string
          notes?: string | null
          order_id?: string
          pdf_path?: string
          receiver_doc?: string
          receiver_doc_type?: string
          receiver_name?: string
          receiver_role?: string | null
          result?: string
          signature_path?: string
          total_not_delivered?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_deliveries_er_code_fkey"
            columns: ["er_code"]
            isOneToOne: true
            referencedRelation: "delivery_er_reservations"
            referencedColumns: ["er_code"]
          },
          {
            foreignKeyName: "order_deliveries_order_company_fkey"
            columns: ["company_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "order_deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_delivery_items: {
        Row: {
          company_id: string
          delivery_id: string
          id: string
          order_item_id: string
          pack_price: number
          pack_quantity: number
          packs_not_delivered: number
          packs_ordered: number
          presentation: string
          product_name: string
          reason: string
          reason_detail: string | null
          value_delivered: number
          value_not_delivered: number
        }
        Insert: {
          company_id: string
          delivery_id: string
          id?: string
          order_item_id: string
          pack_price: number
          pack_quantity: number
          packs_not_delivered: number
          packs_ordered: number
          presentation?: string
          product_name: string
          reason: string
          reason_detail?: string | null
          value_delivered: number
          value_not_delivered: number
        }
        Update: {
          company_id?: string
          delivery_id?: string
          id?: string
          order_item_id?: string
          pack_price?: number
          pack_quantity?: number
          packs_not_delivered?: number
          packs_ordered?: number
          presentation?: string
          product_name?: string
          reason?: string
          reason_detail?: string | null
          value_delivered?: number
          value_not_delivered?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_delivery_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_delivery_items_delivery_company_fkey"
            columns: ["company_id", "delivery_id"]
            isOneToOne: false
            referencedRelation: "order_deliveries"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "order_delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "order_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_delivery_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          company_id: string
          created_at: string
          id: string
          loaded_at: string | null
          order_id: string
          pack_quantity: number
          packs_quantity: number
          presentation: string
          product_id: string | null
          product_name: string
          separated_at: string | null
          total_price: number
          total_units: number
          unit_price: number
          weight_volume: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          loaded_at?: string | null
          order_id: string
          pack_quantity: number
          packs_quantity: number
          presentation: string
          product_id?: string | null
          product_name: string
          separated_at?: string | null
          total_price: number
          total_units: number
          unit_price: number
          weight_volume: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          loaded_at?: string | null
          order_id?: string
          pack_quantity?: number
          packs_quantity?: number
          presentation?: string
          product_id?: string | null
          product_name?: string
          separated_at?: string | null
          total_price?: number
          total_units?: number
          unit_price?: number
          weight_volume?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_company_fkey"
            columns: ["company_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_company_fkey"
            columns: ["company_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          company_id: string
          company_name: string
          coupon_code: string
          coupon_type: string
          coupon_value: number
          created_at: string
          customer_address: string
          customer_cep: string
          customer_city: string
          customer_cnpj: string
          customer_email: string
          customer_id: string | null
          customer_ie: string
          customer_name: string
          customer_neighborhood: string
          customer_state: string
          customer_trade_name: string
          delivery_confirmed_at: string | null
          delivery_confirmed_by: string | null
          delivery_result: string | null
          delivery_signature_url: string | null
          discount_amount: number
          id: string
          loading_completed_by: string | null
          loading_finished_at: string | null
          loading_queued_at: string | null
          loading_responsible: string | null
          loading_started_at: string | null
          loading_started_by: string | null
          order_number: string
          payment_terms: string
          phone: string
          seller_employee_id: string | null
          separation_completed_by: string | null
          separation_finished_at: string | null
          separation_queued_at: string | null
          separation_responsible: string | null
          separation_started_at: string | null
          separation_started_by: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal_amount: number
          total_amount: number
          total_units: number
          updated_at: string
        }
        Insert: {
          company_id?: string
          company_name?: string
          coupon_code?: string
          coupon_type?: string
          coupon_value?: number
          created_at?: string
          customer_address?: string
          customer_cep?: string
          customer_city?: string
          customer_cnpj?: string
          customer_email?: string
          customer_id?: string | null
          customer_ie?: string
          customer_name: string
          customer_neighborhood?: string
          customer_state?: string
          customer_trade_name?: string
          delivery_confirmed_at?: string | null
          delivery_confirmed_by?: string | null
          delivery_result?: string | null
          delivery_signature_url?: string | null
          discount_amount?: number
          id?: string
          loading_completed_by?: string | null
          loading_finished_at?: string | null
          loading_queued_at?: string | null
          loading_responsible?: string | null
          loading_started_at?: string | null
          loading_started_by?: string | null
          order_number?: string
          payment_terms?: string
          phone: string
          seller_employee_id?: string | null
          separation_completed_by?: string | null
          separation_finished_at?: string | null
          separation_queued_at?: string | null
          separation_responsible?: string | null
          separation_started_at?: string | null
          separation_started_by?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_amount?: number
          total_amount?: number
          total_units?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          company_name?: string
          coupon_code?: string
          coupon_type?: string
          coupon_value?: number
          created_at?: string
          customer_address?: string
          customer_cep?: string
          customer_city?: string
          customer_cnpj?: string
          customer_email?: string
          customer_id?: string | null
          customer_ie?: string
          customer_name?: string
          customer_neighborhood?: string
          customer_state?: string
          customer_trade_name?: string
          delivery_confirmed_at?: string | null
          delivery_confirmed_by?: string | null
          delivery_result?: string | null
          delivery_signature_url?: string | null
          discount_amount?: number
          id?: string
          loading_completed_by?: string | null
          loading_finished_at?: string | null
          loading_queued_at?: string | null
          loading_responsible?: string | null
          loading_started_at?: string | null
          loading_started_by?: string | null
          order_number?: string
          payment_terms?: string
          phone?: string
          seller_employee_id?: string | null
          separation_completed_by?: string | null
          separation_finished_at?: string | null
          separation_queued_at?: string | null
          separation_responsible?: string | null
          separation_started_at?: string | null
          separation_started_by?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_amount?: number
          total_amount?: number
          total_units?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_company_fkey"
            columns: ["company_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_seller_employee_id_fkey"
            columns: ["seller_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_contributions: {
        Row: {
          amount: number
          company_id: string | null
          created_at: string
          created_by: string
          expense_id: string | null
          id: string
          notes: string | null
          origin: string
          partner_id: string
          planned_date: string | null
          realized_date: string | null
          reversed_contribution_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          company_id?: string | null
          created_at?: string
          created_by?: string
          expense_id?: string | null
          id?: string
          notes?: string | null
          origin: string
          partner_id: string
          planned_date?: string | null
          realized_date?: string | null
          reversed_contribution_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          company_id?: string | null
          created_at?: string
          created_by?: string
          expense_id?: string | null
          id?: string
          notes?: string | null
          origin?: string
          partner_id?: string
          planned_date?: string | null
          realized_date?: string | null
          reversed_contribution_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_contributions_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_contributions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "company_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_contributions_reversed_contribution_id_fkey"
            columns: ["reversed_contribution_id"]
            isOneToOne: false
            referencedRelation: "partner_contributions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          amount: number
          auto_messages: boolean
          billing_id: string
          company_id: string | null
          condition: string | null
          created_at: string
          fees: Json
          generates_credit: boolean
          id: string
          type: string
        }
        Insert: {
          amount: number
          auto_messages?: boolean
          billing_id: string
          company_id?: string | null
          condition?: string | null
          created_at?: string
          fees?: Json
          generates_credit?: boolean
          id?: string
          type: string
        }
        Update: {
          amount?: number
          auto_messages?: boolean
          billing_id?: string
          company_id?: string | null
          condition?: string | null
          created_at?: string
          fees?: Json
          generates_credit?: boolean
          id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_billing_id_fkey"
            columns: ["billing_id"]
            isOneToOne: false
            referencedRelation: "billings"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          created_at: string
          description: string | null
          key: string
          name: string
          sensitivity: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
          name: string
          sensitivity?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          key?: string
          name?: string
          sensitivity?: string
        }
        Relationships: []
      }
      plan_versions: {
        Row: {
          created_at: string
          effective_at: string | null
          id: string
          plan_id: string
          status: string
          version: number
        }
        Insert: {
          created_at?: string
          effective_at?: string | null
          id?: string
          plan_id: string
          status?: string
          version: number
        }
        Update: {
          created_at?: string
          effective_at?: string | null
          id?: string
          plan_id?: string
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_versions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_recipe: {
        Row: {
          company_id: string
          created_at: string
          id: string
          product_id: string
          quantity_per_unit: number
          raw_material_id: string
          updated_at: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          id?: string
          product_id: string
          quantity_per_unit: number
          raw_material_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          product_id?: string
          quantity_per_unit?: number
          raw_material_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_recipe_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recipe_material_company_fkey"
            columns: ["company_id", "raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "product_recipe_product_company_fkey"
            columns: ["company_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "product_recipe_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recipe_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      production_consumptions: {
        Row: {
          company_id: string
          consumed_quantity: number
          created_at: string
          id: string
          needed_quantity: number
          new_balance: number
          previous_balance: number
          production_record_id: string
          raw_material_id: string
        }
        Insert: {
          company_id?: string
          consumed_quantity: number
          created_at?: string
          id?: string
          needed_quantity: number
          new_balance: number
          previous_balance: number
          production_record_id: string
          raw_material_id: string
        }
        Update: {
          company_id?: string
          consumed_quantity?: number
          created_at?: string
          id?: string
          needed_quantity?: number
          new_balance?: number
          previous_balance?: number
          production_record_id?: string
          raw_material_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_consumptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_consumptions_material_company_fkey"
            columns: ["company_id", "raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "production_consumptions_production_record_id_fkey"
            columns: ["production_record_id"]
            isOneToOne: false
            referencedRelation: "production_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_consumptions_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_consumptions_record_company_fkey"
            columns: ["company_id", "production_record_id"]
            isOneToOne: false
            referencedRelation: "production_records"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      production_diaries: {
        Row: {
          closed_at: string | null
          company_id: string
          created_at: string
          general_note: string | null
          id: string
          local_date: string
          status: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          company_id?: string
          created_at?: string
          general_note?: string | null
          id?: string
          local_date: string
          status?: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          company_id?: string
          created_at?: string
          general_note?: string | null
          id?: string
          local_date?: string
          status?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_diaries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_diaries_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      production_participants: {
        Row: {
          allocated_units: number
          company_id: string
          created_at: string
          employee_id: string
          id: string
          production_record_id: string
        }
        Insert: {
          allocated_units: number
          company_id: string
          created_at?: string
          employee_id: string
          id?: string
          production_record_id: string
        }
        Update: {
          allocated_units?: number
          company_id?: string
          created_at?: string
          employee_id?: string
          id?: string
          production_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_participants_company_id_employee_id_fkey"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "production_participants_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_participants_company_id_production_record_id_fkey"
            columns: ["company_id", "production_record_id"]
            isOneToOne: false
            referencedRelation: "production_records"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "production_participants_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_participants_production_record_id_fkey"
            columns: ["production_record_id"]
            isOneToOne: false
            referencedRelation: "production_records"
            referencedColumns: ["id"]
          },
        ]
      }
      production_records: {
        Row: {
          company_id: string
          confirmed_at: string
          created_at: string
          floor_execution_id: string | null
          id: string
          idempotency_key: string | null
          packs_quantity: number
          product_id: string
          responsible_id: string | null
          status: string
          unit_id: string
          units_quantity: number
          updated_at: string
          urgent_allocated_units: number
          urgent_demand_id: string | null
        }
        Insert: {
          company_id?: string
          confirmed_at?: string
          created_at?: string
          floor_execution_id?: string | null
          id?: string
          idempotency_key?: string | null
          packs_quantity: number
          product_id: string
          responsible_id?: string | null
          status?: string
          unit_id?: string
          units_quantity: number
          updated_at?: string
          urgent_allocated_units?: number
          urgent_demand_id?: string | null
        }
        Update: {
          company_id?: string
          confirmed_at?: string
          created_at?: string
          floor_execution_id?: string | null
          id?: string
          idempotency_key?: string | null
          packs_quantity?: number
          product_id?: string
          responsible_id?: string | null
          status?: string
          unit_id?: string
          units_quantity?: number
          updated_at?: string
          urgent_allocated_units?: number
          urgent_demand_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_records_floor_execution_id_fkey"
            columns: ["floor_execution_id"]
            isOneToOne: false
            referencedRelation: "floor_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_records_product_company_fkey"
            columns: ["company_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "production_records_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_records_unit_company_fkey"
            columns: ["company_id", "unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "production_records_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_records_urgent_company_fkey"
            columns: ["company_id", "urgent_demand_id"]
            isOneToOne: false
            referencedRelation: "urgent_demands"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "production_records_urgent_demand_id_fkey"
            columns: ["urgent_demand_id"]
            isOneToOne: false
            referencedRelation: "urgent_demands"
            referencedColumns: ["id"]
          },
        ]
      }
      production_releases: {
        Row: {
          company_id: string
          created_at: string
          created_by_user_id: string | null
          id: string
          idempotency_key: string
          note: string | null
          origin: string
          product_id: string
          reason: string | null
          requested_packs: number
          requested_units: number
          unit_id: string
          urgent_demand_id: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          idempotency_key: string
          note?: string | null
          origin?: string
          product_id: string
          reason?: string | null
          requested_packs: number
          requested_units: number
          unit_id?: string
          urgent_demand_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          idempotency_key?: string
          note?: string | null
          origin?: string
          product_id?: string
          reason?: string | null
          requested_packs?: number
          requested_units?: number
          unit_id?: string
          urgent_demand_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_releases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_releases_urgent_demand_id_fkey"
            columns: ["urgent_demand_id"]
            isOneToOne: false
            referencedRelation: "urgent_demands"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          badge: string | null
          brand: string
          category_id: string
          code: string | null
          company_id: string
          created_at: string
          current_stock: number
          description: string
          gtin: string
          id: string
          image_url: string
          is_active: boolean
          max_stock: number
          min_stock: number
          name: string
          ncm: string
          pack_quantity: number
          packaging_type: string
          presentation: string
          supplier_id: string | null
          target_margin_pct: number
          unit_price: number
          unit_weight_grams: number | null
          updated_at: string
          weight_volume: string
        }
        Insert: {
          badge?: string | null
          brand?: string
          category_id: string
          code?: string | null
          company_id?: string
          created_at?: string
          current_stock?: number
          description?: string
          gtin?: string
          id?: string
          image_url?: string
          is_active?: boolean
          max_stock?: number
          min_stock?: number
          name: string
          ncm?: string
          pack_quantity: number
          packaging_type: string
          presentation: string
          supplier_id?: string | null
          target_margin_pct?: number
          unit_price: number
          unit_weight_grams?: number | null
          updated_at?: string
          weight_volume: string
        }
        Update: {
          badge?: string | null
          brand?: string
          category_id?: string
          code?: string | null
          company_id?: string
          created_at?: string
          current_stock?: number
          description?: string
          gtin?: string
          id?: string
          image_url?: string
          is_active?: boolean
          max_stock?: number
          min_stock?: number
          name?: string
          ncm?: string
          pack_quantity?: number
          packaging_type?: string
          presentation?: string
          supplier_id?: string | null
          target_margin_pct?: number
          unit_price?: number
          unit_weight_grams?: number | null
          updated_at?: string
          weight_volume?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_company_fkey"
            columns: ["company_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_company_fkey"
            columns: ["company_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_material_categories: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_material_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_material_entries: {
        Row: {
          batch: string
          company_id: string
          control_quantity: number | null
          conversion_factor: number | null
          created_at: string
          entry_date: string
          expiry_date: string
          id: string
          invoice_access_key: string
          invoice_issue_date: string | null
          invoice_number: string
          invoice_series: string
          new_balance: number | null
          packages_quantity: number
          previous_balance: number | null
          raw_material_id: string
          responsible_id: string | null
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          status: string
          supplier_id: string
          total_value: number | null
          unit_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          batch: string
          company_id?: string
          control_quantity?: number | null
          conversion_factor?: number | null
          created_at?: string
          entry_date?: string
          expiry_date: string
          id?: string
          invoice_access_key?: string
          invoice_issue_date?: string | null
          invoice_number?: string
          invoice_series?: string
          new_balance?: number | null
          packages_quantity: number
          previous_balance?: number | null
          raw_material_id: string
          responsible_id?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: string
          supplier_id: string
          total_value?: number | null
          unit_id?: string
          unit_price: number
          updated_at?: string
        }
        Update: {
          batch?: string
          company_id?: string
          control_quantity?: number | null
          conversion_factor?: number | null
          created_at?: string
          entry_date?: string
          expiry_date?: string
          id?: string
          invoice_access_key?: string
          invoice_issue_date?: string | null
          invoice_number?: string
          invoice_series?: string
          new_balance?: number | null
          packages_quantity?: number
          previous_balance?: number | null
          raw_material_id?: string
          responsible_id?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: string
          supplier_id?: string
          total_value?: number | null
          unit_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_material_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_material_entries_material_company_fkey"
            columns: ["company_id", "raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "raw_material_entries_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_material_entries_supplier_company_fkey"
            columns: ["company_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "raw_material_entries_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_material_entries_unit_company_fkey"
            columns: ["company_id", "unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "raw_material_entries_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_materials: {
        Row: {
          avg_cost: number
          category: string
          code: string
          company_id: string
          control_unit: string
          cost_basis: string
          created_at: string
          current_stock: number
          default_reorder_qty: number
          description: string
          id: string
          image_url: string
          is_active: boolean
          lead_time_days: number
          manual_cost: number
          max_stock: number
          min_purchase_qty: number
          min_stock: number
          name: string
          primary_supplier_id: string | null
          purchase_multiple: number
          purchase_unit_factor: number
          purchase_unit_label: string
          unit_locked: boolean
          updated_at: string
        }
        Insert: {
          avg_cost?: number
          category?: string
          code?: string
          company_id?: string
          control_unit: string
          cost_basis?: string
          created_at?: string
          current_stock?: number
          default_reorder_qty?: number
          description?: string
          id?: string
          image_url?: string
          is_active?: boolean
          lead_time_days?: number
          manual_cost?: number
          max_stock?: number
          min_purchase_qty?: number
          min_stock?: number
          name: string
          primary_supplier_id?: string | null
          purchase_multiple?: number
          purchase_unit_factor?: number
          purchase_unit_label?: string
          unit_locked?: boolean
          updated_at?: string
        }
        Update: {
          avg_cost?: number
          category?: string
          code?: string
          company_id?: string
          control_unit?: string
          cost_basis?: string
          created_at?: string
          current_stock?: number
          default_reorder_qty?: number
          description?: string
          id?: string
          image_url?: string
          is_active?: boolean
          lead_time_days?: number
          manual_cost?: number
          max_stock?: number
          min_purchase_qty?: number
          min_stock?: number
          name?: string
          primary_supplier_id?: string | null
          purchase_multiple?: number
          purchase_unit_factor?: number
          purchase_unit_label?: string
          unit_locked?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_materials_primary_supplier_id_fkey"
            columns: ["primary_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_materials_supplier_company_fkey"
            columns: ["company_id", "primary_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      receivables: {
        Row: {
          amount: number
          billing_id: string
          company_id: string | null
          created_at: string
          customer_id: string
          due_date: string
          id: string
          installment_id: string | null
          paid_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          billing_id: string
          company_id?: string | null
          created_at?: string
          customer_id: string
          due_date: string
          id?: string
          installment_id?: string | null
          paid_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_id?: string
          company_id?: string | null
          created_at?: string
          customer_id?: string
          due_date?: string
          id?: string
          installment_id?: string | null
          paid_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivables_billing_id_fkey"
            columns: ["billing_id"]
            isOneToOne: false
            referencedRelation: "billings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_receipts: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string
          discount: number
          effective_date: string
          external_movement_id: string | null
          id: string
          interest_penalty: number
          principal_received: number
          receivable_id: string
          received_amount: number
          reversed_receipt_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string
          discount?: number
          effective_date: string
          external_movement_id?: string | null
          id?: string
          interest_penalty?: number
          principal_received?: number
          receivable_id: string
          received_amount: number
          reversed_receipt_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string
          discount?: number
          effective_date?: string
          external_movement_id?: string | null
          id?: string
          interest_penalty?: number
          principal_received?: number
          receivable_id?: string
          received_amount?: number
          reversed_receipt_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revenue_receipts_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "revenue_receivables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_receipts_reversed_receipt_id_fkey"
            columns: ["reversed_receipt_id"]
            isOneToOne: false
            referencedRelation: "revenue_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_receivables: {
        Row: {
          account_id: string | null
          company_id: string | null
          created_at: string
          due_date: string
          effective_date: string | null
          id: string
          installment_number: number
          open_balance: number
          principal: number
          revenue_id: string
          status: string
          total_installments: number
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          company_id?: string | null
          created_at?: string
          due_date: string
          effective_date?: string | null
          id?: string
          installment_number?: number
          open_balance: number
          principal: number
          revenue_id: string
          status?: string
          total_installments?: number
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          company_id?: string | null
          created_at?: string
          due_date?: string
          effective_date?: string | null
          id?: string
          installment_number?: number
          open_balance?: number
          principal?: number
          revenue_id?: string
          status?: string
          total_installments?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_receivables_revenue_id_fkey"
            columns: ["revenue_id"]
            isOneToOne: false
            referencedRelation: "revenues"
            referencedColumns: ["id"]
          },
        ]
      }
      revenues: {
        Row: {
          category: string
          company_id: string
          competence: string
          created_at: string
          created_by: string
          description: string
          id: string
          notes: string | null
          origin: string
          payer_origin_id: string | null
          principal_amount: number
          recurrence_rule: Json | null
          updated_at: string
        }
        Insert: {
          category?: string
          company_id?: string
          competence: string
          created_at?: string
          created_by?: string
          description: string
          id?: string
          notes?: string | null
          origin?: string
          payer_origin_id?: string | null
          principal_amount: number
          recurrence_rule?: Json | null
          updated_at?: string
        }
        Update: {
          category?: string
          company_id?: string
          competence?: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          notes?: string | null
          origin?: string
          payer_origin_id?: string | null
          principal_amount?: number
          recurrence_rule?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenues_payer_origin_id_fkey"
            columns: ["payer_origin_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          company_id: string
          created_at: string
          permission_key: string
          role_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          permission_key: string
          role_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          permission_key?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_company_id_role_id_fkey"
            columns: ["company_id", "role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      roles: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          key: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_advances: {
        Row: {
          amount: number
          company_id: string | null
          created_at: string
          created_by: string
          id: string
          paid_at: string | null
          requested_at: string
          reversed_advance_id: string | null
          salary_obligation_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          company_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          paid_at?: string | null
          requested_at?: string
          reversed_advance_id?: string | null
          salary_obligation_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          company_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          paid_at?: string | null
          requested_at?: string
          reversed_advance_id?: string | null
          salary_obligation_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_advances_reversed_advance_id_fkey"
            columns: ["reversed_advance_id"]
            isOneToOne: false
            referencedRelation: "salary_advances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_advances_salary_obligation_id_fkey"
            columns: ["salary_obligation_id"]
            isOneToOne: false
            referencedRelation: "salary_obligations"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_obligations: {
        Row: {
          base_salary: number
          company_id: string | null
          competence: string
          created_at: string
          employee_id: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          base_salary: number
          company_id?: string | null
          competence: string
          created_at?: string
          employee_id: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          base_salary?: number
          company_id?: string | null
          competence?: string
          created_at?: string
          employee_id?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_obligations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_commissions: {
        Row: {
          commission_amount: number
          commission_rate: number
          company_id: string
          created_at: string
          due_date: string
          employee_id: string
          id: string
          installment_number: number | null
          order_id: string
          realized_at: string | null
          receivable_id: string
          sale_amount: number
          status: string
          updated_at: string
        }
        Insert: {
          commission_amount: number
          commission_rate: number
          company_id: string
          created_at?: string
          due_date: string
          employee_id: string
          id?: string
          installment_number?: number | null
          order_id: string
          realized_at?: string | null
          receivable_id: string
          sale_amount: number
          status?: string
          updated_at?: string
        }
        Update: {
          commission_amount?: number
          commission_rate?: number
          company_id?: string
          created_at?: string
          due_date?: string
          employee_id?: string
          id?: string
          installment_number?: number | null
          order_id?: string
          realized_at?: string | null
          receivable_id?: string
          sale_amount?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_commissions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_commissions_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: true
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
        ]
      }
      separation_jobs: {
        Row: {
          company_id: string
          completed_by: string | null
          created_at: string
          finished_at: string | null
          id: string
          order_id: string
          queued_at: string | null
          responsible: string | null
          started_at: string | null
          started_by: string | null
          status: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          completed_by?: string | null
          created_at?: string
          finished_at?: string | null
          id?: string
          order_id: string
          queued_at?: string | null
          responsible?: string | null
          started_at?: string | null
          started_by?: string | null
          status?: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          completed_by?: string | null
          created_at?: string
          finished_at?: string | null
          id?: string
          order_id?: string
          queued_at?: string | null
          responsible?: string | null
          started_at?: string | null
          started_by?: string | null
          status?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "separation_jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "separation_jobs_company_id_order_id_fkey"
            columns: ["company_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "separation_jobs_company_id_unit_id_fkey"
            columns: ["company_id", "unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "separation_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "separation_jobs_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          business_hours: string
          cep: string
          city_code: string
          city_name: string
          cnae_code: string
          cnae_description: string
          cnpj: string
          company_id: string
          complement: string
          country: string
          created_at: string
          effective_rate: number
          factory_name: string
          fantasy_name: string
          hero_image_url: string
          ibge_code: string
          id: string
          ie: string
          legal_name: string
          municipal_registration: string
          neighborhood: string
          number: string
          rbt12: number
          reference_competence: string
          schedule_annex: string
          state_code: string
          state_name: string
          street: string
          tax_regime: string
          updated_at: string
          whatsapp_display: string
          whatsapp_number: string
        }
        Insert: {
          business_hours?: string
          cep?: string
          city_code?: string
          city_name?: string
          cnae_code?: string
          cnae_description?: string
          cnpj?: string
          company_id?: string
          complement?: string
          country?: string
          created_at?: string
          effective_rate?: number
          factory_name?: string
          fantasy_name?: string
          hero_image_url?: string
          ibge_code?: string
          id?: string
          ie?: string
          legal_name?: string
          municipal_registration?: string
          neighborhood?: string
          number?: string
          rbt12?: number
          reference_competence?: string
          schedule_annex?: string
          state_code?: string
          state_name?: string
          street?: string
          tax_regime?: string
          updated_at?: string
          whatsapp_display?: string
          whatsapp_number?: string
        }
        Update: {
          business_hours?: string
          cep?: string
          city_code?: string
          city_name?: string
          cnae_code?: string
          cnae_description?: string
          cnpj?: string
          company_id?: string
          complement?: string
          country?: string
          created_at?: string
          effective_rate?: number
          factory_name?: string
          fantasy_name?: string
          hero_image_url?: string
          ibge_code?: string
          id?: string
          ie?: string
          legal_name?: string
          municipal_registration?: string
          neighborhood?: string
          number?: string
          rbt12?: number
          reference_competence?: string
          schedule_annex?: string
          state_code?: string
          state_name?: string
          street?: string
          tax_regime?: string
          updated_at?: string
          whatsapp_display?: string
          whatsapp_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          company_id: string
          created_at: string
          id: string
          new_balance: number
          observation: string
          origin: string
          previous_balance: number
          product_id: string
          reference_id: string | null
          responsible_id: string | null
          unit_id: string
          variation: number
        }
        Insert: {
          company_id?: string
          created_at?: string
          id?: string
          new_balance: number
          observation?: string
          origin: string
          previous_balance: number
          product_id: string
          reference_id?: string | null
          responsible_id?: string | null
          unit_id?: string
          variation: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          new_balance?: number
          observation?: string
          origin?: string
          previous_balance?: number
          product_id?: string
          reference_id?: string | null
          responsible_id?: string | null
          unit_id?: string
          variation?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_company_fkey"
            columns: ["company_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_unit_company_fkey"
            columns: ["company_id", "unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "stock_movements_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          company_id: string
          created_at: string
          ends_at: string | null
          id: string
          plan_version_id: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          ends_at?: string | null
          id?: string
          plan_version_id: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          plan_version_id?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_version_id_fkey"
            columns: ["plan_version_id"]
            isOneToOne: false
            referencedRelation: "plan_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string
          cep: string
          city: string
          cnpj: string
          company_id: string
          company_name: string
          created_at: string
          email: string
          id: string
          ie: string
          name: string
          neighborhood: string
          phone: string
          state: string
          trade_name: string
          updated_at: string
        }
        Insert: {
          address?: string
          cep?: string
          city?: string
          cnpj?: string
          company_id?: string
          company_name: string
          created_at?: string
          email?: string
          id?: string
          ie?: string
          name: string
          neighborhood?: string
          phone: string
          state?: string
          trade_name?: string
          updated_at?: string
        }
        Update: {
          address?: string
          cep?: string
          city?: string
          cnpj?: string
          company_id?: string
          company_name?: string
          created_at?: string
          email?: string
          id?: string
          ie?: string
          name?: string
          neighborhood?: string
          phone?: string
          state?: string
          trade_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      time_adjustments: {
        Row: {
          adjustment_date: string
          after_value: string
          before_value: string | null
          company_id: string | null
          created_at: string
          created_by: string
          employee_id: string
          field_changed: string
          id: string
          punch_id: string | null
          reason: string
        }
        Insert: {
          adjustment_date: string
          after_value: string
          before_value?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string
          employee_id: string
          field_changed: string
          id?: string
          punch_id?: string | null
          reason: string
        }
        Update: {
          adjustment_date?: string
          after_value?: string
          before_value?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string
          employee_id?: string
          field_changed?: string
          id?: string
          punch_id?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_adjustments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_adjustments_punch_id_fkey"
            columns: ["punch_id"]
            isOneToOne: false
            referencedRelation: "time_punches"
            referencedColumns: ["id"]
          },
        ]
      }
      time_bank_entries: {
        Row: {
          amount: number | null
          company_id: string | null
          competencia: string | null
          created_at: string
          created_by: string
          employee_id: string
          expense_id: string | null
          id: string
          minutes: number
          type: string
        }
        Insert: {
          amount?: number | null
          company_id?: string | null
          competencia?: string | null
          created_at?: string
          created_by?: string
          employee_id: string
          expense_id?: string | null
          id?: string
          minutes: number
          type: string
        }
        Update: {
          amount?: number | null
          company_id?: string | null
          competencia?: string | null
          created_at?: string
          created_by?: string
          employee_id?: string
          expense_id?: string | null
          id?: string
          minutes?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_bank_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_bank_entries_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      time_devices: {
        Row: {
          company_id: string
          created_at: string
          credential_hash: string
          id: string
          label: string
          revoked_at: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          credential_hash: string
          id?: string
          label: string
          revoked_at?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          credential_hash?: string
          id?: string
          label?: string
          revoked_at?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_devices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_devices_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      time_occurrences: {
        Row: {
          company_id: string | null
          created_at: string
          employee_id: string
          id: string
          occurrence_date: string
          occurrence_type: string
          priority: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          employee_id: string
          id?: string
          occurrence_date: string
          occurrence_type: string
          priority?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          occurrence_date?: string
          occurrence_type?: string
          priority?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_occurrences_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      time_period_states: {
        Row: {
          company_id: string | null
          competencia: string
          consolidated_at: string | null
          created_at: string
          employee_id: string
          id: string
          revision_number: number
          status: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          competencia: string
          consolidated_at?: string | null
          created_at?: string
          employee_id: string
          id?: string
          revision_number?: number
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          competencia?: string
          consolidated_at?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          revision_number?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_period_states_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      time_punches: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string
          device_id: string
          device_reported_time: string | null
          employee_id: string
          id: string
          idempotency_key: string
          location: Json | null
          photo_path: string
          server_time: string
          type: Database["public"]["Enums"]["time_punch_type"]
          unit_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string
          device_id: string
          device_reported_time?: string | null
          employee_id: string
          id?: string
          idempotency_key: string
          location?: Json | null
          photo_path: string
          server_time?: string
          type: Database["public"]["Enums"]["time_punch_type"]
          unit_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string
          device_id?: string
          device_reported_time?: string | null
          employee_id?: string
          id?: string
          idempotency_key?: string
          location?: Json | null
          photo_path?: string
          server_time?: string
          type?: Database["public"]["Enums"]["time_punch_type"]
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_punches_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "time_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_punches_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      transactional_outbox: {
        Row: {
          actor_type: string
          actor_user_id: string | null
          attempts: number
          causation_id: string | null
          company_id: string | null
          correlation_id: string
          employee_id: string | null
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          idempotency_key: string | null
          last_error: string | null
          next_attempt_at: string | null
          occurred_at: string
          payload: Json
          published_at: string | null
          recorded_at: string
          schema_version: number
          status: string
          unit_id: string | null
        }
        Insert: {
          actor_type: string
          actor_user_id?: string | null
          attempts?: number
          causation_id?: string | null
          company_id?: string | null
          correlation_id?: string
          employee_id?: string | null
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          next_attempt_at?: string | null
          occurred_at?: string
          payload?: Json
          published_at?: string | null
          recorded_at?: string
          schema_version?: number
          status?: string
          unit_id?: string | null
        }
        Update: {
          actor_type?: string
          actor_user_id?: string | null
          attempts?: number
          causation_id?: string | null
          company_id?: string | null
          correlation_id?: string
          employee_id?: string | null
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          next_attempt_at?: string | null
          occurred_at?: string
          payload?: Json
          published_at?: string | null
          recorded_at?: string
          schema_version?: number
          status?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactional_outbox_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactional_outbox_company_id_unit_id_fkey"
            columns: ["company_id", "unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      units: {
        Row: {
          company_id: string
          created_at: string
          document: string | null
          id: string
          name: string
          status: string
          timezone: string
          updated_at: string
          version: number
        }
        Insert: {
          company_id: string
          created_at?: string
          document?: string | null
          id?: string
          name: string
          status?: string
          timezone?: string
          updated_at?: string
          version?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          document?: string | null
          id?: string
          name?: string
          status?: string
          timezone?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "units_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      urgent_demands: {
        Row: {
          company_id: string
          created_at: string
          done_quantity: number
          id: string
          name: string
          product_id: string
          status: string
          total_quantity: number
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          done_quantity?: number
          id?: string
          name: string
          product_id: string
          status?: string
          total_quantity: number
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          done_quantity?: number
          id?: string
          name?: string
          product_id?: string
          status?: string
          total_quantity?: number
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "urgent_demands_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "urgent_demands_company_id_product_id_fkey"
            columns: ["company_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "urgent_demands_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "urgent_demands_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_stock: {
        Args: {
          p_counted_stock: number
          p_product_id: string
          p_reason: string
        }
        Returns: {
          company_id: string
          created_at: string
          id: string
          new_balance: number
          observation: string
          origin: string
          previous_balance: number
          product_id: string
          reference_id: string | null
          responsible_id: string | null
          unit_id: string
          variation: number
        }
        SetofOptions: {
          from: "*"
          to: "stock_movements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_production_release: {
        Args: {
          p_floor_execution_id?: string
          p_idempotency_key?: string
          p_packs_quantity: number
          p_product_id: string
          p_urgent_demand_id?: string
        }
        Returns: {
          company_id: string
          confirmed_at: string
          created_at: string
          floor_execution_id: string | null
          id: string
          idempotency_key: string | null
          packs_quantity: number
          product_id: string
          responsible_id: string | null
          status: string
          unit_id: string
          units_quantity: number
          updated_at: string
          urgent_allocated_units: number
          urgent_demand_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "production_records"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_raw_material_entry: {
        Args: { p_entry_id: string }
        Returns: {
          batch: string
          company_id: string
          control_quantity: number | null
          conversion_factor: number | null
          created_at: string
          entry_date: string
          expiry_date: string
          id: string
          invoice_access_key: string
          invoice_issue_date: string | null
          invoice_number: string
          invoice_series: string
          new_balance: number | null
          packages_quantity: number
          previous_balance: number | null
          raw_material_id: string
          responsible_id: string | null
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          status: string
          supplier_id: string
          total_value: number | null
          unit_id: string
          unit_price: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "raw_material_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_order: {
        Args: {
          p_company_name: string
          p_coupon_code?: string
          p_customer_address?: string
          p_customer_cep?: string
          p_customer_city?: string
          p_customer_cnpj?: string
          p_customer_email?: string
          p_customer_id?: string
          p_customer_ie?: string
          p_customer_name: string
          p_customer_neighborhood?: string
          p_customer_state?: string
          p_customer_trade_name?: string
          p_items: Json
          p_phone: string
        }
        Returns: Json
      }
      create_platform_company: {
        Args: {
          p_display_name: string
          p_document?: string
          p_legal_name?: string
          p_segment?: string
        }
        Returns: string
      }
      create_production:
        | {
            Args: { p_packs_quantity: number; p_product_id: string }
            Returns: {
              company_id: string
              confirmed_at: string
              created_at: string
              floor_execution_id: string | null
              id: string
              idempotency_key: string | null
              packs_quantity: number
              product_id: string
              responsible_id: string | null
              status: string
              unit_id: string
              units_quantity: number
              updated_at: string
              urgent_allocated_units: number
              urgent_demand_id: string | null
            }
            SetofOptions: {
              from: "*"
              to: "production_records"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_employee_ids?: string[]
              p_packs_quantity: number
              p_product_id: string
            }
            Returns: {
              company_id: string
              confirmed_at: string
              created_at: string
              floor_execution_id: string | null
              id: string
              idempotency_key: string | null
              packs_quantity: number
              product_id: string
              responsible_id: string | null
              status: string
              unit_id: string
              units_quantity: number
              updated_at: string
              urgent_allocated_units: number
              urgent_demand_id: string | null
            }
            SetofOptions: {
              from: "*"
              to: "production_records"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_employee_ids?: string[]
              p_packs_quantity: number
              p_product_id: string
              p_urgent_demand_id?: string
            }
            Returns: {
              company_id: string
              confirmed_at: string
              created_at: string
              floor_execution_id: string | null
              id: string
              idempotency_key: string | null
              packs_quantity: number
              product_id: string
              responsible_id: string | null
              status: string
              unit_id: string
              units_quantity: number
              updated_at: string
              urgent_allocated_units: number
              urgent_demand_id: string | null
            }
            SetofOptions: {
              from: "*"
              to: "production_records"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      create_production_release: {
        Args: {
          p_idempotency_key?: string
          p_note?: string
          p_packs_quantity: number
          p_product_id: string
          p_reason?: string
          p_urgent_demand_id?: string
        }
        Returns: {
          company_id: string
          created_at: string
          created_by_user_id: string | null
          id: string
          idempotency_key: string
          note: string | null
          origin: string
          product_id: string
          reason: string | null
          requested_packs: number
          requested_units: number
          unit_id: string
          urgent_demand_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "production_releases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_stock_entry: {
        Args: {
          p_observation?: string
          p_product_id: string
          p_quantity: number
        }
        Returns: {
          company_id: string
          created_at: string
          id: string
          new_balance: number
          observation: string
          origin: string
          previous_balance: number
          product_id: string
          reference_id: string | null
          responsible_id: string | null
          unit_id: string
          variation: number
        }
        SetofOptions: {
          from: "*"
          to: "stock_movements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finalize_delivery: {
        Args: {
          p_doc: string
          p_doc_type: string
          p_er_code: string
          p_items: Json
          p_notes: string
          p_order_id: string
          p_pdf_path: string
          p_receiver_name: string
          p_result: string
          p_role: string
          p_signature_path: string
        }
        Returns: string
      }
      floor_advance_quantity: {
        Args: { p_floor_execution_id: string; p_quantity_delta: number }
        Returns: {
          assumed_at: string | null
          assumed_by_employee_id: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          id: string
          operational_quantity: number
          product_id: string
          production_record_id: string | null
          production_release_id: string | null
          route_version_label: string
          started_at: string | null
          status: string
          target_quantity: number
          unit_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "floor_executions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      floor_assume_execution: {
        Args: { p_employee_id: string; p_floor_execution_id: string }
        Returns: {
          assumed_at: string | null
          assumed_by_employee_id: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          id: string
          operational_quantity: number
          product_id: string
          production_record_id: string | null
          production_release_id: string | null
          route_version_label: string
          started_at: string | null
          status: string
          target_quantity: number
          unit_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "floor_executions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      floor_complete_execution: {
        Args: { p_floor_execution_id: string }
        Returns: {
          assumed_at: string | null
          assumed_by_employee_id: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          id: string
          operational_quantity: number
          product_id: string
          production_record_id: string | null
          production_release_id: string | null
          route_version_label: string
          started_at: string | null
          status: string
          target_quantity: number
          unit_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "floor_executions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_dre_monthly: {
        Args: { p_company_id: string }
        Returns: {
          cmv_cpv: number
          deductions: number
          financial_charges: number
          gross_profit: number
          gross_revenue: number
          managerial_operating_result: number
          month: string
          net_revenue: number
          operating_expenses: number
          other_revenue: number
        }[]
      }
      get_owner_panel_summary: { Args: { p_company_id: string }; Returns: Json }
      get_platform_companies: {
        Args: never
        Returns: {
          active_users: number
          company_id: string
          created_at: string
          display_name: string
          orders_this_month: number
          status: string
        }[]
      }
      get_platform_company_detail: {
        Args: { p_company_id: string }
        Returns: Json
      }
      get_platform_company_entitlements: {
        Args: { p_company_id: string }
        Returns: Json
      }
      get_pulso_today: { Args: { p_company_id: string }; Returns: Json }
      get_sales_commissions_report: {
        Args: {
          p_employee_id?: string
          p_period_end?: string
          p_period_start?: string
        }
        Returns: {
          commission_amount: number
          commission_id: string
          commission_rate: number
          customer_name: string
          due_date: string
          employee_id: string
          employee_name: string
          installment_number: number
          order_id: string
          order_number: string
          realized_at: string
          sale_amount: number
          status: string
        }[]
      }
      is_valid_cpf: { Args: { p_cpf: string }; Returns: boolean }
      oris360_accept_invite: { Args: never; Returns: undefined }
      oris360_apurar_dia: {
        Args: { p_date: string; p_employee_id: string }
        Returns: Json
      }
      oris360_apurar_dia_detalhado: {
        Args: { p_date: string; p_employee_id: string }
        Returns: Json
      }
      oris360_apurar_mes: {
        Args: { p_competencia: string; p_employee_id: string }
        Returns: {
          dia: string
          extra_minutes: number
          inconsistency_type: string
          late_minutes: number
          normal_minutes: number
          open_session_start: string
          worked_minutes: number
        }[]
      }
      oris360_billing_confirm: {
        Args: {
          p_fiscal_choice: string
          p_idempotency_key: string
          p_order_id: string
          p_payment_methods: Json
        }
        Returns: string
      }
      oris360_billing_context: { Args: { p_order_id: string }; Returns: Json }
      oris360_billing_quote: {
        Args: { p_financed_part: number; p_order_id: string }
        Returns: Json
      }
      oris360_fechar_competencia_ponto: {
        Args: { p_competencia: string; p_employee_id: string }
        Returns: Json
      }
      oris360_group_of_company: {
        Args: { p_company_id: string }
        Returns: string
      }
      oris360_has_permission: {
        Args: { p_company_id: string; p_permission_key: string }
        Returns: boolean
      }
      oris360_list_company_members: {
        Args: { p_company_id: string }
        Returns: {
          created_at: string
          email: string
          ends_at: string
          membership_id: string
          role_names: string[]
          starts_at: string
          status: string
          user_id: string
        }[]
      }
      oris360_list_roles: {
        Args: { p_company_id: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      oris360_resolver_banco_horas: {
        Args: { p_employee_id: string; p_minutes: number; p_resolution: string }
        Returns: string
      }
      oris360_time_bank_balance: {
        Args: { p_employee_id: string }
        Returns: number
      }
      rename_raw_material_category: {
        Args: { p_id: string; p_name: string }
        Returns: undefined
      }
      reserve_delivery_er: {
        Args: { p_order_id: string }
        Returns: {
          er_code: string
          reserved_at: string
        }[]
      }
      reverse_production: {
        Args: { p_production_id: string; p_reason: string }
        Returns: {
          company_id: string
          confirmed_at: string
          created_at: string
          floor_execution_id: string | null
          id: string
          idempotency_key: string | null
          packs_quantity: number
          product_id: string
          responsible_id: string | null
          status: string
          unit_id: string
          units_quantity: number
          updated_at: string
          urgent_allocated_units: number
          urgent_demand_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "production_records"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reverse_raw_material_entry: {
        Args: { p_entry_id: string; p_reason: string }
        Returns: {
          batch: string
          company_id: string
          control_quantity: number | null
          conversion_factor: number | null
          created_at: string
          entry_date: string
          expiry_date: string
          id: string
          invoice_access_key: string
          invoice_issue_date: string | null
          invoice_number: string
          invoice_series: string
          new_balance: number | null
          packages_quantity: number
          previous_balance: number | null
          raw_material_id: string
          responsible_id: string | null
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          status: string
          supplier_id: string
          total_value: number | null
          unit_id: string
          unit_price: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "raw_material_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_monthly_close_automation: {
        Args: { p_company_id: string; p_enabled: boolean }
        Returns: undefined
      }
      set_platform_company_entitlement: {
        Args: {
          p_capability_key: string
          p_company_id: string
          p_enabled: boolean
        }
        Returns: undefined
      }
      set_platform_company_status: {
        Args: { p_company_id: string; p_status: string }
        Returns: undefined
      }
      update_order_items: {
        Args: { p_coupon_code?: string; p_items: Json; p_order_id: string }
        Returns: Json
      }
    }
    Enums: {
      order_status:
        | "NEW"
        | "IN_REVIEW"
        | "CONFIRMED"
        | "COMPLETED"
        | "CANCELLED"
        | "FINALIZADO"
      time_punch_type: "ENTRADA" | "INTERVALO" | "RETORNO" | "SAIDA"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      order_status: [
        "NEW",
        "IN_REVIEW",
        "CONFIRMED",
        "COMPLETED",
        "CANCELLED",
        "FINALIZADO",
      ],
      time_punch_type: ["ENTRADA", "INTERVALO", "RETORNO", "SAIDA"],
    },
  },
} as const
