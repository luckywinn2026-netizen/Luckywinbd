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
      active_players: {
        Row: {
          bet_amount: number
          game_display_name: string | null
          game_name: string
          game_type: string
          id: string
          last_active_at: string
          started_at: string
          user_id: string
        }
        Insert: {
          bet_amount?: number
          game_display_name?: string | null
          game_name: string
          game_type: string
          id?: string
          last_active_at?: string
          started_at?: string
          user_id: string
        }
        Update: {
          bet_amount?: number
          game_display_name?: string | null
          game_name?: string
          game_type?: string
          id?: string
          last_active_at?: string
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_applications: {
        Row: {
          created_at: string
          id: string
          live_photo_url: string | null
          location: string
          message: string | null
          name: string
          nid_back_url: string | null
          nid_front_url: string | null
          nid_number: string | null
          phone: string
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          live_photo_url?: string | null
          location: string
          message?: string | null
          name: string
          nid_back_url?: string | null
          nid_front_url?: string | null
          nid_number?: string | null
          phone: string
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          live_photo_url?: string | null
          location?: string
          message?: string | null
          name?: string
          nid_back_url?: string | null
          nid_front_url?: string | null
          nid_number?: string | null
          phone?: string
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      agent_commission_settings: {
        Row: {
          commission: number
          id: string
          per_amount: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          commission?: number
          id?: string
          per_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          commission?: number
          id?: string
          per_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      agent_deposits: {
        Row: {
          agent_id: string
          amount: number
          commission: number
          created_at: string
          id: string
          user_code: string
          user_id: string
        }
        Insert: {
          agent_id: string
          amount?: number
          commission?: number
          created_at?: string
          id?: string
          user_code: string
          user_id: string
        }
        Update: {
          agent_id?: string
          amount?: number
          commission?: number
          created_at?: string
          id?: string
          user_code?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_payment_numbers: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          is_active: boolean
          number: string
          payment_method: string
          rotation_hours: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          number: string
          payment_method: string
          rotation_hours?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          number?: string
          payment_method?: string
          rotation_hours?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      agent_settings: {
        Row: {
          created_at: string
          id: string
          is_online: boolean
          max_chats: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_online?: boolean
          max_chats?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_online?: boolean
          max_chats?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_settlements: {
        Row: {
          agent_id: string
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          note: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      agent_wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          total_commission: number
          total_deposited: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          total_commission?: number
          total_deposited?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          total_commission?: number
          total_deposited?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_withdraw_commission_settings: {
        Row: {
          commission: number
          id: string
          per_amount: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          commission?: number
          id?: string
          per_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          commission?: number
          id?: string
          per_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      agent_withdrawals: {
        Row: {
          agent_id: string
          amount: number
          commission: number
          created_at: string
          id: string
          user_code: string
          user_id: string
        }
        Insert: {
          agent_id: string
          amount?: number
          commission?: number
          created_at?: string
          id?: string
          user_code: string
          user_id: string
        }
        Update: {
          agent_id?: string
          amount?: number
          commission?: number
          created_at?: string
          id?: string
          user_code?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_canned_responses: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          message_bn: string
          message_en: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          message_bn: string
          message_en: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          message_bn?: string
          message_en?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          agent_id: string | null
          closed_at: string | null
          created_at: string
          id: string
          language: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          language?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          language?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_faq: {
        Row: {
          answer_bn: string
          answer_en: string
          created_at: string
          id: string
          is_active: boolean
          question_bn: string
          question_en: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer_bn: string
          answer_en: string
          created_at?: string
          id?: string
          is_active?: boolean
          question_bn: string
          question_en: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer_bn?: string
          answer_en?: string
          created_at?: string
          id?: string
          is_active?: boolean
          question_bn?: string
          question_en?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          message: string
          sender_id: string
          sender_type: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          message: string
          sender_id: string
          sender_type?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          message?: string
          sender_id?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      crash_rounds: {
        Row: {
          crash_point: number
          created_at: string | null
          game_id: string
          id: string
          server_start_ms: number
        }
        Insert: {
          crash_point: number
          created_at?: string | null
          game_id: string
          id?: string
          server_start_ms: number
        }
        Update: {
          crash_point?: number
          created_at?: string | null
          game_id?: string
          id?: string
          server_start_ms?: number
        }
        Relationships: []
      }
      crash_settings: {
        Row: {
          fixed_crash_point: number | null
          house_edge_percent: number | null
          id: string
          max_crash: number | null
          min_crash: number | null
          mode: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          fixed_crash_point?: number | null
          house_edge_percent?: number | null
          id?: string
          max_crash?: number | null
          min_crash?: number | null
          mode?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          fixed_crash_point?: number | null
          house_edge_percent?: number | null
          id?: string
          max_crash?: number | null
          min_crash?: number | null
          mode?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      cyber_bets: {
        Row: {
          amount: number
          created_at: string
          id: string
          match_id: string
          odds_at_bet: number
          pick: string
          potential_win: number
          settled_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          match_id: string
          odds_at_bet?: number
          pick: string
          potential_win?: number
          settled_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          match_id?: string
          odds_at_bet?: number
          pick?: string
          potential_win?: number
          settled_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cyber_bets_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "cyber_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      cyber_market_bets: {
        Row: {
          amount: number
          created_at: string
          id: string
          market_id: string
          match_id: string
          odds_at_bet: number
          pick_key: string
          potential_win: number
          settled_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          market_id: string
          match_id: string
          odds_at_bet?: number
          pick_key: string
          potential_win?: number
          settled_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          market_id?: string
          match_id?: string
          odds_at_bet?: number
          pick_key?: string
          potential_win?: number
          settled_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cyber_market_bets_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "cyber_match_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cyber_market_bets_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "cyber_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      cyber_match_events: {
        Row: {
          created_at: string
          event_text: string
          event_type: string
          id: string
          match_id: string
          minute: number | null
        }
        Insert: {
          created_at?: string
          event_text: string
          event_type?: string
          id?: string
          match_id: string
          minute?: number | null
        }
        Update: {
          created_at?: string
          event_text?: string
          event_type?: string
          id?: string
          match_id?: string
          minute?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cyber_match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "cyber_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      cyber_match_markets: {
        Row: {
          created_at: string
          id: string
          market_type: string
          match_id: string
          options: Json
          result_key: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          market_type: string
          match_id: string
          options?: Json
          result_key?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          market_type?: string
          match_id?: string
          options?: Json
          result_key?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cyber_match_markets_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "cyber_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      cyber_matches: {
        Row: {
          away_overs: string
          away_score: number
          away_team: string
          away_wickets: number
          created_at: string
          created_by: string | null
          duration_minutes: number
          home_overs: string
          home_score: number
          home_team: string
          home_wickets: number
          id: string
          match_time: string
          odds_away: number
          odds_draw: number
          odds_home: number
          result: string | null
          sport: string
          status: string
          updated_at: string
        }
        Insert: {
          away_overs?: string
          away_score?: number
          away_team: string
          away_wickets?: number
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          home_overs?: string
          home_score?: number
          home_team: string
          home_wickets?: number
          id?: string
          match_time?: string
          odds_away?: number
          odds_draw?: number
          odds_home?: number
          result?: string | null
          sport?: string
          status?: string
          updated_at?: string
        }
        Update: {
          away_overs?: string
          away_score?: number
          away_team?: string
          away_wickets?: number
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          home_overs?: string
          home_score?: number
          home_team?: string
          home_wickets?: number
          id?: string
          match_time?: string
          odds_away?: number
          odds_draw?: number
          odds_home?: number
          result?: string | null
          sport?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      deposits: {
        Row: {
          agent_approved_at: string | null
          amount: number
          assigned_agent_id: string | null
          created_at: string
          id: string
          method: string
          phone: string | null
          reject_reason: string | null
          reviewed_by_agent: string | null
          status: string
          trx_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_approved_at?: string | null
          amount?: number
          assigned_agent_id?: string | null
          created_at?: string
          id?: string
          method: string
          phone?: string | null
          reject_reason?: string | null
          reviewed_by_agent?: string | null
          status?: string
          trx_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_approved_at?: string | null
          amount?: number
          assigned_agent_id?: string | null
          created_at?: string
          id?: string
          method?: string
          phone?: string | null
          reject_reason?: string | null
          reviewed_by_agent?: string | null
          status?: string
          trx_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fake_wins: {
        Row: {
          created_at: string
          game_name: string
          id: string
          is_active: boolean
          show_on_leaderboard: boolean
          show_on_ticker: boolean
          updated_at: string
          username: string
          win_amount: number
        }
        Insert: {
          created_at?: string
          game_name?: string
          id?: string
          is_active?: boolean
          show_on_leaderboard?: boolean
          show_on_ticker?: boolean
          updated_at?: string
          username: string
          win_amount?: number
        }
        Update: {
          created_at?: string
          game_name?: string
          id?: string
          is_active?: boolean
          show_on_leaderboard?: boolean
          show_on_ticker?: boolean
          updated_at?: string
          username?: string
          win_amount?: number
        }
        Relationships: []
      }
      game_assets: {
        Row: {
          asset_key: string
          asset_type: string
          asset_url: string
          created_at: string
          game_id: string
          id: string
          label: string | null
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          asset_key: string
          asset_type: string
          asset_url: string
          created_at?: string
          game_id: string
          id?: string
          label?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          asset_key?: string
          asset_type?: string
          asset_url?: string
          created_at?: string
          game_id?: string
          id?: string
          label?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      game_profit_settings: {
        Row: {
          big_win_cooldown_hours: number
          big_win_pct: number
          big_win_pool_pct: number
          game_id: string
          game_name: string
          id: string
          is_active: boolean
          jackpot_cooldown_hours: number
          jackpot_pool_pct: number
          jackpot_win_pct: number
          loss_rate: number
          max_win_cap: number
          max_win_multiplier: number
          medium_win_pct: number
          medium_win_pool_pct: number
          min_profit_margin: number
          profit_margin: number
          small_win_pct: number
          small_win_pool_pct: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          big_win_cooldown_hours?: number
          big_win_pct?: number
          big_win_pool_pct?: number
          game_id: string
          game_name: string
          id?: string
          is_active?: boolean
          jackpot_cooldown_hours?: number
          jackpot_pool_pct?: number
          jackpot_win_pct?: number
          loss_rate?: number
          max_win_cap?: number
          max_win_multiplier?: number
          medium_win_pct?: number
          medium_win_pool_pct?: number
          min_profit_margin?: number
          profit_margin?: number
          small_win_pct?: number
          small_win_pool_pct?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          big_win_cooldown_hours?: number
          big_win_pct?: number
          big_win_pool_pct?: number
          game_id?: string
          game_name?: string
          id?: string
          is_active?: boolean
          jackpot_cooldown_hours?: number
          jackpot_pool_pct?: number
          jackpot_win_pct?: number
          loss_rate?: number
          max_win_cap?: number
          max_win_multiplier?: number
          medium_win_pct?: number
          medium_win_pool_pct?: number
          min_profit_margin?: number
          profit_margin?: number
          small_win_pct?: number
          small_win_pool_pct?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      game_sessions: {
        Row: {
          bet_amount: number
          created_at: string
          game_id: string | null
          game_name: string | null
          game_type: string
          id: string
          multiplier: number | null
          result: string
          user_id: string
          win_amount: number
        }
        Insert: {
          bet_amount?: number
          created_at?: string
          game_id?: string | null
          game_name?: string | null
          game_type: string
          id?: string
          multiplier?: number | null
          result?: string
          user_id: string
          win_amount?: number
        }
        Update: {
          bet_amount?: number
          created_at?: string
          game_id?: string | null
          game_name?: string | null
          game_type?: string
          id?: string
          multiplier?: number | null
          result?: string
          user_id?: string
          win_amount?: number
        }
        Relationships: []
      }
      game_stats_summary: {
        Row: {
          id: number
          total_bets: number
          total_wins: number
          updated_at: string
        }
        Insert: {
          id?: number
          total_bets?: number
          total_wins?: number
          updated_at?: string
        }
        Update: {
          id?: number
          total_bets?: number
          total_wins?: number
          updated_at?: string
        }
        Relationships: []
      }
      games: {
        Row: {
          created_at: string
          emoji: string | null
          game_id: string
          game_type: string
          id: string
          is_active: boolean
          name: string
          popular: boolean
          sort_order: number
          thumbnail_url: string | null
          under_maintenance: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          emoji?: string | null
          game_id: string
          game_type?: string
          id?: string
          is_active?: boolean
          name: string
          popular?: boolean
          sort_order?: number
          thumbnail_url?: string | null
          under_maintenance?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          emoji?: string | null
          game_id?: string
          game_type?: string
          id?: string
          is_active?: boolean
          name?: string
          popular?: boolean
          sort_order?: number
          thumbnail_url?: string | null
          under_maintenance?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      multiplier_settings: {
        Row: {
          id: string
          pct_100x_500x: number
          pct_1x: number
          pct_2x_25x: number
          pct_scatter: number
          pct_wild: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          pct_100x_500x?: number
          pct_1x?: number
          pct_2x_25x?: number
          pct_scatter?: number
          pct_wild?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          pct_100x_500x?: number
          pct_1x?: number
          pct_2x_25x?: number
          pct_scatter?: number
          pct_wild?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      payment_method_numbers: {
        Row: {
          created_at: string
          id: string
          number: string
          payment_method_id: string
          transaction_type_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          number: string
          payment_method_id: string
          transaction_type_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          number?: string
          payment_method_id?: string
          transaction_type_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_method_numbers_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_method_numbers_transaction_type_id_fkey"
            columns: ["transaction_type_id"]
            isOneToOne: false
            referencedRelation: "transaction_types"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          bonus: string | null
          color_from: string
          color_to: string
          created_at: string
          icon: string
          icon_url: string | null
          id: string
          is_active: boolean
          name: string
          number: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          bonus?: string | null
          color_from?: string
          color_to?: string
          created_at?: string
          icon?: string
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name: string
          number: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          bonus?: string | null
          color_from?: string
          color_to?: string
          created_at?: string
          icon?: string
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name?: string
          number?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          forced_result: string | null
          id: string
          phone: string | null
          refer_code: string | null
          referred_by: string | null
          telegram_link: string | null
          updated_at: string
          user_code: string | null
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          forced_result?: string | null
          id?: string
          phone?: string | null
          refer_code?: string | null
          referred_by?: string | null
          telegram_link?: string | null
          updated_at?: string
          user_code?: string | null
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          forced_result?: string | null
          id?: string
          phone?: string | null
          refer_code?: string | null
          referred_by?: string | null
          telegram_link?: string | null
          updated_at?: string
          user_code?: string | null
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          bonus_cap: number
          bonus_earned: number
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
          status: string
          updated_at: string
        }
        Insert: {
          bonus_cap?: number
          bonus_earned?: number
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          bonus_cap?: number
          bonus_earned?: number
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      reward_pools: {
        Row: {
          balance: number
          id: string
          pool_type: string
          total_contributed: number
          total_paid_out: number
          updated_at: string
        }
        Insert: {
          balance?: number
          id?: string
          pool_type: string
          total_contributed?: number
          total_paid_out?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          id?: string
          pool_type?: string
          total_contributed?: number
          total_paid_out?: number
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          id: string
          key: string
          value: Json
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          value?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      sub_admin_permissions: {
        Row: {
          created_at: string
          id: string
          module: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          module: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          module?: string
          user_id?: string
        }
        Relationships: []
      }
      super_ace_sessions: {
        Row: {
          active: boolean
          created_at: string
          id: string
          spins_remaining: number
          total_spins_awarded: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          spins_remaining?: number
          total_spins_awarded?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          spins_remaining?: number
          total_spins_awarded?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      super_ace_spin_logs: {
        Row: {
          bet_amount: number
          cascades: number
          created_at: string
          free_spin_mode: boolean
          grid_result: Json
          id: string
          total_win: number
          user_id: string
        }
        Insert: {
          bet_amount: number
          cascades?: number
          created_at?: string
          free_spin_mode?: boolean
          grid_result: Json
          id?: string
          total_win?: number
          user_id: string
        }
        Update: {
          bet_amount?: number
          cascades?: number
          created_at?: string
          free_spin_mode?: boolean
          grid_result?: Json
          id?: string
          total_win?: number
          user_id?: string
        }
        Relationships: []
      }
      transaction_types: {
        Row: {
          created_at: string
          description: string
          icon: string
          id: string
          is_active: boolean
          label: string
          sort_order: number
          type_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          type_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          type_id?: string
          updated_at?: string
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
      user_vip_data: {
        Row: {
          created_at: string
          id: string
          last_cashback_at: string | null
          last_spin_at: string | null
          total_bet_amount: number
          updated_at: string
          user_id: string
          vip_points: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_cashback_at?: string | null
          last_spin_at?: string | null
          total_bet_amount?: number
          updated_at?: string
          user_id: string
          vip_points?: number
        }
        Update: {
          created_at?: string
          id?: string
          last_cashback_at?: string | null
          last_spin_at?: string | null
          total_bet_amount?: number
          updated_at?: string
          user_id?: string
          vip_points?: number
        }
        Relationships: []
      }
      user_win_cooldowns: {
        Row: {
          created_at: string
          game_id: string | null
          id: string
          last_win_at: string
          user_id: string
          win_amount: number
          win_type: string
        }
        Insert: {
          created_at?: string
          game_id?: string | null
          id?: string
          last_win_at?: string
          user_id: string
          win_amount?: number
          win_type: string
        }
        Update: {
          created_at?: string
          game_id?: string | null
          id?: string
          last_win_at?: string
          user_id?: string
          win_amount?: number
          win_type?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          agent_approved_at: string | null
          amount: number
          assigned_agent_id: string | null
          created_at: string
          id: string
          method: string
          phone: string | null
          reviewed_by_agent: string | null
          status: string
          updated_at: string
          user_id: string
          withdrawal_code: string | null
        }
        Insert: {
          agent_approved_at?: string | null
          amount?: number
          assigned_agent_id?: string | null
          created_at?: string
          id?: string
          method: string
          phone?: string | null
          reviewed_by_agent?: string | null
          status?: string
          updated_at?: string
          user_id: string
          withdrawal_code?: string | null
        }
        Update: {
          agent_approved_at?: string | null
          amount?: number
          assigned_agent_id?: string | null
          created_at?: string
          id?: string
          method?: string
          phone?: string | null
          reviewed_by_agent?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          withdrawal_code?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_vip_points: {
        Args: { p_bet_amount: number; p_points: number; p_user_id: string }
        Returns: undefined
      }
      adjust_wallet_balance: {
        Args: { p_amount: number; p_user_id: string }
        Returns: number
      }
      approve_agent_settlement: {
        Args: { p_admin_id: string; p_settlement_id: string }
        Returns: undefined
      }
      assign_agent_to_conversation: {
        Args: { p_conversation_id: string }
        Returns: string
      }
      auto_settle_cyber_market: { Args: { p_market_id: string }; Returns: Json }
      auto_settle_cyber_match: { Args: { p_match_id: string }; Returns: Json }
      claim_cashback: { Args: { p_user_id: string }; Returns: number }
      cleanup_stale_active_players: { Args: never; Returns: undefined }
      deduct_from_pool: {
        Args: { p_amount: number; p_pool_type: string }
        Returns: number
      }
      distribute_bet_to_pools: {
        Args: {
          p_bet_amount: number
          p_big_pct?: number
          p_jackpot_pct?: number
          p_medium_pct?: number
          p_small_pct?: number
        }
        Returns: undefined
      }
      generate_refer_code: { Args: never; Returns: string }
      generate_user_code: { Args: never; Returns: string }
      get_approved_deposit_total: { Args: never; Returns: number }
      get_approved_withdrawal_total: { Args: never; Returns: number }
      get_leaderboard: {
        Args: { time_range?: string }
        Returns: {
          top_game: string
          total_games: number
          total_winnings: number
          user_id: string
          username: string
        }[]
      }
      get_or_create_crash_round: { Args: { p_game_id: string }; Returns: Json }
      get_per_game_stats_by_range: {
        Args: { p_start: string }
        Returns: {
          game_name: string
          total_bets: number
          total_wins: number
        }[]
      }
      get_profit_chart_data: {
        Args: { p_period?: string; p_start: string }
        Returns: {
          bucket_label: string
          total_bets: number
          total_wins: number
        }[]
      }
      get_session_stats_by_range: {
        Args: { p_start: string }
        Returns: {
          total_bets: number
          total_wins: number
        }[]
      }
      get_total_bets_and_wins: {
        Args: never
        Returns: {
          total_bets: number
          total_wins: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      load_agent_balance: {
        Args: { p_agent_user_id: string; p_amount: number }
        Returns: number
      }
      pay_agent_commission: {
        Args: { p_admin_id: string; p_agent_id: string }
        Returns: Json
      }
      process_agent_assigned_deposit_approval: {
        Args: { p_agent_id: string; p_deposit_id: string }
        Returns: Json
      }
      process_agent_deposit: {
        Args: { p_agent_id: string; p_amount: number; p_user_code: string }
        Returns: Json
      }
      process_agent_withdrawal_approval: {
        Args: { p_agent_id: string; p_withdrawal_id: string }
        Returns: Json
      }
      recalculate_cyber_odds: {
        Args: { p_match_id: string }
        Returns: undefined
      }
      record_agent_commission:
        | {
            Args: { p_agent_id: string; p_commission: number }
            Returns: undefined
          }
        | {
            Args: {
              p_agent_id: string
              p_commission: number
              p_deposit_amount?: number
            }
            Returns: undefined
          }
      settle_cyber_market: {
        Args: { p_market_id: string; p_result_key: string }
        Returns: Json
      }
      settle_cyber_match: {
        Args: { p_match_id: string; p_result: string }
        Returns: Json
      }
      try_daily_spin: { Args: { p_user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "agent" | "payment_agent"
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
      app_role: ["admin", "moderator", "user", "agent", "payment_agent"],
    },
  },
} as const
