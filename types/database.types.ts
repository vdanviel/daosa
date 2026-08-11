export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      org: {
        Row: {
          id: number;
          company_name: string | null;
          cnpj: string | null;
          email: string | null;
          phone: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          company_name?: string | null;
          cnpj?: string | null;
          email?: string | null;
          phone?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          company_name?: string | null;
          cnpj?: string | null;
          email?: string | null;
          phone?: string | null;
          created_at?: string;
        };
      };
      tenant: {
        Row: {
          id: number;
          name: string | null;
          password: string | null;
          email: string | null;
          auth_user_id: string | null;
          org_id: number | null;
          is_master: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          name?: string | null;
          password?: string | null;
          email?: string | null;
          auth_user_id?: string | null;
          org_id?: number | null;
          is_master?: boolean;
          created_at?: string;
        };
        Update: {
          id?: number;
          name?: string | null;
          password?: string | null;
          email?: string | null;
          auth_user_id?: string | null;
          org_id?: number | null;
          is_master?: boolean;
          created_at?: string;
        };
      };
      stream_connection: {
        Row: {
          id: number;
          tenant_id: number | null;
          stream_type: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          tenant_id?: number | null;
          stream_type?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: number;
          tenant_id?: number | null;
          stream_type?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
      };
      drive_auth: {
        Row: {
          id: number;
          drive_type: string | null;
          tenant_id: number | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          drive_type?: string | null;
          tenant_id?: number | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          drive_type?: string | null;
          tenant_id?: number | null;
          created_at?: string;
        };
      };
      eav_config: {
        Row: {
          id: number;
          created_at: string;
          key: string | null;
          value: string | null;
          stream: number | null;
          drive: number | null;
        };
        Insert: {
          id?: number;
          created_at?: string;
          key?: string | null;
          value?: string | null;
          stream?: number | null;
          drive?: number | null;
        };
        Update: {
          id?: number;
          created_at?: string;
          key?: string | null;
          value?: string | null;
          stream?: number | null;
          drive?: number | null;
        };
      };
      qdrant_metadata: {
        Row: {
          id: number;
          tenant_id: number | null;
          qdrant_collection_name: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          tenant_id?: number | null;
          qdrant_collection_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          tenant_id?: number | null;
          qdrant_collection_name?: string | null;
          created_at?: string;
        };
      };
      message_history: {
        Row: {
          id: number;
          tenant_id: number | null;
          stream_type: string | null;
          external_user_id: string | null;
          message: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          tenant_id?: number | null;
          stream_type?: string | null;
          external_user_id?: string | null;
          message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          tenant_id?: number | null;
          stream_type?: string | null;
          external_user_id?: string | null;
          message?: string | null;
          created_at?: string;
        };
      };
    };
  };
}
