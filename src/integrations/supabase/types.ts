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
      group_properties: {
        Row: {
          created_at: string
          group_id: string
          id: string
          property_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          property_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_properties_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      group_snapshots: {
        Row: {
          collected_at: string
          group_id: string
          id: string
          weighted_score_0_10: number
        }
        Insert: {
          collected_at?: string
          group_id: string
          id?: string
          weighted_score_0_10: number
        }
        Update: {
          collected_at?: string
          group_id?: string
          id?: string
          weighted_score_0_10?: number
        }
        Relationships: [
          {
            foreignKeyName: "group_snapshots_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          id: string
          is_public: boolean
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_public?: boolean
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_public?: boolean
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      hotel_aliases: {
        Row: {
          candidate_options: Json | null
          confidence_score: number | null
          created_at: string
          id: string
          last_error: string | null
          last_resolved_at: string | null
          last_verified_at: string | null
          platform_id: string | null
          platform_url: string | null
          property_id: string
          resolution_status: string
          source: Database["public"]["Enums"]["review_source"]
          source_id_or_url: string | null
          source_name_raw: string | null
          updated_at: string
        }
        Insert: {
          candidate_options?: Json | null
          confidence_score?: number | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_resolved_at?: string | null
          last_verified_at?: string | null
          platform_id?: string | null
          platform_url?: string | null
          property_id: string
          resolution_status?: string
          source: Database["public"]["Enums"]["review_source"]
          source_id_or_url?: string | null
          source_name_raw?: string | null
          updated_at?: string
        }
        Update: {
          candidate_options?: Json | null
          confidence_score?: number | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_resolved_at?: string | null
          last_verified_at?: string | null
          platform_id?: string | null
          platform_url?: string | null
          property_id?: string
          resolution_status?: string
          source?: Database["public"]["Enums"]["review_source"]
          source_id_or_url?: string | null
          source_name_raw?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_aliases_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          booking_url: string | null
          city: string
          created_at: string
          expedia_url: string | null
          google_place_id: string | null
          id: string
          kasa_aggregated_score: number | null
          kasa_review_count: number | null
          kasa_url: string | null
          name: string
          state: string
          tripadvisor_url: string | null
          user_id: string
          website_url: string | null
        }
        Insert: {
          booking_url?: string | null
          city: string
          created_at?: string
          expedia_url?: string | null
          google_place_id?: string | null
          id?: string
          kasa_aggregated_score?: number | null
          kasa_review_count?: number | null
          kasa_url?: string | null
          name: string
          state: string
          tripadvisor_url?: string | null
          user_id: string
          website_url?: string | null
        }
        Update: {
          booking_url?: string | null
          city?: string
          created_at?: string
          expedia_url?: string | null
          google_place_id?: string | null
          id?: string
          kasa_aggregated_score?: number | null
          kasa_review_count?: number | null
          kasa_url?: string | null
          name?: string
          state?: string
          tripadvisor_url?: string | null
          user_id?: string
          website_url?: string | null
        }
        Relationships: []
      }
      refresh_logs: {
        Row: {
          failures: number
          id: string
          run_at: string
          successes: number
          total_properties: number
        }
        Insert: {
          failures?: number
          id?: string
          run_at?: string
          successes?: number
          total_properties?: number
        }
        Update: {
          failures?: number
          id?: string
          run_at?: string
          successes?: number
          total_properties?: number
        }
        Relationships: []
      }
      review_analysis: {
        Row: {
          analyzed_at: string
          id: string
          negative_themes: Json
          positive_themes: Json
          property_id: string
          review_count: number
          summary: string | null
        }
        Insert: {
          analyzed_at?: string
          id?: string
          negative_themes?: Json
          positive_themes?: Json
          property_id: string
          review_count?: number
          summary?: string | null
        }
        Update: {
          analyzed_at?: string
          id?: string
          negative_themes?: Json
          positive_themes?: Json
          property_id?: string
          review_count?: number
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_analysis_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      review_texts: {
        Row: {
          collected_at: string
          id: string
          platform: Database["public"]["Enums"]["review_source"]
          property_id: string
          review_date: string | null
          review_rating: number | null
          review_text: string
          reviewer_name: string | null
        }
        Insert: {
          collected_at?: string
          id?: string
          platform: Database["public"]["Enums"]["review_source"]
          property_id: string
          review_date?: string | null
          review_rating?: number | null
          review_text: string
          reviewer_name?: string | null
        }
        Update: {
          collected_at?: string
          id?: string
          platform?: Database["public"]["Enums"]["review_source"]
          property_id?: string
          review_date?: string | null
          review_rating?: number | null
          review_text?: string
          reviewer_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_texts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      source_snapshots: {
        Row: {
          collected_at: string
          id: string
          normalized_score_0_10: number | null
          property_id: string
          review_count: number
          score_raw: number | null
          score_scale: number | null
          source: Database["public"]["Enums"]["review_source"]
          status: string
        }
        Insert: {
          collected_at?: string
          id?: string
          normalized_score_0_10?: number | null
          property_id: string
          review_count?: number
          score_raw?: number | null
          score_scale?: number | null
          source: Database["public"]["Enums"]["review_source"]
          status?: string
        }
        Update: {
          collected_at?: string
          id?: string
          normalized_score_0_10?: number | null
          property_id?: string
          review_count?: number
          score_raw?: number | null
          score_scale?: number | null
          source?: Database["public"]["Enums"]["review_source"]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_snapshots_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_duplicate_snapshots: {
        Args: never
        Returns: {
          deleted_count: number
        }[]
      }
      owns_group: { Args: { group_uuid: string }; Returns: boolean }
      owns_property: { Args: { property_uuid: string }; Returns: boolean }
    }
    Enums: {
      review_source: "google" | "tripadvisor" | "expedia" | "booking"
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
      review_source: ["google", "tripadvisor", "expedia", "booking"],
    },
  },
} as const
