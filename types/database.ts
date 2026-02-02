export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      members: {
        Row: {
          id: string
          full_name: string
          phone: string
          email: string | null
          qr_code: string
          role: 'admin' | 'secretary' | 'member'
          status: 'active' | 'irregular' | 'at-risk' | 'inactive'
          registered_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          full_name: string
          phone: string
          email?: string | null
          qr_code: string
          role?: 'admin' | 'secretary' | 'member'
          status?: 'active' | 'irregular' | 'at-risk' | 'inactive'
          registered_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          phone?: string
          email?: string | null
          qr_code?: string
          role?: 'admin' | 'secretary' | 'member'
          status?: 'active' | 'irregular' | 'at-risk' | 'inactive'
          registered_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      events: {
        Row: {
          id: string
          title: string
          event_date: string
          start_time: string
          location: string | null
          status: 'upcoming' | 'active' | 'closed'
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          event_date: string
          start_time: string
          location?: string | null
          status?: 'upcoming' | 'active' | 'closed'
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          event_date?: string
          start_time?: string
          location?: string | null
          status?: 'upcoming' | 'active' | 'closed'
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      attendance: {
        Row: {
          id: string
          member_id: string
          event_id: string
          check_in_at: string
          status: 'early' | 'on-time' | 'late' | 'excused' | 'absent'
          method: 'qr-scan' | 'manual' | 'self-checkin'
          is_excused: boolean
          notes: string | null
          recorded_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          member_id: string
          event_id: string
          check_in_at: string
          status: 'early' | 'on-time' | 'late' | 'excused' | 'absent'
          method?: 'qr-scan' | 'manual' | 'self-checkin'
          is_excused?: boolean
          notes?: string | null
          recorded_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          member_id?: string
          event_id?: string
          check_in_at?: string
          status?: 'early' | 'on-time' | 'late' | 'excused' | 'absent'
          method?: 'qr-scan' | 'manual' | 'self-checkin'
          is_excused?: boolean
          notes?: string | null
          recorded_by?: string | null
          created_at?: string
          updated_at?: string
        }
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
  }
}
