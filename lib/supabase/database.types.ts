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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_actions: {
        Row: {
          action_type: string
          admin_id: string | null
          admin_label: string
          created_at: string
          id: string
          metadata: Json
          reason: string | null
          target_hoarding_id: string | null
          target_publisher_id: string | null
        }
        Insert: {
          action_type: string
          admin_id?: string | null
          admin_label: string
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          target_hoarding_id?: string | null
          target_publisher_id?: string | null
        }
        Update: {
          action_type?: string
          admin_id?: string | null
          admin_label?: string
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          target_hoarding_id?: string | null
          target_publisher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_actions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_actions_target_hoarding_id_fkey"
            columns: ["target_hoarding_id"]
            isOneToOne: false
            referencedRelation: "hoardings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_actions_target_hoarding_id_fkey"
            columns: ["target_hoarding_id"]
            isOneToOne: false
            referencedRelation: "public_hoarding_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_actions_target_hoarding_id_fkey"
            columns: ["target_hoarding_id"]
            isOneToOne: false
            referencedRelation: "public_hoarding_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_actions_target_hoarding_id_fkey"
            columns: ["target_hoarding_id"]
            isOneToOne: false
            referencedRelation: "visible_hoardings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_actions_target_publisher_id_fkey"
            columns: ["target_publisher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          properties: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          properties?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          properties?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_idempotency_keys: {
        Row: {
          created_at: string
          endpoint: string
          key: string
          request_id: string | null
          response_json: Json
          status_code: number
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          key: string
          request_id?: string | null
          response_json: Json
          status_code: number
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          key?: string
          request_id?: string | null
          response_json?: Json
          status_code?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_idempotency_keys_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "publisher_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_idempotency_keys_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_idempotency_keys_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "viewer_request_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_idempotency_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hoarding_availability_blocks: {
        Row: {
          created_at: string
          date_range: unknown
          end_date: string
          hoarding_id: string
          id: string
          reason: string | null
          start_date: string
        }
        Insert: {
          created_at?: string
          date_range?: unknown
          end_date: string
          hoarding_id: string
          id?: string
          reason?: string | null
          start_date: string
        }
        Update: {
          created_at?: string
          date_range?: unknown
          end_date?: string
          hoarding_id?: string
          id?: string
          reason?: string | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "hoarding_availability_blocks_hoarding_id_fkey"
            columns: ["hoarding_id"]
            isOneToOne: false
            referencedRelation: "hoardings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoarding_availability_blocks_hoarding_id_fkey"
            columns: ["hoarding_id"]
            isOneToOne: false
            referencedRelation: "public_hoarding_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoarding_availability_blocks_hoarding_id_fkey"
            columns: ["hoarding_id"]
            isOneToOne: false
            referencedRelation: "public_hoarding_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoarding_availability_blocks_hoarding_id_fkey"
            columns: ["hoarding_id"]
            isOneToOne: false
            referencedRelation: "visible_hoardings"
            referencedColumns: ["id"]
          },
        ]
      }
      hoarding_media: {
        Row: {
          created_at: string
          display_order: number
          hoarding_id: string
          id: string
          is_primary: boolean
          media_type: string
          original_storage_path: string | null
          processing_status: string
          storage_path: string
          watermarked_at: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          hoarding_id: string
          id?: string
          is_primary?: boolean
          media_type?: string
          original_storage_path?: string | null
          processing_status?: string
          storage_path: string
          watermarked_at?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number
          hoarding_id?: string
          id?: string
          is_primary?: boolean
          media_type?: string
          original_storage_path?: string | null
          processing_status?: string
          storage_path?: string
          watermarked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hoarding_media_hoarding_id_fkey"
            columns: ["hoarding_id"]
            isOneToOne: false
            referencedRelation: "hoardings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoarding_media_hoarding_id_fkey"
            columns: ["hoarding_id"]
            isOneToOne: false
            referencedRelation: "public_hoarding_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoarding_media_hoarding_id_fkey"
            columns: ["hoarding_id"]
            isOneToOne: false
            referencedRelation: "public_hoarding_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoarding_media_hoarding_id_fkey"
            columns: ["hoarding_id"]
            isOneToOne: false
            referencedRelation: "visible_hoardings"
            referencedColumns: ["id"]
          },
        ]
      }
      hoarding_types: {
        Row: {
          code: string
          created_at: string
          description: string | null
          display_name: string
          is_digital: boolean
          required_attribute_keys: string[]
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          display_name: string
          is_digital?: boolean
          required_attribute_keys?: string[]
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          display_name?: string
          is_digital?: boolean
          required_attribute_keys?: string[]
        }
        Relationships: []
      }
      hoardings: {
        Row: {
          address_text: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          attributes: Json
          city: string
          created_at: string
          delist_reason: string | null
          delisted_at: string | null
          delisted_by: string | null
          description: string | null
          id: string
          is_delisted: boolean
          is_paused: boolean
          latitude: number | null
          locality: string | null
          longitude: number | null
          paused_at: string | null
          price: number | null
          price_unit: string
          publisher_id: string
          rejection_reason: string | null
          site_intelligence: Json
          site_intelligence_complete: boolean
          size: string | null
          title: string
          type_code: string
          updated_at: string
        }
        Insert: {
          address_text?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          attributes?: Json
          city?: string
          created_at?: string
          delist_reason?: string | null
          delisted_at?: string | null
          delisted_by?: string | null
          description?: string | null
          id?: string
          is_delisted?: boolean
          is_paused?: boolean
          latitude?: number | null
          locality?: string | null
          longitude?: number | null
          paused_at?: string | null
          price?: number | null
          price_unit?: string
          publisher_id: string
          rejection_reason?: string | null
          site_intelligence?: Json
          site_intelligence_complete?: boolean
          size?: string | null
          title: string
          type_code: string
          updated_at?: string
        }
        Update: {
          address_text?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          attributes?: Json
          city?: string
          created_at?: string
          delist_reason?: string | null
          delisted_at?: string | null
          delisted_by?: string | null
          description?: string | null
          id?: string
          is_delisted?: boolean
          is_paused?: boolean
          latitude?: number | null
          locality?: string | null
          longitude?: number | null
          paused_at?: string | null
          price?: number | null
          price_unit?: string
          publisher_id?: string
          rejection_reason?: string | null
          site_intelligence?: Json
          site_intelligence_complete?: boolean
          size?: string | null
          title?: string
          type_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hoardings_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoardings_delisted_by_fkey"
            columns: ["delisted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoardings_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoardings_type_code_fkey"
            columns: ["type_code"]
            isOneToOne: false
            referencedRelation: "hoarding_types"
            referencedColumns: ["code"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          read_at: string | null
          recipient_id: string
          related_hoarding_id: string | null
          related_request_id: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          read_at?: string | null
          recipient_id: string
          related_hoarding_id?: string | null
          related_request_id?: string | null
          title: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          read_at?: string | null
          recipient_id?: string
          related_hoarding_id?: string | null
          related_request_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_hoarding_id_fkey"
            columns: ["related_hoarding_id"]
            isOneToOne: false
            referencedRelation: "hoardings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_hoarding_id_fkey"
            columns: ["related_hoarding_id"]
            isOneToOne: false
            referencedRelation: "public_hoarding_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_hoarding_id_fkey"
            columns: ["related_hoarding_id"]
            isOneToOne: false
            referencedRelation: "public_hoarding_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_hoarding_id_fkey"
            columns: ["related_hoarding_id"]
            isOneToOne: false
            referencedRelation: "visible_hoardings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_request_id_fkey"
            columns: ["related_request_id"]
            isOneToOne: false
            referencedRelation: "publisher_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_request_id_fkey"
            columns: ["related_request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_request_id_fkey"
            columns: ["related_request_id"]
            isOneToOne: false
            referencedRelation: "viewer_request_list"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          city: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          role: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      publisher_profiles: {
        Row: {
          business_name: string | null
          created_at: string
          id: string
          suspended: boolean
          suspended_at: string | null
          suspended_by: string | null
          suspension_reason: string | null
          updated_at: string
          verification_rejection_reason: string | null
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          business_name?: string | null
          created_at?: string
          id: string
          suspended?: boolean
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          updated_at?: string
          verification_rejection_reason?: string | null
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          business_name?: string | null
          created_at?: string
          id?: string
          suspended?: boolean
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          updated_at?: string
          verification_rejection_reason?: string | null
          verification_status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publisher_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publisher_profiles_suspended_by_fkey"
            columns: ["suspended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      request_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_status: string | null
          id: string
          note: string | null
          request_id: string
          to_status: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_status?: string | null
          id?: string
          note?: string | null
          request_id: string
          to_status: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_status?: string | null
          id?: string
          note?: string | null
          request_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_status_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "publisher_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_status_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_status_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "viewer_request_list"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          amount_agreed: number | null
          completed_at: string | null
          completed_by: string | null
          confirmed_at: string | null
          created_at: string
          end_date: string
          expired_at: string | null
          hoarding_id: string
          id: string
          live_at: string | null
          message: string | null
          publisher_id: string
          rejected_at: string | null
          rejection_reason: string | null
          sla_deadline: string | null
          start_date: string
          status: string
          stay_range: unknown
          updated_at: string
          viewer_id: string
        }
        Insert: {
          amount_agreed?: number | null
          completed_at?: string | null
          completed_by?: string | null
          confirmed_at?: string | null
          created_at?: string
          end_date: string
          expired_at?: string | null
          hoarding_id: string
          id?: string
          live_at?: string | null
          message?: string | null
          publisher_id: string
          rejected_at?: string | null
          rejection_reason?: string | null
          sla_deadline?: string | null
          start_date: string
          status?: string
          stay_range?: unknown
          updated_at?: string
          viewer_id: string
        }
        Update: {
          amount_agreed?: number | null
          completed_at?: string | null
          completed_by?: string | null
          confirmed_at?: string | null
          created_at?: string
          end_date?: string
          expired_at?: string | null
          hoarding_id?: string
          id?: string
          live_at?: string | null
          message?: string | null
          publisher_id?: string
          rejected_at?: string | null
          rejection_reason?: string | null
          sla_deadline?: string | null
          start_date?: string
          status?: string
          stay_range?: unknown
          updated_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_hoarding_id_fkey"
            columns: ["hoarding_id"]
            isOneToOne: false
            referencedRelation: "hoardings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_hoarding_id_fkey"
            columns: ["hoarding_id"]
            isOneToOne: false
            referencedRelation: "public_hoarding_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_hoarding_id_fkey"
            columns: ["hoarding_id"]
            isOneToOne: false
            referencedRelation: "public_hoarding_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_hoarding_id_fkey"
            columns: ["hoarding_id"]
            isOneToOne: false
            referencedRelation: "visible_hoardings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_hoarding_detail: {
        Row: {
          address_text: string | null
          attributes: Json | null
          blocked_ranges: Json | null
          booked_ranges: Json | null
          city: string | null
          created_at: string | null
          description: string | null
          id: string | null
          latitude: number | null
          locality: string | null
          longitude: number | null
          media: Json | null
          price: number | null
          price_unit: string | null
          publisher_business_name: string | null
          publisher_is_verified: boolean | null
          site_intelligence: Json | null
          site_intelligence_complete: boolean | null
          size: string | null
          title: string | null
          type_code: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hoardings_type_code_fkey"
            columns: ["type_code"]
            isOneToOne: false
            referencedRelation: "hoarding_types"
            referencedColumns: ["code"]
          },
        ]
      }
      public_hoarding_listings: {
        Row: {
          address_text: string | null
          attributes: Json | null
          city: string | null
          created_at: string | null
          description: string | null
          id: string | null
          latitude: number | null
          locality: string | null
          longitude: number | null
          price: number | null
          price_unit: string | null
          publisher_business_name: string | null
          publisher_is_verified: boolean | null
          site_intelligence: Json | null
          site_intelligence_complete: boolean | null
          size: string | null
          title: string | null
          type_code: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hoardings_type_code_fkey"
            columns: ["type_code"]
            isOneToOne: false
            referencedRelation: "hoarding_types"
            referencedColumns: ["code"]
          },
        ]
      }
      publisher_inbox: {
        Row: {
          amount_agreed: number | null
          completed_at: string | null
          completed_by: string | null
          confirmed_at: string | null
          created_at: string | null
          end_date: string | null
          expired_at: string | null
          hoarding_city: string | null
          hoarding_id: string | null
          hoarding_is_listed: boolean | null
          hoarding_locality: string | null
          hoarding_price: number | null
          hoarding_price_unit: string | null
          hoarding_primary_media_path: string | null
          hoarding_title: string | null
          hoarding_type_code: string | null
          id: string | null
          live_at: string | null
          message: string | null
          publisher_id: string | null
          rejected_at: string | null
          rejection_reason: string | null
          sla_deadline: string | null
          start_date: string | null
          status: string | null
          stay_range: unknown
          updated_at: string | null
          viewer_id: string | null
          viewer_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hoardings_type_code_fkey"
            columns: ["hoarding_type_code"]
            isOneToOne: false
            referencedRelation: "hoarding_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "requests_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_hoarding_id_fkey"
            columns: ["hoarding_id"]
            isOneToOne: false
            referencedRelation: "hoardings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_hoarding_id_fkey"
            columns: ["hoarding_id"]
            isOneToOne: false
            referencedRelation: "public_hoarding_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_hoarding_id_fkey"
            columns: ["hoarding_id"]
            isOneToOne: false
            referencedRelation: "public_hoarding_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_hoarding_id_fkey"
            columns: ["hoarding_id"]
            isOneToOne: false
            referencedRelation: "visible_hoardings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      viewer_request_list: {
        Row: {
          amount_agreed: number | null
          completed_at: string | null
          completed_by: string | null
          confirmed_at: string | null
          created_at: string | null
          end_date: string | null
          expired_at: string | null
          hoarding_city: string | null
          hoarding_id: string | null
          hoarding_is_listed: boolean | null
          hoarding_locality: string | null
          hoarding_price: number | null
          hoarding_price_unit: string | null
          hoarding_primary_media_path: string | null
          hoarding_title: string | null
          hoarding_type_code: string | null
          id: string | null
          live_at: string | null
          message: string | null
          publisher_business_name: string | null
          publisher_id: string | null
          rejected_at: string | null
          rejection_reason: string | null
          sla_deadline: string | null
          start_date: string | null
          status: string | null
          stay_range: unknown
          updated_at: string | null
          viewer_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hoardings_type_code_fkey"
            columns: ["hoarding_type_code"]
            isOneToOne: false
            referencedRelation: "hoarding_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "requests_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_hoarding_id_fkey"
            columns: ["hoarding_id"]
            isOneToOne: false
            referencedRelation: "hoardings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_hoarding_id_fkey"
            columns: ["hoarding_id"]
            isOneToOne: false
            referencedRelation: "public_hoarding_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_hoarding_id_fkey"
            columns: ["hoarding_id"]
            isOneToOne: false
            referencedRelation: "public_hoarding_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_hoarding_id_fkey"
            columns: ["hoarding_id"]
            isOneToOne: false
            referencedRelation: "visible_hoardings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      visible_hoardings: {
        Row: {
          address_text: string | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          attributes: Json | null
          city: string | null
          created_at: string | null
          delist_reason: string | null
          delisted_at: string | null
          delisted_by: string | null
          description: string | null
          id: string | null
          is_delisted: boolean | null
          is_paused: boolean | null
          latitude: number | null
          locality: string | null
          longitude: number | null
          paused_at: string | null
          price: number | null
          price_unit: string | null
          publisher_id: string | null
          rejection_reason: string | null
          site_intelligence: Json | null
          site_intelligence_complete: boolean | null
          size: string | null
          title: string | null
          type_code: string | null
          updated_at: string | null
        }
        Insert: {
          address_text?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attributes?: Json | null
          city?: string | null
          created_at?: string | null
          delist_reason?: string | null
          delisted_at?: string | null
          delisted_by?: string | null
          description?: string | null
          id?: string | null
          is_delisted?: boolean | null
          is_paused?: boolean | null
          latitude?: number | null
          locality?: string | null
          longitude?: number | null
          paused_at?: string | null
          price?: number | null
          price_unit?: string | null
          publisher_id?: string | null
          rejection_reason?: string | null
          site_intelligence?: Json | null
          site_intelligence_complete?: boolean | null
          size?: string | null
          title?: string | null
          type_code?: string | null
          updated_at?: string | null
        }
        Update: {
          address_text?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attributes?: Json | null
          city?: string | null
          created_at?: string | null
          delist_reason?: string | null
          delisted_at?: string | null
          delisted_by?: string | null
          description?: string | null
          id?: string | null
          is_delisted?: boolean | null
          is_paused?: boolean | null
          latitude?: number | null
          locality?: string | null
          longitude?: number | null
          paused_at?: string | null
          price?: number | null
          price_unit?: string | null
          publisher_id?: string | null
          rejection_reason?: string | null
          site_intelligence?: Json | null
          site_intelligence_complete?: boolean | null
          size?: string | null
          title?: string | null
          type_code?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hoardings_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoardings_delisted_by_fkey"
            columns: ["delisted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoardings_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoardings_type_code_fkey"
            columns: ["type_code"]
            isOneToOne: false
            referencedRelation: "hoarding_types"
            referencedColumns: ["code"]
          },
        ]
      }
    }
    Functions: {
      admin_dashboard_summary: {
        Args: never
        Returns: {
          approved_listings: number
          confirmed_requests: number
          pending_listings: number
          request_to_confirmation_rate: number
          total_listings: number
          total_publishers: number
          total_requests: number
          verified_publishers: number
        }[]
      }
      admin_listing_queue: {
        Args: never
        Returns: {
          address_text: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          attributes: Json
          city: string
          created_at: string
          delist_reason: string | null
          delisted_at: string | null
          delisted_by: string | null
          description: string | null
          id: string
          is_delisted: boolean
          is_paused: boolean
          latitude: number | null
          locality: string | null
          longitude: number | null
          paused_at: string | null
          price: number | null
          price_unit: string
          publisher_id: string
          rejection_reason: string | null
          site_intelligence: Json
          site_intelligence_complete: boolean
          size: string | null
          title: string
          type_code: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "hoardings"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      approve_listing: {
        Args: { p_hoarding_id: string }
        Returns: {
          address_text: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          attributes: Json
          city: string
          created_at: string
          delist_reason: string | null
          delisted_at: string | null
          delisted_by: string | null
          description: string | null
          id: string
          is_delisted: boolean
          is_paused: boolean
          latitude: number | null
          locality: string | null
          longitude: number | null
          paused_at: string | null
          price: number | null
          price_unit: string
          publisher_id: string
          rejection_reason: string | null
          site_intelligence: Json
          site_intelligence_complete: boolean
          size: string | null
          title: string
          type_code: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "hoardings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_request: {
        Args: { p_request_id: string }
        Returns: {
          amount_agreed: number | null
          completed_at: string | null
          completed_by: string | null
          confirmed_at: string | null
          created_at: string
          end_date: string
          expired_at: string | null
          hoarding_id: string
          id: string
          live_at: string | null
          message: string | null
          publisher_id: string
          rejected_at: string | null
          rejection_reason: string | null
          sla_deadline: string | null
          start_date: string
          status: string
          stay_range: unknown
          updated_at: string
          viewer_id: string
        }
        SetofOptions: {
          from: "*"
          to: "requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      default_expiring_soon_window: { Args: never; Returns: string }
      default_response_sla: { Args: never; Returns: string }
      delete_hoarding: { Args: { p_hoarding_id: string }; Returns: undefined }
      delist_hoarding: {
        Args: { p_hoarding_id: string; p_reason?: string }
        Returns: {
          address_text: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          attributes: Json
          city: string
          created_at: string
          delist_reason: string | null
          delisted_at: string | null
          delisted_by: string | null
          description: string | null
          id: string
          is_delisted: boolean
          is_paused: boolean
          latitude: number | null
          locality: string | null
          longitude: number | null
          paused_at: string | null
          price: number | null
          price_unit: string
          publisher_id: string
          rejection_reason: string | null
          site_intelligence: Json
          site_intelligence_complete: boolean
          size: string | null
          title: string
          type_code: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "hoardings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      expire_stale_requests: { Args: never; Returns: number }
      get_original_media_path: { Args: { p_media_id: string }; Returns: string }
      get_request_history: {
        Args: { p_request_id: string }
        Returns: {
          actor_id: string
          actor_role: string
          changed_at: string
          from_status: string
          note: string
          to_status: string
        }[]
      }
      haversine_km: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      hoarding_has_required_attributes: {
        Args: { p_hoarding_id: string }
        Returns: boolean
      }
      hoarding_missing_attribute_keys: {
        Args: { p_hoarding_id: string }
        Returns: string[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_hoarding_available: {
        Args: {
          p_end_date: string
          p_hoarding_id: string
          p_start_date: string
        }
        Returns: boolean
      }
      mark_request_completed: {
        Args: { p_request_id: string }
        Returns: {
          amount_agreed: number | null
          completed_at: string | null
          completed_by: string | null
          confirmed_at: string | null
          created_at: string
          end_date: string
          expired_at: string | null
          hoarding_id: string
          id: string
          live_at: string | null
          message: string | null
          publisher_id: string
          rejected_at: string | null
          rejection_reason: string | null
          sla_deadline: string | null
          start_date: string
          status: string
          stay_range: unknown
          updated_at: string
          viewer_id: string
        }
        SetofOptions: {
          from: "*"
          to: "requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      notify_expiring_soon_requests: { Args: never; Returns: number }
      owns_hoarding: { Args: { p_hoarding_id: string }; Returns: boolean }
      promote_confirmed_to_live: { Args: never; Returns: number }
      reject_listing: {
        Args: { p_hoarding_id: string; p_reason: string }
        Returns: {
          address_text: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          attributes: Json
          city: string
          created_at: string
          delist_reason: string | null
          delisted_at: string | null
          delisted_by: string | null
          description: string | null
          id: string
          is_delisted: boolean
          is_paused: boolean
          latitude: number | null
          locality: string | null
          longitude: number | null
          paused_at: string | null
          price: number | null
          price_unit: string
          publisher_id: string
          rejection_reason: string | null
          site_intelligence: Json
          site_intelligence_complete: boolean
          size: string | null
          title: string
          type_code: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "hoardings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reject_publisher_verification: {
        Args: { p_publisher_id: string; p_reason?: string }
        Returns: {
          business_name: string | null
          created_at: string
          id: string
          suspended: boolean
          suspended_at: string | null
          suspended_by: string | null
          suspension_reason: string | null
          updated_at: string
          verification_rejection_reason: string | null
          verification_status: string
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "publisher_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reject_request: {
        Args: { p_reason?: string; p_request_id: string }
        Returns: {
          amount_agreed: number | null
          completed_at: string | null
          completed_by: string | null
          confirmed_at: string | null
          created_at: string
          end_date: string
          expired_at: string | null
          hoarding_id: string
          id: string
          live_at: string | null
          message: string | null
          publisher_id: string
          rejected_at: string | null
          rejection_reason: string | null
          sla_deadline: string | null
          start_date: string
          status: string
          stay_range: unknown
          updated_at: string
          viewer_id: string
        }
        SetofOptions: {
          from: "*"
          to: "requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      relist_hoarding: {
        Args: { p_hoarding_id: string }
        Returns: {
          address_text: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          attributes: Json
          city: string
          created_at: string
          delist_reason: string | null
          delisted_at: string | null
          delisted_by: string | null
          description: string | null
          id: string
          is_delisted: boolean
          is_paused: boolean
          latitude: number | null
          locality: string | null
          longitude: number | null
          paused_at: string | null
          price: number | null
          price_unit: string
          publisher_id: string
          rejection_reason: string | null
          site_intelligence: Json
          site_intelligence_complete: boolean
          size: string | null
          title: string
          type_code: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "hoardings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      search_available_hoardings: {
        Args: {
          p_center_lat?: number
          p_center_lng?: number
          p_city?: string
          p_limit?: number
          p_max_price_monthly?: number
          p_offset?: number
          p_radius_km?: number
          p_sort?: string
          p_type_code?: string
        }
        Returns: {
          address_text: string
          attributes: Json
          city: string
          created_at: string
          distance_km: number
          id: string
          latitude: number
          locality: string
          longitude: number
          next_available_date: string
          price: number
          price_unit: string
          publisher_business_name: string
          publisher_is_verified: boolean
          site_intelligence: Json
          site_intelligence_complete: boolean
          size: string
          title: string
          total_count: number
          type_code: string
        }[]
      }
      set_request_amount_agreed: {
        Args: { p_amount: number; p_request_id: string }
        Returns: {
          amount_agreed: number | null
          completed_at: string | null
          completed_by: string | null
          confirmed_at: string | null
          created_at: string
          end_date: string
          expired_at: string | null
          hoarding_id: string
          id: string
          live_at: string | null
          message: string | null
          publisher_id: string
          rejected_at: string | null
          rejection_reason: string | null
          sla_deadline: string | null
          start_date: string
          status: string
          stay_range: unknown
          updated_at: string
          viewer_id: string
        }
        SetofOptions: {
          from: "*"
          to: "requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_hoarding_for_review: {
        Args: { p_hoarding_id: string }
        Returns: {
          address_text: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          attributes: Json
          city: string
          created_at: string
          delist_reason: string | null
          delisted_at: string | null
          delisted_by: string | null
          description: string | null
          id: string
          is_delisted: boolean
          is_paused: boolean
          latitude: number | null
          locality: string | null
          longitude: number | null
          paused_at: string | null
          price: number | null
          price_unit: string
          publisher_id: string
          rejection_reason: string | null
          site_intelligence: Json
          site_intelligence_complete: boolean
          size: string | null
          title: string
          type_code: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "hoardings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      suspend_publisher: {
        Args: { p_publisher_id: string; p_reason?: string }
        Returns: {
          business_name: string | null
          created_at: string
          id: string
          suspended: boolean
          suspended_at: string | null
          suspended_by: string | null
          suspension_reason: string | null
          updated_at: string
          verification_rejection_reason: string | null
          verification_status: string
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "publisher_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      unsuspend_publisher: {
        Args: { p_publisher_id: string }
        Returns: {
          business_name: string | null
          created_at: string
          id: string
          suspended: boolean
          suspended_at: string | null
          suspended_by: string | null
          suspension_reason: string | null
          updated_at: string
          verification_rejection_reason: string | null
          verification_status: string
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "publisher_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verify_publisher: {
        Args: { p_publisher_id: string }
        Returns: {
          business_name: string | null
          created_at: string
          id: string
          suspended: boolean
          suspended_at: string | null
          suspended_by: string | null
          suspension_reason: string | null
          updated_at: string
          verification_rejection_reason: string | null
          verification_status: string
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "publisher_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
