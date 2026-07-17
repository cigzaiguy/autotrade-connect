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
      deals: {
        Row: {
          agreed_price: number | null
          buyer_id: string
          closed_at: string | null
          commission_amount: number | null
          commission_pct: number
          created_at: string
          currency: string | null
          id: string
          listing_id: string
          notes: string | null
          seller_id: string
          status: Database["public"]["Enums"]["deal_status"]
          updated_at: string
        }
        Insert: {
          agreed_price?: number | null
          buyer_id: string
          closed_at?: string | null
          commission_amount?: number | null
          commission_pct?: number
          created_at?: string
          currency?: string | null
          id?: string
          listing_id: string
          notes?: string | null
          seller_id: string
          status?: Database["public"]["Enums"]["deal_status"]
          updated_at?: string
        }
        Update: {
          agreed_price?: number | null
          buyer_id?: string
          closed_at?: string | null
          commission_amount?: number | null
          commission_pct?: number
          created_at?: string
          currency?: string | null
          id?: string
          listing_id?: string
          notes?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["deal_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      intel_items: {
        Row: {
          ai_summary: string | null
          created_at: string
          fetched_at: string
          headline: string
          id: string
          impact: string | null
          item_url: string | null
          published_at: string | null
          raw: Json | null
          source_id: string | null
          source_name: string
          source_url: string
          tag: Database["public"]["Enums"]["intel_tag"]
        }
        Insert: {
          ai_summary?: string | null
          created_at?: string
          fetched_at?: string
          headline: string
          id?: string
          impact?: string | null
          item_url?: string | null
          published_at?: string | null
          raw?: Json | null
          source_id?: string | null
          source_name: string
          source_url: string
          tag: Database["public"]["Enums"]["intel_tag"]
        }
        Update: {
          ai_summary?: string | null
          created_at?: string
          fetched_at?: string
          headline?: string
          id?: string
          impact?: string | null
          item_url?: string | null
          published_at?: string | null
          raw?: Json | null
          source_id?: string | null
          source_name?: string
          source_url?: string
          tag?: Database["public"]["Enums"]["intel_tag"]
        }
        Relationships: [
          {
            foreignKeyName: "intel_items_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "intel_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      intel_sources: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          last_run_at: string | null
          last_status: string | null
          name: string
          tag: Database["public"]["Enums"]["intel_tag"]
          url: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          last_status?: string | null
          name: string
          tag: Database["public"]["Enums"]["intel_tag"]
          url: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          last_status?: string | null
          name?: string
          tag?: Database["public"]["Enums"]["intel_tag"]
          url?: string
        }
        Relationships: []
      }
      interests: {
        Row: {
          bid_price: number | null
          created_at: string
          id: string
          listing_id: string
          message: string | null
          quantity_wanted: number | null
          status: Database["public"]["Enums"]["interest_status"]
          trader_id: string
        }
        Insert: {
          bid_price?: number | null
          created_at?: string
          id?: string
          listing_id: string
          message?: string | null
          quantity_wanted?: number | null
          status?: Database["public"]["Enums"]["interest_status"]
          trader_id: string
        }
        Update: {
          bid_price?: number | null
          created_at?: string
          id?: string
          listing_id?: string
          message?: string | null
          quantity_wanted?: number | null
          status?: Database["public"]["Enums"]["interest_status"]
          trader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interests_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          category: Database["public"]["Enums"]["listing_category"]
          created_at: string
          currency: string | null
          description: string | null
          destination_scope: string | null
          id: string
          lead_time_days: number | null
          listing_code: string
          metadata: Json | null
          origin_location: string | null
          owner_id: string
          price_max: number | null
          price_min: number | null
          quantity: number | null
          quantity_unit: string | null
          status: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["listing_category"]
          created_at?: string
          currency?: string | null
          description?: string | null
          destination_scope?: string | null
          id?: string
          lead_time_days?: number | null
          listing_code: string
          metadata?: Json | null
          origin_location?: string | null
          owner_id: string
          price_max?: number | null
          price_min?: number | null
          quantity?: number | null
          quantity_unit?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["listing_category"]
          created_at?: string
          currency?: string | null
          description?: string | null
          destination_scope?: string | null
          id?: string
          lead_time_days?: number | null
          listing_code?: string
          metadata?: Json | null
          origin_location?: string | null
          owner_id?: string
          price_max?: number | null
          price_min?: number | null
          quantity?: number | null
          quantity_unit?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_name: string | null
          contact_email: string | null
          country: string | null
          created_at: string
          handle: string
          id: string
        }
        Insert: {
          company_name?: string | null
          contact_email?: string | null
          country?: string | null
          created_at?: string
          handle: string
          id: string
        }
        Update: {
          company_name?: string | null
          contact_email?: string | null
          country?: string | null
          created_at?: string
          handle?: string
          id?: string
        }
        Relationships: []
      }
      trader_billing: {
        Row: {
          created_at: string
          fee_due_at: string | null
          last_paid_at: string | null
          notes: string | null
          suspended: boolean
          updated_at: string
          user_id: string
          yearly_fee_status: Database["public"]["Enums"]["fee_status"]
        }
        Insert: {
          created_at?: string
          fee_due_at?: string | null
          last_paid_at?: string | null
          notes?: string | null
          suspended?: boolean
          updated_at?: string
          user_id: string
          yearly_fee_status?: Database["public"]["Enums"]["fee_status"]
        }
        Update: {
          created_at?: string
          fee_due_at?: string | null
          last_paid_at?: string | null
          notes?: string | null
          suspended?: boolean
          updated_at?: string
          user_id?: string
          yearly_fee_status?: Database["public"]["Enums"]["fee_status"]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "trader"
      deal_status: "open" | "closed" | "cancelled"
      fee_status: "paid" | "due" | "overdue" | "trial"
      intel_tag: "news" | "oem" | "freight" | "oil" | "chips"
      interest_status: "submitted" | "reviewing" | "matched" | "declined"
      listing_category:
        | "vehicles"
        | "spare_parts"
        | "storage"
        | "chips"
        | "manufacturing"
      listing_status: "active" | "brokering" | "closed" | "withdrawn"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "trader"],
      deal_status: ["open", "closed", "cancelled"],
      fee_status: ["paid", "due", "overdue", "trial"],
      intel_tag: ["news", "oem", "freight", "oil", "chips"],
      interest_status: ["submitted", "reviewing", "matched", "declined"],
      listing_category: [
        "vehicles",
        "spare_parts",
        "storage",
        "chips",
        "manufacturing",
      ],
      listing_status: ["active", "brokering", "closed", "withdrawn"],
    },
  },
} as const
