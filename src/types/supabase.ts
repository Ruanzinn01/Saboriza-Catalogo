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
      categories: {
        Row: {
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
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          tagline?: string
          updated_at?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string
          cep: string
          city: string
          cnpj: string
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
        Relationships: []
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
      order_adjustment_requests: {
        Row: {
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
      order_items: {
        Row: {
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
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
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
          delivery_signature_url: string | null
          delivery_result: string | null
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
          delivery_signature_url?: string | null
          delivery_result?: string | null
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
          delivery_signature_url?: string | null
          delivery_result?: string | null
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
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_recipe: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity_per_unit: number
          raw_material_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity_per_unit: number
          raw_material_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity_per_unit?: number
          raw_material_id?: string
          updated_at?: string
        }
        Relationships: [
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
        ]
      }
      production_records: {
        Row: {
          company_id: string
          confirmed_at: string
          created_at: string
          id: string
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
          id?: string
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
          id?: string
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
            foreignKeyName: "production_records_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_records_urgent_company_fkey"
            columns: ["company_id", "urgent_demand_id"]
            isOneToOne: false
            referencedRelation: "urgent_demands"
            referencedColumns: ["company_id", "id"]
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
      products: {
        Row: {
          badge: string | null
          brand: string
          category_id: string
          code: string | null
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
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
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
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      raw_material_entries: {
        Row: {
          batch: string
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
          unit_price: number
          updated_at: string
        }
        Insert: {
          batch: string
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
          unit_price: number
          updated_at?: string
        }
        Update: {
          batch?: string
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
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_material_entries_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_material_entries_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_materials: {
        Row: {
          avg_cost: number
          category: string
          code: string
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
            foreignKeyName: "raw_materials_primary_supplier_id_fkey"
            columns: ["primary_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
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
          timesheet_enabled: boolean
          timesheet_from: string | null
          timesheet_overtime_bank: string | null
          timesheet_overtime_mode: string | null
          timesheet_schedule_label: string | null
          timesheet_standard_hours: string | null
          timesheet_until: string | null
          timesheet_weekly_hours: string | null
          tool_links: Json
          unit_id: string | null
          updated_at: string
          address_number: string | null
          work_location: string | null
        }
        Insert: {
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
          timesheet_enabled?: boolean
          timesheet_from?: string | null
          timesheet_overtime_bank?: string | null
          timesheet_overtime_mode?: string | null
          timesheet_schedule_label?: string | null
          timesheet_standard_hours?: string | null
          timesheet_until?: string | null
          timesheet_weekly_hours?: string | null
          tool_links?: Json
          unit_id?: string | null
          updated_at?: string
          address_number?: string | null
          work_location?: string | null
        }
        Update: {
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
          timesheet_enabled?: boolean
          timesheet_from?: string | null
          timesheet_overtime_bank?: string | null
          timesheet_overtime_mode?: string | null
          timesheet_schedule_label?: string | null
          timesheet_standard_hours?: string | null
          timesheet_until?: string | null
          timesheet_weekly_hours?: string | null
          tool_links?: Json
          unit_id?: string | null
          updated_at?: string
          address_number?: string | null
          work_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_unit_company_fkey"
            columns: ["company_id", "unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "employees_manager_company_fkey"
            columns: ["company_id", "manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["company_id", "id"]
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
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          new_balance: number
          observation: string
          origin: string
          previous_balance: number
          product_id: string
          reference_id: string | null
          responsible_id: string | null
          variation: number
        }
        Insert: {
          created_at?: string
          id?: string
          new_balance: number
          observation?: string
          origin: string
          previous_balance: number
          product_id: string
          reference_id?: string | null
          responsible_id?: string | null
          variation: number
        }
        Update: {
          created_at?: string
          id?: string
          new_balance?: number
          observation?: string
          origin?: string
          previous_balance?: number
          product_id?: string
          reference_id?: string | null
          responsible_id?: string | null
          variation?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      reserve_delivery_er: {
        Args: { p_order_id: string }
        Returns: { er_code: string; reserved_at: string }[]
      }
      adjust_stock: {
        Args: {
          p_counted_stock: number
          p_product_id: string
          p_reason: string
        }
        Returns: {
          created_at: string
          id: string
          new_balance: number
          observation: string
          origin: string
          previous_balance: number
          product_id: string
          reference_id: string | null
          responsible_id: string | null
          variation: number
        }
        SetofOptions: {
          from: "*"
          to: "stock_movements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_raw_material_entry: {
        Args: { p_entry_id: string }
        Returns: {
          batch: string
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
      reverse_production: {
        Args: { p_production_id: string; p_reason: string }
        Returns: {
          company_id: string
          confirmed_at: string
          created_at: string
          id: string
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
          isOneToOne: false
        }
      }
      create_production: {
        Args: {
          p_employee_ids?: string[] | null
          p_packs_quantity: number
          p_product_id: string
          p_urgent_demand_id?: string | null
        }
        Returns: {
          company_id: string
          confirmed_at: string
          created_at: string
          id: string
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
      create_stock_entry: {
        Args: {
          p_observation?: string
          p_product_id: string
          p_quantity: number
        }
        Returns: {
          created_at: string
          id: string
          new_balance: number
          observation: string
          origin: string
          previous_balance: number
          product_id: string
          reference_id: string | null
          responsible_id: string | null
          variation: number
        }
        SetofOptions: {
          from: "*"
          to: "stock_movements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rename_raw_material_category: {
        Args: { p_id: string; p_name: string }
        Returns: undefined
      }
      reverse_raw_material_entry: {
        Args: { p_entry_id: string; p_reason: string }
        Returns: {
          batch: string
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
      order_status: ["NEW", "IN_REVIEW", "CONFIRMED", "COMPLETED", "CANCELLED", "FINALIZADO"],
    },
  },
} as const
