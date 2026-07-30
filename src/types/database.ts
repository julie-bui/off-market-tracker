export type PropertyStatus =
  | "coming_available_soon"
  | "under_construction"
  | "spacepoint_client"
  | "undergoing_refurbishment";

export type PropertyFileType = "brochure" | "image";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      properties: {
        Row: {
          id: string;
          address: string;
          postcode: string | null;
          latitude: number | null;
          longitude: number | null;
          size_sqft: number | null;
          cost_per_sqft: number | null;
          availability_period: string | null;
          status: PropertyStatus;
          company: string | null;
          building: string | null;
          available_floors: string | null;
          floor: string | null;
          agent_name: string | null;
          agent_phone: string | null;
          agent_email: string | null;
          specs: string | null;
          notes: string | null;
          auto_delete_at: string | null;
          created_at: string;
          last_updated_at: string;
        };
        Insert: {
          id?: string;
          address: string;
          postcode?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          size_sqft?: number | null;
          cost_per_sqft?: number | null;
          availability_period?: string | null;
          status?: PropertyStatus;
          company?: string | null;
          building?: string | null;
          available_floors?: string | null;
          floor?: string | null;
          agent_name?: string | null;
          agent_phone?: string | null;
          agent_email?: string | null;
          specs?: string | null;
          notes?: string | null;
          auto_delete_at?: string | null;
          created_at?: string;
          last_updated_at?: string;
        };
        Update: {
          id?: string;
          address?: string;
          postcode?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          size_sqft?: number | null;
          cost_per_sqft?: number | null;
          availability_period?: string | null;
          status?: PropertyStatus;
          company?: string | null;
          building?: string | null;
          available_floors?: string | null;
          floor?: string | null;
          agent_name?: string | null;
          agent_phone?: string | null;
          agent_email?: string | null;
          specs?: string | null;
          notes?: string | null;
          auto_delete_at?: string | null;
          created_at?: string;
          last_updated_at?: string;
        };
        Relationships: [];
      };
      property_files: {
        Row: {
          id: string;
          property_id: string;
          file_url: string;
          file_type: PropertyFileType;
          created_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          file_url: string;
          file_type: PropertyFileType;
          created_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          file_url?: string;
          file_type?: PropertyFileType;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "property_files_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      property_status: PropertyStatus;
      property_file_type: PropertyFileType;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Property = Database["public"]["Tables"]["properties"]["Row"];
export type PropertyInsert =
  Database["public"]["Tables"]["properties"]["Insert"];
export type PropertyUpdate =
  Database["public"]["Tables"]["properties"]["Update"];

export type PropertyFile =
  Database["public"]["Tables"]["property_files"]["Row"];
export type PropertyFileInsert =
  Database["public"]["Tables"]["property_files"]["Insert"];
export type PropertyFileUpdate =
  Database["public"]["Tables"]["property_files"]["Update"];
