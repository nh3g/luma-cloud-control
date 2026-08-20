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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      action_logs: {
        Row: {
          decision_id: string | null
          endpoint: string
          error_message: string | null
          executed_at: string
          id: string
          method: string
          platform: Database["public"]["Enums"]["platform"]
          request_json: Json | null
          response_json: Json | null
          success: boolean
          workspace_id: string
        }
        Insert: {
          decision_id?: string | null
          endpoint: string
          error_message?: string | null
          executed_at?: string
          id?: string
          method: string
          platform: Database["public"]["Enums"]["platform"]
          request_json?: Json | null
          response_json?: Json | null
          success: boolean
          workspace_id: string
        }
        Update: {
          decision_id?: string | null
          endpoint?: string
          error_message?: string | null
          executed_at?: string
          id?: string
          method?: string
          platform?: Database["public"]["Enums"]["platform"]
          request_json?: Json | null
          response_json?: Json | null
          success?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_logs_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      app_credentials: {
        Row: {
          key: string
          updated_at: string
          vault_secret_id: string
          workspace_id: string
        }
        Insert: {
          key: string
          updated_at?: string
          vault_secret_id: string
          workspace_id: string
        }
        Update: {
          key?: string
          updated_at?: string
          vault_secret_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_credentials_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      browser_collection_runs: {
        Row: {
          campaigns: number
          error: string | null
          finished_at: string | null
          id: string
          live_url: string | null
          platform: Database["public"]["Enums"]["platform"]
          started_at: string
          status: Database["public"]["Enums"]["browser_run_status"]
          step: string | null
          task_id: string
          workspace_id: string
        }
        Insert: {
          campaigns?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          live_url?: string | null
          platform: Database["public"]["Enums"]["platform"]
          started_at?: string
          status?: Database["public"]["Enums"]["browser_run_status"]
          step?: string | null
          task_id: string
          workspace_id: string
        }
        Update: {
          campaigns?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          live_url?: string | null
          platform?: Database["public"]["Enums"]["platform"]
          started_at?: string
          status?: Database["public"]["Enums"]["browser_run_status"]
          step?: string | null
          task_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "browser_collection_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      browser_collections: {
        Row: {
          created_at: string
          external_account_id: string | null
          id: string
          lookback_days: number
          mode: Database["public"]["Enums"]["collection_mode"]
          platform: Database["public"]["Enums"]["platform"]
          profile_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          external_account_id?: string | null
          id?: string
          lookback_days?: number
          mode?: Database["public"]["Enums"]["collection_mode"]
          platform: Database["public"]["Enums"]["platform"]
          profile_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          external_account_id?: string | null
          id?: string
          lookback_days?: number
          mode?: Database["public"]["Enums"]["collection_mode"]
          platform?: Database["public"]["Enums"]["platform"]
          profile_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "browser_collections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          account_id: string
          budget_daily: number
          clicks: number
          conversions: number
          cpa: number
          cpc: number
          cpm: number
          ctr: number
          frequency: number
          id: string
          impressions: number
          metadata_json: Json
          name: string
          objective: string | null
          platform: Database["public"]["Enums"]["platform"]
          revenue: number
          roas: number
          spend: number
          status: string
          synced_at: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_id: string
          budget_daily?: number
          clicks?: number
          conversions?: number
          cpa?: number
          cpc?: number
          cpm?: number
          ctr?: number
          frequency?: number
          id: string
          impressions?: number
          metadata_json?: Json
          name: string
          objective?: string | null
          platform: Database["public"]["Enums"]["platform"]
          revenue?: number
          roas?: number
          spend?: number
          status: string
          synced_at?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          account_id?: string
          budget_daily?: number
          clicks?: number
          conversions?: number
          cpa?: number
          cpc?: number
          cpm?: number
          ctr?: number
          frequency?: number
          id?: string
          impressions?: number
          metadata_json?: Json
          name?: string
          objective?: string | null
          platform?: Database["public"]["Enums"]["platform"]
          revenue?: number
          roas?: number
          spend?: number
          status?: string
          synced_at?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          account_id: string
          action_type: Database["public"]["Enums"]["decision_action_type"]
          approval_note: string | null
          approved_at: string | null
          approved_by_user_id: string | null
          campaign_id: string | null
          campaign_name: string | null
          confidence: number
          created_at: string
          executed_at: string | null
          executed_via: Database["public"]["Enums"]["execution_channel"] | null
          expires_at: string
          id: string
          platform: Database["public"]["Enums"]["platform"]
          previous_value_json: Json | null
          proposed_value_json: Json | null
          reason: string
          rejected_at: string | null
          result_json: Json | null
          risk_level: Database["public"]["Enums"]["risk_level"]
          source: Database["public"]["Enums"]["decision_source"]
          status: Database["public"]["Enums"]["decision_status"]
          workspace_id: string
        }
        Insert: {
          account_id: string
          action_type: Database["public"]["Enums"]["decision_action_type"]
          approval_note?: string | null
          approved_at?: string | null
          approved_by_user_id?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          confidence?: number
          created_at?: string
          executed_at?: string | null
          executed_via?: Database["public"]["Enums"]["execution_channel"] | null
          expires_at: string
          id?: string
          platform: Database["public"]["Enums"]["platform"]
          previous_value_json?: Json | null
          proposed_value_json?: Json | null
          reason: string
          rejected_at?: string | null
          result_json?: Json | null
          risk_level?: Database["public"]["Enums"]["risk_level"]
          source?: Database["public"]["Enums"]["decision_source"]
          status?: Database["public"]["Enums"]["decision_status"]
          workspace_id: string
        }
        Update: {
          account_id?: string
          action_type?: Database["public"]["Enums"]["decision_action_type"]
          approval_note?: string | null
          approved_at?: string | null
          approved_by_user_id?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          confidence?: number
          created_at?: string
          executed_at?: string | null
          executed_via?: Database["public"]["Enums"]["execution_channel"] | null
          expires_at?: string
          id?: string
          platform?: Database["public"]["Enums"]["platform"]
          previous_value_json?: Json | null
          proposed_value_json?: Json | null
          reason?: string
          rejected_at?: string | null
          result_json?: Json | null
          risk_level?: Database["public"]["Enums"]["risk_level"]
          source?: Database["public"]["Enums"]["decision_source"]
          status?: Database["public"]["Enums"]["decision_status"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decisions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      engine_settings: {
        Row: {
          analysis_interval_minutes: number
          auto_analysis_enabled: boolean
          budget_reduce_percent: number
          budget_scale_percent: number
          created_at: string
          decision_ttl_minutes: number
          high_frequency_threshold: number
          id: string
          low_ctr_threshold: number
          min_spend_no_conversion: number
          roas_reduce_threshold: number
          roas_scale_threshold: number
          target_cpa: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          analysis_interval_minutes?: number
          auto_analysis_enabled?: boolean
          budget_reduce_percent?: number
          budget_scale_percent?: number
          created_at?: string
          decision_ttl_minutes?: number
          high_frequency_threshold?: number
          id?: string
          low_ctr_threshold?: number
          min_spend_no_conversion?: number
          roas_reduce_threshold?: number
          roas_scale_threshold?: number
          target_cpa?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          analysis_interval_minutes?: number
          auto_analysis_enabled?: boolean
          budget_reduce_percent?: number
          budget_scale_percent?: number
          created_at?: string
          decision_ttl_minutes?: number
          high_frequency_threshold?: number
          id?: string
          low_ctr_threshold?: number
          min_spend_no_conversion?: number
          roas_reduce_threshold?: number
          roas_scale_threshold?: number
          target_cpa?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engine_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_tokens: {
        Row: {
          access_token: string
          expires_at: string | null
          integration_id: string
          refresh_token: string | null
          scope: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          access_token: string
          expires_at?: string | null
          integration_id: string
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          access_token?: string
          expires_at?: string | null
          integration_id?: string
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_tokens_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: true
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_tokens_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          access_token_vault_id: string | null
          account_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          metadata_json: Json
          name: string | null
          platform: Database["public"]["Enums"]["platform"]
          refresh_token_vault_id: string | null
          status: Database["public"]["Enums"]["integration_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          access_token_vault_id?: string | null
          account_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata_json?: Json
          name?: string | null
          platform: Database["public"]["Enums"]["platform"]
          refresh_token_vault_id?: string | null
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          access_token_vault_id?: string | null
          account_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata_json?: Json
          name?: string | null
          platform?: Database["public"]["Enums"]["platform"]
          refresh_token_vault_id?: string | null
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          label: string
          last_used_at: string | null
          revoked_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_keys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      metric_snapshots: {
        Row: {
          campaign_id: string
          captured_at: string
          clicks: number
          conversions: number
          cpa: number
          cpc: number
          cpm: number
          ctr: number
          frequency: number
          id: string
          impressions: number
          platform: Database["public"]["Enums"]["platform"]
          revenue: number
          roas: number
          spend: number
          workspace_id: string
        }
        Insert: {
          campaign_id: string
          captured_at?: string
          clicks?: number
          conversions?: number
          cpa?: number
          cpc?: number
          cpm?: number
          ctr?: number
          frequency?: number
          id?: string
          impressions?: number
          platform: Database["public"]["Enums"]["platform"]
          revenue?: number
          roas?: number
          spend?: number
          workspace_id: string
        }
        Update: {
          campaign_id?: string
          captured_at?: string
          clicks?: number
          conversions?: number
          cpa?: number
          cpc?: number
          cpm?: number
          ctr?: number
          frequency?: number
          id?: string
          impressions?: number
          platform?: Database["public"]["Enums"]["platform"]
          revenue?: number
          roas?: number
          spend?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "metric_snapshots_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metric_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          content: string
          created_at: string
          id: string
          position: number
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          position?: number
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          position?: number
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          created_at: string
          platform: Database["public"]["Enums"]["platform"]
          state: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          platform: Database["public"]["Enums"]["platform"]
          state: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          platform?: Database["public"]["Enums"]["platform"]
          state?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_states_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_credentials: {
        Row: {
          client_id: string
          client_secret: string
          developer_token: string | null
          platform: Database["public"]["Enums"]["platform"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          client_id: string
          client_secret: string
          developer_token?: string | null
          platform: Database["public"]["Enums"]["platform"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          client_id?: string
          client_secret?: string
          developer_token?: string | null
          platform?: Database["public"]["Enums"]["platform"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_credentials_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_runs: {
        Row: {
          accounts: number
          campaigns: number
          failed_accounts: number
          finished_at: string | null
          id: string
          message: string | null
          platform: Database["public"]["Enums"]["platform"]
          started_at: string
          status: Database["public"]["Enums"]["sync_status"]
          workspace_id: string
        }
        Insert: {
          accounts?: number
          campaigns?: number
          failed_accounts?: number
          finished_at?: string | null
          id?: string
          message?: string | null
          platform: Database["public"]["Enums"]["platform"]
          started_at?: string
          status: Database["public"]["Enums"]["sync_status"]
          workspace_id: string
        }
        Update: {
          accounts?: number
          campaigns?: number
          failed_accounts?: number
          finished_at?: string | null
          id?: string
          message?: string | null
          platform?: Database["public"]["Enums"]["platform"]
          started_at?: string
          status?: Database["public"]["Enums"]["sync_status"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          agent_stopped: boolean
          ai_model: string
          auto_sync_enabled: boolean
          created_at: string
          demo_mode: boolean
          id: string
          last_auto_run_at: string | null
          name: string
          onboarding_completed: boolean
          owner_id: string
          profile_avatar: string
          profile_color: string
          updated_at: string
        }
        Insert: {
          agent_stopped?: boolean
          ai_model?: string
          auto_sync_enabled?: boolean
          created_at?: string
          demo_mode?: boolean
          id?: string
          last_auto_run_at?: string | null
          name?: string
          onboarding_completed?: boolean
          owner_id: string
          profile_avatar?: string
          profile_color?: string
          updated_at?: string
        }
        Update: {
          agent_stopped?: boolean
          ai_model?: string
          auto_sync_enabled?: boolean
          created_at?: string
          demo_mode?: boolean
          id?: string
          last_auto_run_at?: string | null
          name?: string
          onboarding_completed?: boolean
          owner_id?: string
          profile_avatar?: string
          profile_color?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_workspace_owner: { Args: { _workspace_id: string }; Returns: boolean }
      seed_demo_workspace: { Args: { _ws: string }; Returns: undefined }
    }
    Enums: {
      browser_run_status: "RUNNING" | "FINISHED" | "FAILED" | "STOPPED"
      collection_mode: "DEMO" | "API" | "BROWSER"
      decision_action_type:
        | "PAUSE_CAMPAIGN"
        | "RESUME_CAMPAIGN"
        | "INCREASE_BUDGET"
        | "DECREASE_BUDGET"
        | "ROTATE_CREATIVE"
      decision_source: "RULE_ENGINE" | "AI" | "MCP" | "MANUAL"
      decision_status:
        | "PENDING"
        | "APPROVED"
        | "REJECTED"
        | "EXECUTED"
        | "FAILED"
        | "EXPIRED"
      execution_channel: "API" | "BROWSER" | "SIMULATED"
      integration_status: "DISCONNECTED" | "CONNECTED" | "EXPIRED" | "ERROR"
      platform: "META" | "GOOGLE_ADS" | "GA4"
      risk_level: "LOW" | "MEDIUM" | "HIGH"
      sync_status: "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED"
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
      browser_run_status: ["RUNNING", "FINISHED", "FAILED", "STOPPED"],
      collection_mode: ["DEMO", "API", "BROWSER"],
      decision_action_type: [
        "PAUSE_CAMPAIGN",
        "RESUME_CAMPAIGN",
        "INCREASE_BUDGET",
        "DECREASE_BUDGET",
        "ROTATE_CREATIVE",
      ],
      decision_source: ["RULE_ENGINE", "AI", "MCP", "MANUAL"],
      decision_status: [
        "PENDING",
        "APPROVED",
        "REJECTED",
        "EXECUTED",
        "FAILED",
        "EXPIRED",
      ],
      execution_channel: ["API", "BROWSER", "SIMULATED"],
      integration_status: ["DISCONNECTED", "CONNECTED", "EXPIRED", "ERROR"],
      platform: ["META", "GOOGLE_ADS", "GA4"],
      risk_level: ["LOW", "MEDIUM", "HIGH"],
      sync_status: ["RUNNING", "SUCCESS", "PARTIAL", "FAILED"],
    },
  },
} as const
