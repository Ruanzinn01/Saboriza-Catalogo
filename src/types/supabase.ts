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
          created_at: string
          customer_address: string
          customer_cep: string
          customer_city: string
          customer_cnpj: string
          customer_email: string
          customer_ie: string
          customer_name: string
          customer_neighborhood: string
          customer_state: string
          customer_trade_name: string
          id: string
          order_number: string
          payment_terms: string
          phone: string
          status: Database["public"]["Enums"]["order_status"]
          total_amount: number
          total_units: number
          updated_at: string
        }
        Insert: {
          company_name?: string
          created_at?: string
          customer_address?: string
          customer_cep?: string
          customer_city?: string
          customer_cnpj?: string
          customer_email?: string
          customer_ie?: string
          customer_name: string
          customer_neighborhood?: string
          customer_state?: string
          customer_trade_name?: string
          id?: string
          order_number?: string
          payment_terms?: string
          phone: string
          status?: Database["public"]["Enums"]["order_status"]
          total_amount?: number
          total_units?: number
          updated_at?: string
        }
        Update: {
          company_name?: string
          created_at?: string
          customer_address?: string
          customer_cep?: string
          customer_city?: string
          customer_cnpj?: string
          customer_email?: string
          customer_ie?: string
          customer_name?: string
          customer_neighborhood?: string
          customer_state?: string
          customer_trade_name?: string
          id?: string
          order_number?: string
          payment_terms?: string
          phone?: string
          status?: Database["public"]["Enums"]["order_status"]
          total_amount?: number
          total_units?: number
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          badge: string | null
          category_id: string
          created_at: string
          description: string
          id: string
          image_url: string
          is_active: boolean
          name: string
          pack_quantity: number
          packaging_type: string
          presentation: string
          unit_price: number
          updated_at: string
          weight_volume: string
        }
        Insert: {
          badge?: string | null
          category_id: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string
          is_active?: boolean
          name: string
          pack_quantity: number
          packaging_type: string
          presentation: string
          unit_price: number
          updated_at?: string
          weight_volume: string
        }
        Update: {
          badge?: string | null
          category_id?: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string
          is_active?: boolean
          name?: string
          pack_quantity?: number
          packaging_type?: string
          presentation?: string
          unit_price?: number
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
        ]
      }
      settings: {
        Row: {
          business_hours: string
          cnpj: string
          created_at: string
          factory_name: string
          id: string
          legal_name: string
          updated_at: string
          whatsapp_display: string
          whatsapp_number: string
        }
        Insert: {
          business_hours?: string
          cnpj?: string
          created_at?: string
          factory_name?: string
          id?: string
          legal_name?: string
          updated_at?: string
          whatsapp_display?: string
          whatsapp_number?: string
        }
        Update: {
          business_hours?: string
          cnpj?: string
          created_at?: string
          factory_name?: string
          id?: string
          legal_name?: string
          updated_at?: string
          whatsapp_display?: string
          whatsapp_number?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_order: {
        Args: {
          p_company_name: string
          p_customer_address?: string
          p_customer_cep?: string
          p_customer_city?: string
          p_customer_cnpj?: string
          p_customer_email?: string
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

export const Constants = {
  public: {
    Enums: {
      order_status: ["NEW", "IN_REVIEW", "CONFIRMED", "COMPLETED", "CANCELLED"],
    },
  },
} as const
