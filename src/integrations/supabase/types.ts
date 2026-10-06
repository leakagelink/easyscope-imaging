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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      clinic_locations: {
        Row: {
          address: string
          clinic_id: string
          created_at: string
          doctor_id: string
          id: string
          location_name: string
          phone: string
          updated_at: string
        }
        Insert: {
          address?: string
          clinic_id: string
          created_at?: string
          doctor_id: string
          id?: string
          location_name: string
          phone?: string
          updated_at?: string
        }
        Update: {
          address?: string
          clinic_id?: string
          created_at?: string
          doctor_id?: string
          id?: string
          location_name?: string
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_locations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_media: {
        Row: {
          capture_source: string
          captured_at: string
          created_at: string
          doctor_id: string
          file_name: string
          file_type: string
          file_url: string
          id: string
          patient_id: string
          report_id: string | null
          sort_order: number
        }
        Insert: {
          capture_source?: string
          captured_at?: string
          created_at?: string
          doctor_id: string
          file_name?: string
          file_type?: string
          file_url: string
          id?: string
          patient_id: string
          report_id?: string | null
          sort_order?: number
        }
        Update: {
          capture_source?: string
          captured_at?: string
          created_at?: string
          doctor_id?: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          patient_id?: string
          report_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "clinical_media_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_media_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          address: string
          clinic_name: string
          created_at: string
          doctor_id: string
          email: string
          id: string
          is_primary: boolean
          logo_url: string | null
          phone: string
          updated_at: string
          website: string
        }
        Insert: {
          address?: string
          clinic_name?: string
          created_at?: string
          doctor_id: string
          email?: string
          id?: string
          is_primary?: boolean
          logo_url?: string | null
          phone?: string
          updated_at?: string
          website?: string
        }
        Update: {
          address?: string
          clinic_name?: string
          created_at?: string
          doctor_id?: string
          email?: string
          id?: string
          is_primary?: boolean
          logo_url?: string | null
          phone?: string
          updated_at?: string
          website?: string
        }
        Relationships: []
      }
      doctors: {
        Row: {
          clinic_stamp_url: string | null
          created_at: string
          disclaimer_text: string
          doctor_name: string
          id: string
          qualification: string
          registration_number: string
          show_clinic_stamp: boolean
          show_disclaimer: boolean
          show_signature: boolean
          show_stamp: boolean
          signature_url: string | null
          stamp_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          clinic_stamp_url?: string | null
          created_at?: string
          disclaimer_text?: string
          doctor_name?: string
          id?: string
          qualification?: string
          registration_number?: string
          show_clinic_stamp?: boolean
          show_disclaimer?: boolean
          show_signature?: boolean
          show_stamp?: boolean
          signature_url?: string | null
          stamp_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          clinic_stamp_url?: string | null
          created_at?: string
          disclaimer_text?: string
          doctor_name?: string
          id?: string
          qualification?: string
          registration_number?: string
          show_clinic_stamp?: boolean
          show_disclaimer?: boolean
          show_signature?: boolean
          show_stamp?: boolean
          signature_url?: string | null
          stamp_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      patients: {
        Row: {
          age: number
          created_at: string
          date_of_birth: string | null
          doctor_id: string
          gender: string
          id: string
          name: string
          patient_id: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          age: number
          created_at?: string
          date_of_birth?: string | null
          doctor_id: string
          gender: string
          id?: string
          name: string
          patient_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          age?: number
          created_at?: string
          date_of_birth?: string | null
          doctor_id?: string
          gender?: string
          id?: string
          name?: string
          patient_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          additional_notes: string
          clinic_id: string | null
          clinic_location_id: string | null
          created_at: string
          diagnosis_findings: string
          doctor_id: string
          examination_date: string | null
          id: string
          patient_id: string
          pdf_url: string | null
          report_date: string
          report_number: string
          shared_at: string | null
          updated_at: string
        }
        Insert: {
          additional_notes?: string
          clinic_id?: string | null
          clinic_location_id?: string | null
          created_at?: string
          diagnosis_findings?: string
          doctor_id: string
          examination_date?: string | null
          id?: string
          patient_id: string
          pdf_url?: string | null
          report_date?: string
          report_number: string
          shared_at?: string | null
          updated_at?: string
        }
        Update: {
          additional_notes?: string
          clinic_id?: string | null
          clinic_location_id?: string | null
          created_at?: string
          diagnosis_findings?: string
          doctor_id?: string
          examination_date?: string | null
          id?: string
          patient_id?: string
          pdf_url?: string | null
          report_date?: string
          report_number?: string
          shared_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_clinic_location_id_fkey"
            columns: ["clinic_location_id"]
            isOneToOne: false
            referencedRelation: "clinic_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
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
