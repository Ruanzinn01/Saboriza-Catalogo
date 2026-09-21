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
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          pack_quantity: number
          packs_quantity: number
          presentation: string
          product_id: string | null
          product_name: string
          total_price: number
          total_units: number
          unit_price: number
          weight_volume: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          pack_quantity: number
          packs_quantity: number
          presentation: string
          product_id?: string | null
          product_name: string
          total_price: number
          total_units: number
          unit_price: number
          weight_volume: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          pack_quantity?: number
          packs_quantity?: number
          presentation?: string
          product_id?: string | null
          product_name?: string
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
          discount_amount: number
          id: string
          order_number: string
          payment_terms: string
          phone: string
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
          discount_amount?: number
          id?: string
          order_number?: string
          payment_terms?: string
          phone: string
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
          discount_amount?: number
          id?: string
          order_number?: string
          payment_terms?: string
          phone?: string
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
          confirmed_at: string
          created_at: string
          id: string
          packs_quantity: number
          product_id: string
          responsible_id: string | null
          status: string
          units_quantity: number
          updated_at: string
        }
        Insert: {
          confirmed_at?: string
          created_at?: string
          id?: string
          packs_quantity: number
          product_id: string
          responsible_id?: string | null
          status?: string
          units_quantity: number
          updated_at?: string
        }
        Update: {
          confirmed_at?: string
          created_at?: string
          id?: string
          packs_quantity?: number
          product_id?: string
          responsible_id?: string | null
          status?: string
          units_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_records_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
          created_at: string
          current_stock: number
          description: string
          gtin: string
          id: string
          image_url: string
          is_active: boolean
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
      create_production: {
        Args: { p_packs_quantity: number; p_product_id: string }
        Returns: {
          confirmed_at: string
          created_at: string
          id: string
          packs_quantity: number
          product_id: string
          responsible_id: string | null
          status: string
          units_quantity: number
          updated_at: string
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
