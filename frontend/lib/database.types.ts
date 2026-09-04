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
      abs_diagnoses: {
        Row: {
          answers: Json
          created_at: string
          id: string
          obligation_count: number
          obligations: Json
          user_id: string
        }
        Insert: {
          answers: Json
          created_at?: string
          id?: string
          obligation_count: number
          obligations: Json
          user_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          obligation_count?: number
          obligations?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "abs_diagnoses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string | null
          id: string
          jurisdiction: string
          title: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          jurisdiction: string
          title?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          jurisdiction?: string
          title?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      escalations: {
        Row: {
          contact: string
          created_at: string | null
          id: string
          query_summary: string
          status: string
          urgency: string
          user_id: string | null
        }
        Insert: {
          contact: string
          created_at?: string | null
          id?: string
          query_summary: string
          status?: string
          urgency: string
          user_id?: string | null
        }
        Update: {
          contact?: string
          created_at?: string | null
          id?: string
          query_summary?: string
          status?: string
          urgency?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escalations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          citations: Json | null
          confidence: string | null
          content: string
          conversation_id: string | null
          created_at: string | null
          id: string
          role: string
        }
        Insert: {
          citations?: Json | null
          confidence?: string | null
          content: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          role: string
        }
        Update: {
          citations?: Json | null
          confidence?: string | null
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          bucket: string
          count: number
          function_name: string
          user_id: string
        }
        Insert: {
          bucket: string
          count?: number
          function_name: string
          user_id: string
        }
        Update: {
          bucket?: string
          count?: number
          function_name?: string
          user_id?: string
        }
        Relationships: []
      }
      statute_chunks: {
        Row: {
          citation_url: string | null
          clause_id: string | null
          created_at: string
          deep_link: string | null
          embedding: string
          id: string
          page_number: number | null
          section_number: string
          section_title: string | null
          statute_display: string
          statute_id: string
          text: string
        }
        Insert: {
          citation_url?: string | null
          clause_id?: string | null
          created_at?: string
          deep_link?: string | null
          embedding: string
          id: string
          page_number?: number | null
          section_number: string
          section_title?: string | null
          statute_display: string
          statute_id: string
          text: string
        }
        Update: {
          citation_url?: string | null
          clause_id?: string | null
          created_at?: string
          deep_link?: string | null
          embedding?: string
          id?: string
          page_number?: number | null
          section_number?: string
          section_title?: string | null
          statute_display?: string
          statute_id?: string
          text?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          auth_id: string | null
          avatar_url: string | null
          city: string | null
          context_answers: Json | null
          created_at: string | null
          full_name: string | null
          id: string
          jurisdiction: string
          language: string
          languages_spoken: string[] | null
          last_active: string | null
          organisation: string | null
          preferences: Json | null
          role_in_org: string | null
          state: string | null
          user_type: string
        }
        Insert: {
          auth_id?: string | null
          avatar_url?: string | null
          city?: string | null
          context_answers?: Json | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          jurisdiction: string
          language: string
          languages_spoken?: string[] | null
          last_active?: string | null
          organisation?: string | null
          preferences?: Json | null
          role_in_org?: string | null
          state?: string | null
          user_type: string
        }
        Update: {
          auth_id?: string | null
          avatar_url?: string | null
          city?: string | null
          context_answers?: Json | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          jurisdiction?: string
          language?: string
          languages_spoken?: string[] | null
          last_active?: string | null
          organisation?: string | null
          preferences?: Json | null
          role_in_org?: string | null
          state?: string | null
          user_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      activity_events_v: {
        Row: {
          created_at: string | null
          event_type: string | null
          id: string | null
          label: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_rate_limit: {
        Args: { p_function: string; p_limit: number; p_user_id: string }
        Returns: {
          allowed: boolean
          current_count: number
          reset_at: string
        }[]
      }
      match_statute_chunks: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          citation_url: string
          clause_id: string
          deep_link: string
          id: string
          page_number: number
          section_number: string
          section_title: string
          similarity: number
          statute_display: string
          statute_id: string
          text: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
