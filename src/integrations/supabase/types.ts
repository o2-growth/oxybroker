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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          id: string
          message: string | null
          metadata: Json | null
          title: string
          type: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json | null
          title: string
          type: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          bidding_extension_seconds: number
          created_at: string
          id: string
          return_window_hours: number
          scoring_weights: Json | null
          updated_at: string
        }
        Insert: {
          bidding_extension_seconds?: number
          created_at?: string
          id?: string
          return_window_hours?: number
          scoring_weights?: Json | null
          updated_at?: string
        }
        Update: {
          bidding_extension_seconds?: number
          created_at?: string
          id?: string
          return_window_hours?: number
          scoring_weights?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      assets: {
        Row: {
          asset_type: Database["public"]["Enums"]["asset_type"]
          base_score: number
          created_at: string
          created_by: string | null
          employees_count: number | null
          entered_at: string
          id: string
          location_city: string | null
          location_state: string | null
          metadata: Json | null
          revenue_range: string | null
          sector: string | null
          status: Database["public"]["Enums"]["asset_status"]
          title: string
          updated_at: string
        }
        Insert: {
          asset_type: Database["public"]["Enums"]["asset_type"]
          base_score?: number
          created_at?: string
          created_by?: string | null
          employees_count?: number | null
          entered_at?: string
          id?: string
          location_city?: string | null
          location_state?: string | null
          metadata?: Json | null
          revenue_range?: string | null
          sector?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          title: string
          updated_at?: string
        }
        Update: {
          asset_type?: Database["public"]["Enums"]["asset_type"]
          base_score?: number
          created_at?: string
          created_by?: string | null
          employees_count?: number | null
          entered_at?: string
          id?: string
          location_city?: string | null
          location_state?: string | null
          metadata?: Json | null
          revenue_range?: string | null
          sector?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      bids: {
        Row: {
          amount: number
          created_at: string
          id: string
          lot_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          lot_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          lot_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bids_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      category_asset_availability: {
        Row: {
          asset_type: Database["public"]["Enums"]["asset_type"]
          created_at: string
          enabled: boolean
          franchise_category_id: string
          id: string
        }
        Insert: {
          asset_type: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          enabled?: boolean
          franchise_category_id: string
          id?: string
        }
        Update: {
          asset_type?: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          enabled?: boolean
          franchise_category_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_asset_availability_franchise_category_id_fkey"
            columns: ["franchise_category_id"]
            isOneToOne: false
            referencedRelation: "franchise_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      franchise_categories: {
        Row: {
          created_at: string
          id: string
          limits_json: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          limits_json?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          limits_json?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      lot_items: {
        Row: {
          asset_id: string
          created_at: string
          lot_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          lot_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          lot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lot_items_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lot_items_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      lots: {
        Row: {
          created_at: string
          created_by: string | null
          current_price: number
          description: string | null
          ends_at: string | null
          id: string
          min_bid_increment: number
          starting_price: number
          starts_at: string | null
          status: Database["public"]["Enums"]["lot_status"]
          title: string
          updated_at: string
          winner_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_price?: number
          description?: string | null
          ends_at?: string | null
          id?: string
          min_bid_increment?: number
          starting_price?: number
          starts_at?: string | null
          status?: Database["public"]["Enums"]["lot_status"]
          title: string
          updated_at?: string
          winner_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_price?: number
          description?: string | null
          ends_at?: string | null
          id?: string
          min_bid_increment?: number
          starting_price?: number
          starts_at?: string | null
          status?: Database["public"]["Enums"]["lot_status"]
          title?: string
          updated_at?: string
          winner_user_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          id: string
          payload: Json | null
          read_at: string | null
          title: string | null
          type: string
          user_id: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          payload?: Json | null
          read_at?: string | null
          title?: string | null
          type: string
          user_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          payload?: Json | null
          read_at?: string | null
          title?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          can_withdraw: boolean
          created_at: string
          email: string | null
          franchise_category_id: string | null
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          suspended_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          can_withdraw?: boolean
          created_at?: string
          email?: string | null
          franchise_category_id?: string | null
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["app_role"]
          suspended_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          can_withdraw?: boolean
          created_at?: string
          email?: string | null
          franchise_category_id?: string | null
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          suspended_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_franchise_category_id_fkey"
            columns: ["franchise_category_id"]
            isOneToOne: false
            referencedRelation: "franchise_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          amount: number
          buyer_user_id: string
          id: string
          lot_id: string
          purchased_at: string
          return_deadline_at: string | null
          status: Database["public"]["Enums"]["purchase_status"]
        }
        Insert: {
          amount: number
          buyer_user_id: string
          id?: string
          lot_id: string
          purchased_at?: string
          return_deadline_at?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
        }
        Update: {
          amount?: number
          buyer_user_id?: string
          id?: string
          lot_id?: string
          purchased_at?: string
          return_deadline_at?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
        }
        Relationships: [
          {
            foreignKeyName: "purchases_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          created_at: string
          id: string
          processed_at: string | null
          purchase_id: string
          reason: string | null
          requested_by: string
          status: Database["public"]["Enums"]["return_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          processed_at?: string | null
          purchase_id: string
          reason?: string | null
          requested_by: string
          status?: Database["public"]["Enums"]["return_status"]
        }
        Update: {
          created_at?: string
          id?: string
          processed_at?: string | null
          purchase_id?: string
          reason?: string | null
          requested_by?: string
          status?: Database["public"]["Enums"]["return_status"]
        }
        Relationships: [
          {
            foreignKeyName: "returns_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_events: {
        Row: {
          attempts: number
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          payload: Json | null
          processed_at: string
          status: string
          stripe_event_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          processed_at?: string
          status?: string
          stripe_event_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          processed_at?: string
          status?: string
          stripe_event_id?: string
        }
        Relationships: []
      }
      transfers: {
        Row: {
          amount: number | null
          asset_id: string | null
          created_at: string
          from_user_id: string
          id: string
          status: Database["public"]["Enums"]["transfer_status"]
          to_user_id: string
          type: Database["public"]["Enums"]["transfer_type"]
        }
        Insert: {
          amount?: number | null
          asset_id?: string | null
          created_at?: string
          from_user_id: string
          id?: string
          status?: Database["public"]["Enums"]["transfer_status"]
          to_user_id: string
          type: Database["public"]["Enums"]["transfer_type"]
        }
        Update: {
          amount?: number | null
          asset_id?: string | null
          created_at?: string
          from_user_id?: string
          id?: string
          status?: Database["public"]["Enums"]["transfer_status"]
          to_user_id?: string
          type?: Database["public"]["Enums"]["transfer_type"]
        }
        Relationships: [
          {
            foreignKeyName: "transfers_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
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
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          reference_type: string | null
          type: Database["public"]["Enums"]["wallet_transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          type: Database["public"]["Enums"]["wallet_transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          type?: Database["public"]["Enums"]["wallet_transaction_type"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          amount: number
          bank_info: Json
          id: string
          notes: string | null
          processed_at: string | null
          processed_by: string | null
          requested_at: string
          status: Database["public"]["Enums"]["withdrawal_status"]
          user_id: string
        }
        Insert: {
          amount: number
          bank_info: Json
          id?: string
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["withdrawal_status"]
          user_id: string
        }
        Update: {
          amount?: number
          bank_info?: Json
          id?: string
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["withdrawal_status"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      buy_now_atomic: {
        Args: { p_lot_id: string; p_user_id: string }
        Returns: Json
      }
      close_auction_atomic: { Args: { p_lot_id: string }; Returns: Json }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_oxy_hacker: { Args: never; Returns: boolean }
      place_bid_atomic: {
        Args: { p_amount: number; p_lot_id: string; p_user_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "master_franquia" | "franquia" | "oxy_hacker"
      asset_status:
        | "draft"
        | "available"
        | "in_auction"
        | "sold"
        | "returned"
        | "disabled"
      asset_type: "lead" | "mlq" | "meeting" | "mql" | "client"
      lot_status: "draft" | "live" | "ended" | "cancelled"
      notification_channel: "in_app" | "email"
      purchase_status: "paid" | "refunded" | "disputed"
      return_status: "requested" | "approved" | "rejected" | "processed"
      transfer_status: "completed" | "reversed"
      transfer_type: "balance" | "asset"
      wallet_transaction_type:
        | "topup"
        | "debit_purchase"
        | "credit_refund"
        | "transfer_in"
        | "transfer_out"
        | "admin_adjust"
        | "withdrawal"
      withdrawal_status: "pending" | "approved" | "rejected" | "completed"
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
      app_role: ["admin", "master_franquia", "franquia", "oxy_hacker"],
      asset_status: [
        "draft",
        "available",
        "in_auction",
        "sold",
        "returned",
        "disabled",
      ],
      asset_type: ["lead", "mlq", "meeting", "mql", "client"],
      lot_status: ["draft", "live", "ended", "cancelled"],
      notification_channel: ["in_app", "email"],
      purchase_status: ["paid", "refunded", "disputed"],
      return_status: ["requested", "approved", "rejected", "processed"],
      transfer_status: ["completed", "reversed"],
      transfer_type: ["balance", "asset"],
      wallet_transaction_type: [
        "topup",
        "debit_purchase",
        "credit_refund",
        "transfer_in",
        "transfer_out",
        "admin_adjust",
        "withdrawal",
      ],
      withdrawal_status: ["pending", "approved", "rejected", "completed"],
    },
  },
} as const
