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
      certificates: {
        Row: {
          date: string | null
          id: string
          issuer: string | null
          points: number | null
          position: string | null
          title: string | null
          type: string | null
          user_id: string | null
          verified: boolean | null
        }
        Insert: {
          date?: string | null
          id: string
          issuer?: string | null
          points?: number | null
          position?: string | null
          title?: string | null
          type?: string | null
          user_id?: string | null
          verified?: boolean | null
        }
        Update: {
          date?: string | null
          id?: string
          issuer?: string | null
          points?: number | null
          position?: string | null
          title?: string | null
          type?: string | null
          user_id?: string | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "certificates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          admin_id: string | null
          branches: string[] | null
          category: string | null
          club: string | null
          date: string | null
          desc: string | null
          emoji: string | null
          end_date: string | null
          end_time: string | null
          fee: number | null
          id: string
          max_participants: number | null
          name: string
          pending_payments: Json | null
          points: number | null
          poster: string | null
          reg_count: number | null
          registrations: Json | null
          rej_reason: string | null
          status: string | null
          time: string | null
          venue: string | null
        }
        Insert: {
          admin_id?: string | null
          branches?: string[] | null
          category?: string | null
          club?: string | null
          date?: string | null
          desc?: string | null
          emoji?: string | null
          end_date?: string | null
          end_time?: string | null
          fee?: number | null
          id: string
          max_participants?: number | null
          name: string
          pending_payments?: Json | null
          points?: number | null
          poster?: string | null
          reg_count?: number | null
          registrations?: Json | null
          rej_reason?: string | null
          status?: string | null
          time?: string | null
          venue?: string | null
        }
        Update: {
          admin_id?: string | null
          branches?: string[] | null
          category?: string | null
          club?: string | null
          date?: string | null
          desc?: string | null
          emoji?: string | null
          end_date?: string | null
          end_time?: string | null
          fee?: number | null
          id?: string
          max_participants?: number | null
          name?: string
          pending_payments?: Json | null
          points?: number | null
          poster?: string | null
          reg_count?: number | null
          registrations?: Json | null
          rej_reason?: string | null
          status?: string | null
          time?: string | null
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations: {
        Row: {
          event_id: string | null
          id: string
          payment_status: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          event_id?: string | null
          id?: string
          payment_status?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          event_id?: string | null
          id?: string
          payment_status?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          achievements: string[] | null
          admission_year: number | null
          approved: boolean | null
          bio: string | null
          branch: string | null
          club_email: string | null
          club_name: string | null
          dept: string | null
          desc: string | null
          designation: string | null
          domain: string | null
          email: string
          faculty: string | null
          github: string | null
          id: string
          interests: string[] | null
          linkedin: string | null
          name: string
          notifs: Json | null
          pass: string
          phone: string | null
          points: number | null
          points_by_sem: Json | null
          profile_photo: string | null
          resume: string | null
          section: string | null
          sem: string | null
          skills: string[] | null
          type: string
          usn: string | null
          year: string | null
        }
        Insert: {
          achievements?: string[] | null
          admission_year?: number | null
          approved?: boolean | null
          bio?: string | null
          branch?: string | null
          club_email?: string | null
          club_name?: string | null
          dept?: string | null
          desc?: string | null
          designation?: string | null
          domain?: string | null
          email: string
          faculty?: string | null
          github?: string | null
          id: string
          interests?: string[] | null
          linkedin?: string | null
          name: string
          notifs?: Json | null
          pass: string
          phone?: string | null
          points?: number | null
          points_by_sem?: Json | null
          profile_photo?: string | null
          resume?: string | null
          section?: string | null
          sem?: string | null
          skills?: string[] | null
          type: string
          usn?: string | null
          year?: string | null
        }
        Update: {
          achievements?: string[] | null
          admission_year?: number | null
          approved?: boolean | null
          bio?: string | null
          branch?: string | null
          club_email?: string | null
          club_name?: string | null
          dept?: string | null
          desc?: string | null
          designation?: string | null
          domain?: string | null
          email?: string
          faculty?: string | null
          github?: string | null
          id?: string
          interests?: string[] | null
          linkedin?: string | null
          name?: string
          notifs?: Json | null
          pass?: string
          phone?: string | null
          points?: number | null
          points_by_sem?: Json | null
          profile_photo?: string | null
          resume?: string | null
          section?: string | null
          sem?: string | null
          skills?: string[] | null
          type?: string
          usn?: string | null
          year?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

