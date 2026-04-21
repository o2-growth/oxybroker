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
      analytics_daily_rollups: {
        Row: {
          avg_duration_ms: number | null
          created_at: string
          error_count: number
          event_name: string
          event_type: string
          id: string
          metadata: Json | null
          rollup_date: string
          route: string | null
          total_count: number
          total_duration_ms: number | null
          unique_sessions: number
          unique_users: number
        }
        Insert: {
          avg_duration_ms?: number | null
          created_at?: string
          error_count?: number
          event_name: string
          event_type: string
          id?: string
          metadata?: Json | null
          rollup_date: string
          route?: string | null
          total_count?: number
          total_duration_ms?: number | null
          unique_sessions?: number
          unique_users?: number
        }
        Update: {
          avg_duration_ms?: number | null
          created_at?: string
          error_count?: number
          event_name?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          rollup_date?: string
          route?: string | null
          total_count?: number
          total_duration_ms?: number | null
          unique_sessions?: number
          unique_users?: number
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          duration_ms: number | null
          entity_id: string | null
          entity_type: string | null
          event_name: string
          event_type: string
          id: string
          metadata: Json | null
          occurred_at: string
          referrer: string | null
          request_id: string | null
          role: string | null
          route: string | null
          session_id: string
          status: string | null
          user_id: string | null
        }
        Insert: {
          duration_ms?: number | null
          entity_id?: string | null
          entity_type?: string | null
          event_name: string
          event_type: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          referrer?: string | null
          request_id?: string | null
          role?: string | null
          route?: string | null
          session_id: string
          status?: string | null
          user_id?: string | null
        }
        Update: {
          duration_ms?: number | null
          entity_id?: string | null
          entity_type?: string | null
          event_name?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          referrer?: string | null
          request_id?: string | null
          role?: string | null
          route?: string | null
          session_id?: string
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          bidding_extension_seconds: number
          bracket_multipliers: Json
          buy_now_premium_multiplier: number
          created_at: string
          id: string
          max_sniping_extensions: number
          mql_base_value: number
          return_window_hours: number
          scoring_weights: Json | null
          sla_minutes: number
          updated_at: string
        }
        Insert: {
          bidding_extension_seconds?: number
          bracket_multipliers?: Json
          buy_now_premium_multiplier?: number
          created_at?: string
          id?: string
          max_sniping_extensions?: number
          mql_base_value?: number
          return_window_hours?: number
          scoring_weights?: Json | null
          sla_minutes?: number
          updated_at?: string
        }
        Update: {
          bidding_extension_seconds?: number
          bracket_multipliers?: Json
          buy_now_premium_multiplier?: number
          created_at?: string
          id?: string
          max_sniping_extensions?: number
          mql_base_value?: number
          return_window_hours?: number
          scoring_weights?: Json | null
          sla_minutes?: number
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
      leads_inbox: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          cnpj: string | null
          contato_cargo: string | null
          contato_email: string | null
          contato_nome: string
          contato_telefone: string | null
          created_at: string
          expired_at: string | null
          faturamento_bracket: Database["public"]["Enums"]["revenue_bracket"]
          id: string
          lot_id: string | null
          observacoes: string | null
          origem: string
          payload_raw: Json
          pipefy_card_id: string | null
          pipefy_sent_at: string | null
          price_cached: number | null
          purchase_id: string | null
          razao_social: string
          received_at: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          setor: string
          status: Database["public"]["Enums"]["lead_inbox_status"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          cnpj?: string | null
          contato_cargo?: string | null
          contato_email?: string | null
          contato_nome: string
          contato_telefone?: string | null
          created_at?: string
          expired_at?: string | null
          faturamento_bracket: Database["public"]["Enums"]["revenue_bracket"]
          id?: string
          lot_id?: string | null
          observacoes?: string | null
          origem: string
          payload_raw?: Json
          pipefy_card_id?: string | null
          pipefy_sent_at?: string | null
          price_cached?: number | null
          purchase_id?: string | null
          razao_social: string
          received_at?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          setor: string
          status?: Database["public"]["Enums"]["lead_inbox_status"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          cnpj?: string | null
          contato_cargo?: string | null
          contato_email?: string | null
          contato_nome?: string
          contato_telefone?: string | null
          created_at?: string
          expired_at?: string | null
          faturamento_bracket?: Database["public"]["Enums"]["revenue_bracket"]
          id?: string
          lot_id?: string | null
          observacoes?: string | null
          origem?: string
          payload_raw?: Json
          pipefy_card_id?: string | null
          pipefy_sent_at?: string | null
          price_cached?: number | null
          purchase_id?: string | null
          razao_social?: string
          received_at?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          setor?: string
          status?: Database["public"]["Enums"]["lead_inbox_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_inbox_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_inbox_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
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
          auction_type: Database["public"]["Enums"]["auction_type"]
          created_at: string
          created_by: string | null
          current_price: number
          description: string | null
          ends_at: string | null
          extension_count: number
          id: string
          lead_inbox_id: string | null
          min_bid_increment: number
          starting_price: number
          starts_at: string | null
          status: Database["public"]["Enums"]["lot_status"]
          title: string
          updated_at: string
          winner_user_id: string | null
        }
        Insert: {
          auction_type?: Database["public"]["Enums"]["auction_type"]
          created_at?: string
          created_by?: string | null
          current_price?: number
          description?: string | null
          ends_at?: string | null
          extension_count?: number
          id?: string
          lead_inbox_id?: string | null
          min_bid_increment?: number
          starting_price?: number
          starts_at?: string | null
          status?: Database["public"]["Enums"]["lot_status"]
          title: string
          updated_at?: string
          winner_user_id?: string | null
        }
        Update: {
          auction_type?: Database["public"]["Enums"]["auction_type"]
          created_at?: string
          created_by?: string | null
          current_price?: number
          description?: string | null
          ends_at?: string | null
          extension_count?: number
          id?: string
          lead_inbox_id?: string | null
          min_bid_increment?: number
          starting_price?: number
          starts_at?: string | null
          status?: Database["public"]["Enums"]["lot_status"]
          title?: string
          updated_at?: string
          winner_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lots_lead_inbox_id_fkey"
            columns: ["lead_inbox_id"]
            isOneToOne: false
            referencedRelation: "leads_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_lead_inbox_id_fkey"
            columns: ["lead_inbox_id"]
            isOneToOne: false
            referencedRelation: "leads_pending_pipefy_handoff"
            referencedColumns: ["id"]
          },
        ]
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
      promotion_eligibility: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          promotion_id: string
          user_id: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          promotion_id: string
          user_id?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          promotion_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promotion_eligibility_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "franchise_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_eligibility_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_schedules: {
        Row: {
          created_at: string
          days_of_week: number[] | null
          end_time: string | null
          ends_at: string | null
          id: string
          promotion_id: string
          schedule_type: Database["public"]["Enums"]["schedule_type"]
          start_time: string | null
          starts_at: string | null
        }
        Insert: {
          created_at?: string
          days_of_week?: number[] | null
          end_time?: string | null
          ends_at?: string | null
          id?: string
          promotion_id: string
          schedule_type: Database["public"]["Enums"]["schedule_type"]
          start_time?: string | null
          starts_at?: string | null
        }
        Update: {
          created_at?: string
          days_of_week?: number[] | null
          end_time?: string | null
          ends_at?: string | null
          id?: string
          promotion_id?: string
          schedule_type?: Database["public"]["Enums"]["schedule_type"]
          start_time?: string | null
          starts_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promotion_schedules_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_usage: {
        Row: {
          benefit_amount: number
          created_at: string
          id: string
          original_amount: number
          promotion_id: string
          reference_id: string | null
          reference_type: string
          user_id: string
        }
        Insert: {
          benefit_amount: number
          created_at?: string
          id?: string
          original_amount: number
          promotion_id: string
          reference_id?: string | null
          reference_type: string
          user_id: string
        }
        Update: {
          benefit_amount?: number
          created_at?: string
          id?: string
          original_amount?: number
          promotion_id?: string
          reference_id?: string | null
          reference_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_usage_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          applies_to: Database["public"]["Enums"]["promotion_applies_to"]
          benefit_type: Database["public"]["Enums"]["benefit_type"]
          benefit_value: number
          created_at: string
          created_by: string | null
          description: string | null
          eligibility: Database["public"]["Enums"]["eligibility_type"]
          id: string
          is_active: boolean
          max_benefit: number | null
          min_amount: number | null
          name: string
          type: Database["public"]["Enums"]["promotion_type"]
          updated_at: string
        }
        Insert: {
          applies_to: Database["public"]["Enums"]["promotion_applies_to"]
          benefit_type: Database["public"]["Enums"]["benefit_type"]
          benefit_value: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          eligibility?: Database["public"]["Enums"]["eligibility_type"]
          id?: string
          is_active?: boolean
          max_benefit?: number | null
          min_amount?: number | null
          name: string
          type: Database["public"]["Enums"]["promotion_type"]
          updated_at?: string
        }
        Update: {
          applies_to?: Database["public"]["Enums"]["promotion_applies_to"]
          benefit_type?: Database["public"]["Enums"]["benefit_type"]
          benefit_value?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          eligibility?: Database["public"]["Enums"]["eligibility_type"]
          id?: string
          is_active?: boolean
          max_benefit?: number | null
          min_amount?: number | null
          name?: string
          type?: Database["public"]["Enums"]["promotion_type"]
          updated_at?: string
        }
        Relationships: []
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
      webhook_api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          key_hash: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          revoked_by: string | null
          scope: string[]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          revoked_by?: string | null
          scope?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          revoked_by?: string | null
          scope?: string[]
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
      leads_pending_pipefy_handoff: {
        Row: {
          cnpj: string | null
          contato_cargo: string | null
          contato_email: string | null
          contato_nome: string | null
          contato_telefone: string | null
          expired_at: string | null
          faturamento_bracket:
            | Database["public"]["Enums"]["revenue_bracket"]
            | null
          id: string | null
          observacoes: string | null
          origem: string | null
          payload_raw: Json | null
          razao_social: string | null
          received_at: string | null
          setor: string | null
        }
        Insert: {
          cnpj?: string | null
          contato_cargo?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          expired_at?: string | null
          faturamento_bracket?:
            | Database["public"]["Enums"]["revenue_bracket"]
            | null
          id?: string | null
          observacoes?: string | null
          origem?: string | null
          payload_raw?: Json | null
          razao_social?: string | null
          received_at?: string | null
          setor?: string | null
        }
        Update: {
          cnpj?: string | null
          contato_cargo?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          expired_at?: string | null
          faturamento_bracket?:
            | Database["public"]["Enums"]["revenue_bracket"]
            | null
          id?: string | null
          observacoes?: string | null
          origem?: string | null
          payload_raw?: Json | null
          razao_social?: string | null
          received_at?: string | null
          setor?: string | null
        }
        Relationships: []
      }
      profiles_public: {
        Row: {
          avatar_url: string | null
          can_withdraw: boolean | null
          created_at: string | null
          franchise_category_id: string | null
          full_name: string | null
          id: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          suspended_at: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          can_withdraw?: boolean | null
          created_at?: string | null
          franchise_category_id?: string | null
          full_name?: string | null
          id?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          suspended_at?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          can_withdraw?: boolean | null
          created_at?: string | null
          franchise_category_id?: string | null
          full_name?: string | null
          id?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          suspended_at?: string | null
          updated_at?: string | null
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
      withdrawals_user: {
        Row: {
          amount: number | null
          id: string | null
          notes: string | null
          processed_at: string | null
          requested_at: string | null
          status: Database["public"]["Enums"]["withdrawal_status"] | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          id?: string | null
          notes?: string | null
          processed_at?: string | null
          requested_at?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"] | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          id?: string | null
          notes?: string | null
          processed_at?: string | null
          requested_at?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"] | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_adjust_balance_atomic: {
        Args: {
          p_admin_id: string
          p_amount: number
          p_reason: string
          p_user_id: string
        }
        Returns: Json
      }
      apply_promotion: {
        Args: {
          p_applies_to: string
          p_original_amount: number
          p_reference_id: string
          p_reference_type: string
          p_user_id: string
        }
        Returns: Json
      }
      buy_now_atomic: {
        Args: { p_lot_id: string; p_user_id: string }
        Returns: Json
      }
      buy_now_lead_pre_auction: {
        Args: { p_buyer_id: string; p_lead_id: string }
        Returns: Json
      }
      calculate_lead_price: {
        Args: {
          p_bracket: Database["public"]["Enums"]["revenue_bracket"]
          p_is_pre_auction?: boolean
        }
        Returns: number
      }
      calculate_promotion_benefit: {
        Args: { p_original_amount: number; p_promotion_id: string }
        Returns: number
      }
      close_auction_atomic: { Args: { p_lot_id: string }; Returns: Json }
      credit_wallet: {
        Args: {
          p_amount: number
          p_description?: string
          p_reference_id?: string
          p_reference_type?: string
          p_user_id: string
        }
        Returns: Json
      }
      expire_unsold_lead: { Args: { p_lot_id: string }; Returns: Json }
      get_active_promotion: {
        Args: { p_amount: number; p_applies_to: string; p_user_id: string }
        Returns: {
          benefit_type: string
          benefit_value: number
          max_benefit: number
          name: string
          promotion_id: string
          type: string
        }[]
      }
      get_user_max_bid_on_lot: { Args: { _lot_id: string }; Returns: number }
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
      is_promotion_schedule_active: {
        Args: { p_promotion_id: string }
        Returns: boolean
      }
      is_user_eligible_for_promotion: {
        Args: { p_promotion_id: string; p_user_id: string }
        Returns: boolean
      }
      mark_lead_sold_auction: {
        Args: { p_lot_id: string; p_purchase_id: string }
        Returns: Json
      }
      place_bid_atomic: {
        Args: { p_amount: number; p_lot_id: string; p_user_id: string }
        Returns: Json
      }
      process_return_atomic: { Args: { p_return_id: string }; Returns: Json }
      promote_lead_to_auction: {
        Args: {
          p_created_by: string
          p_custom_duration_minutes?: number
          p_lead_id: string
        }
        Returns: string
      }
      request_withdrawal_atomic: {
        Args: { p_amount: number; p_bank_info: Json; p_user_id: string }
        Returns: Json
      }
      transfer_balance_atomic: {
        Args: { p_amount: number; p_from_user_id: string; p_to_user_id: string }
        Returns: Json
      }
      user_has_bid_on_lot: { Args: { _lot_id: string }; Returns: boolean }
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
      auction_type: "single_lead" | "bundle"
      benefit_type: "percentage" | "fixed"
      eligibility_type: "global" | "category" | "individual"
      lead_inbox_status:
        | "pending_review"
        | "approved"
        | "rejected"
        | "in_auction"
        | "sold_pre_auction"
        | "sold_auction"
        | "expired"
      lot_status: "draft" | "live" | "ended" | "cancelled"
      notification_channel: "in_app" | "email"
      promotion_applies_to: "topup" | "bid" | "purchase"
      promotion_type: "discount" | "cashback"
      purchase_status: "paid" | "refunded" | "disputed"
      return_status: "requested" | "approved" | "rejected" | "processed"
      revenue_bracket:
        | "200k_350k"
        | "350k_500k"
        | "500k_1m"
        | "1m_5m"
        | "5m_plus"
      schedule_type: "one_time" | "recurring"
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
      auction_type: ["single_lead", "bundle"],
      benefit_type: ["percentage", "fixed"],
      eligibility_type: ["global", "category", "individual"],
      lead_inbox_status: [
        "pending_review",
        "approved",
        "rejected",
        "in_auction",
        "sold_pre_auction",
        "sold_auction",
        "expired",
      ],
      lot_status: ["draft", "live", "ended", "cancelled"],
      notification_channel: ["in_app", "email"],
      promotion_applies_to: ["topup", "bid", "purchase"],
      promotion_type: ["discount", "cashback"],
      purchase_status: ["paid", "refunded", "disputed"],
      return_status: ["requested", "approved", "rejected", "processed"],
      revenue_bracket: [
        "200k_350k",
        "350k_500k",
        "500k_1m",
        "1m_5m",
        "5m_plus",
      ],
      schedule_type: ["one_time", "recurring"],
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
