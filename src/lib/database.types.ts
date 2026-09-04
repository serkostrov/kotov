export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type AppRole = 'owner' | 'prod_foreman' | 'install_foreman' | 'accountant'
export type ObjectStatus =
  | 'new'
  | 'in_production'
  | 'in_installation'
  | 'suspended'
  | 'completed'
  | 'cancelled'
export type StageType = 'production' | 'installation'
export type StageStatus = 'not_started' | 'in_progress' | 'done' | 'blocked'
export type ToolStatus = 'free' | 'on_object' | 'repair' | 'lost' | 'written_off'
export type ToolMovementType =
  | 'issue'
  | 'extra_delivery'
  | 'return'
  | 'transfer'
  | 'to_repair'
  | 'from_repair'
  | 'loss'
  | 'write_off'
export type AttachmentKind = 'photo' | 'video' | 'document'
export type RequestStatus = 'new' | 'approved' | 'purchased' | 'rejected'

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          phone: string | null
          position: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          phone?: string | null
          position?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          phone?: string | null
          position?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: AppRole
        }
        Insert: {
          id?: string
          user_id: string
          role: AppRole
        }
        Update: {
          id?: string
          user_id?: string
          role?: AppRole
        }
        Relationships: []
      }
      objects: {
        Row: {
          id: string
          name: string
          address: string | null
          customer_name: string | null
          customer_contact: string | null
          date_start: string | null
          date_plan_end: string | null
          date_fact_end: string | null
          contract_amount: number
          status: ObjectStatus
          responsible_id: string | null
          comment: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          customer_name?: string | null
          customer_contact?: string | null
          date_start?: string | null
          date_plan_end?: string | null
          date_fact_end?: string | null
          contract_amount?: number
          status?: ObjectStatus
          responsible_id?: string | null
          comment?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          deleted_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['objects']['Insert']>
        Relationships: []
      }
      object_members: {
        Row: {
          id: string
          object_id: string
          user_id: string
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          object_id: string
          user_id: string
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          object_id?: string
          user_id?: string
          note?: string | null
          created_at?: string
        }
        Relationships: []
      }
      stage_templates: {
        Row: {
          id: string
          stage_type: StageType
          name: string
          unit: string | null
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          stage_type: StageType
          name: string
          unit?: string | null
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['stage_templates']['Insert']>
        Relationships: []
      }
      object_stages: {
        Row: {
          id: string
          object_id: string
          stage_type: StageType
          template_id: string | null
          name: string
          unit: string | null
          qty_plan: number | null
          qty_fact: number | null
          progress_percent: number
          status: StageStatus
          date_start: string | null
          date_plan_end: string | null
          date_fact_end: string | null
          responsible_id: string | null
          comment: string | null
          sort_order: number
          created_at: string
          updated_at: string
          created_by: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          object_id: string
          stage_type: StageType
          template_id?: string | null
          name: string
          unit?: string | null
          qty_plan?: number | null
          qty_fact?: number | null
          progress_percent?: number
          status?: StageStatus
          date_start?: string | null
          date_plan_end?: string | null
          date_fact_end?: string | null
          responsible_id?: string | null
          comment?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
          created_by?: string | null
          deleted_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['object_stages']['Insert']>
        Relationships: []
      }
      tool_categories: {
        Row: {
          id: string
          name: string
          sort_order: number
          is_active: boolean
        }
        Insert: {
          id?: string
          name: string
          sort_order?: number
          is_active?: boolean
        }
        Update: Partial<Database['public']['Tables']['tool_categories']['Insert']>
        Relationships: []
      }
      tools: {
        Row: {
          id: string
          name: string
          inventory_number: string | null
          category_id: string | null
          status: ToolStatus
          current_object_id: string | null
          current_holder_id: string | null
          purchase_date: string | null
          purchase_price: number | null
          comment: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          inventory_number?: string | null
          category_id?: string | null
          status?: ToolStatus
          current_object_id?: string | null
          current_holder_id?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          comment?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          deleted_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['tools']['Insert']>
        Relationships: []
      }
      tool_movements: {
        Row: {
          id: string
          tool_id: string
          movement_type: ToolMovementType
          object_id: string | null
          from_holder_id: string | null
          to_holder_id: string | null
          moved_at: string
          comment: string | null
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          tool_id: string
          movement_type: ToolMovementType
          object_id?: string | null
          from_holder_id?: string | null
          to_holder_id?: string | null
          moved_at?: string
          comment?: string | null
          created_at?: string
          created_by?: string | null
        }
        Update: Partial<Database['public']['Tables']['tool_movements']['Insert']>
        Relationships: []
      }
      expense_categories: {
        Row: {
          id: string
          name: string
          sort_order: number
          is_active: boolean
        }
        Insert: {
          id?: string
          name: string
          sort_order?: number
          is_active?: boolean
        }
        Update: Partial<Database['public']['Tables']['expense_categories']['Insert']>
        Relationships: []
      }
      expenses: {
        Row: {
          id: string
          object_id: string
          stage_id: string | null
          category_id: string
          amount: number
          expense_date: string
          description: string | null
          vendor: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          object_id: string
          stage_id?: string | null
          category_id: string
          amount: number
          expense_date?: string
          description?: string | null
          vendor?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          deleted_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['expenses']['Insert']>
        Relationships: []
      }
      attachments: {
        Row: {
          id: string
          object_id: string
          stage_id: string | null
          expense_id: string | null
          tool_movement_id: string | null
          kind: AttachmentKind
          storage_path: string
          file_name: string
          mime_type: string | null
          file_size: number | null
          comment: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          object_id: string
          stage_id?: string | null
          expense_id?: string | null
          tool_movement_id?: string | null
          kind: AttachmentKind
          storage_path: string
          file_name: string
          mime_type?: string | null
          file_size?: number | null
          comment?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['attachments']['Insert']>
        Relationships: []
      }
      material_requests: {
        Row: {
          id: string
          object_id: string
          stage_id: string | null
          title: string
          details: string | null
          need_by: string | null
          status: RequestStatus
          resolved_by: string | null
          resolved_at: string | null
          resolve_comment: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          object_id: string
          stage_id?: string | null
          title: string
          details?: string | null
          need_by?: string | null
          status?: RequestStatus
          resolved_by?: string | null
          resolved_at?: string | null
          resolve_comment?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          deleted_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['material_requests']['Insert']>
        Relationships: []
      }
      activity_log: {
        Row: {
          id: string
          entity_type: string
          entity_id: string
          object_id: string | null
          action: string
          payload: Json | null
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          entity_type: string
          entity_id: string
          object_id?: string | null
          action: string
          payload?: Json | null
          created_at?: string
          created_by?: string | null
        }
        Update: Partial<Database['public']['Tables']['activity_log']['Insert']>
        Relationships: []
      }
      organization_profile: {
        Row: {
          id: string
          name: string
          details: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          details?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['organization_profile']['Insert']>
        Relationships: []
      }
    }
    Views: {
      v_object_economics: {
        Row: {
          object_id: string
          contract_amount: number
          expenses_total: number
          profit: number
          margin_percent: number | null
        }
        Relationships: []
      }
      v_object_expenses_by_category: {
        Row: {
          object_id: string
          category_id: string
          category_name: string
          amount_total: number
        }
        Relationships: []
      }
      v_object_expenses_by_contour: {
        Row: {
          object_id: string
          stage_type: StageType | null
          amount_total: number
        }
        Relationships: []
      }
      v_object_progress: {
        Row: {
          object_id: string
          progress_production: number | null
          progress_installation: number | null
          progress_total: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: { Args: { _role: AppRole }; Returns: boolean }
      is_owner: { Args: Record<string, never>; Returns: boolean }
      has_any_role: { Args: Record<string, never>; Returns: boolean }
      has_object_access: { Args: { _object_id: string }; Returns: boolean }
      create_tool_movement: {
        Args: {
          _tool_id: string
          _movement_type: ToolMovementType
          _object_id?: string | null
          _to_holder_id?: string | null
          _comment?: string | null
          _moved_at?: string | null
        }
        Returns: string
      }
      create_tool_movements_bulk: {
        Args: {
          _tool_ids: string[]
          _movement_type: ToolMovementType
          _object_id?: string | null
          _to_holder_id?: string | null
          _comment?: string | null
          _moved_at?: string | null
        }
        Returns: string[]
      }
    }
    Enums: {
      app_role: AppRole
      object_status: ObjectStatus
      stage_type: StageType
      stage_status: StageStatus
      tool_status: ToolStatus
      tool_movement_type: ToolMovementType
      attachment_kind: AttachmentKind
      request_status: RequestStatus
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
export type Views<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row']
