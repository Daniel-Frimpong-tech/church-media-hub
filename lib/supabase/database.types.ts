// Hand-written to match supabase/migrations. Once the Supabase CLI is linked,
// regenerate with: npx supabase gen types typescript --linked

export type AppRole = "admin" | "member" | "viewer";
export type TeamKind = "media" | "receiving";
export type DriveFolderStatus = "pending" | "ready" | "failed";
export type GoogleConnectionStatus = "connected" | "expired";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          avatar_url: string | null;
          role: AppRole;
          active: boolean;
          created_at: string;
        };
        Insert: never;
        Update: {
          full_name?: string;
          role?: AppRole;
          active?: boolean;
        };
        Relationships: [];
      };
      invites: {
        Row: {
          email: string;
          role: AppRole;
          team_id: string | null;
          invited_by: string | null;
          created_at: string;
          accepted_at: string | null;
        };
        Insert: {
          email: string;
          role?: AppRole;
          team_id?: string | null;
          invited_by?: string | null;
        };
        Update: {
          role?: AppRole;
          team_id?: string | null;
        };
        Relationships: [];
      };
      teams: {
        Row: {
          id: string;
          name: string;
          kind: TeamKind;
          created_at: string;
        };
        Insert: {
          name: string;
          kind?: TeamKind;
        };
        Update: {
          name?: string;
          kind?: TeamKind;
        };
        Relationships: [];
      };
      team_members: {
        Row: {
          team_id: string;
          profile_id: string;
          added_at: string;
        };
        Insert: {
          team_id: string;
          profile_id: string;
        };
        Update: never;
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          slug: string;
          name: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          slug: string;
          name: string;
          sort_order?: number;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          sort_order?: number;
          is_active?: boolean;
        };
        Relationships: [];
      };
      services: {
        Row: {
          id: string;
          name: string;
          starts_at: string;
          drive_folder_id: string | null;
          drive_folder_status: DriveFolderStatus;
          drive_error: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          name: string;
          starts_at: string;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          starts_at?: string;
          drive_folder_id?: string | null;
          drive_folder_status?: DriveFolderStatus;
          drive_error?: string | null;
        };
        Relationships: [];
      };
      service_folders: {
        Row: {
          service_id: string;
          category_id: string;
          drive_folder_id: string;
          created_at: string;
        };
        Insert: {
          service_id: string;
          category_id: string;
          drive_folder_id: string;
        };
        Update: never;
        Relationships: [];
      };
      // Readable only with the secret key. See lib/google/connection.ts.
      google_connection: {
        Row: {
          id: boolean;
          account_email: string;
          refresh_token_encrypted: string;
          root_folder_id: string;
          status: GoogleConnectionStatus;
          last_error: string | null;
          connected_by: string | null;
          connected_at: string;
        };
        Insert: {
          id?: boolean;
          account_email: string;
          refresh_token_encrypted: string;
          root_folder_id: string;
          status?: GoogleConnectionStatus;
          last_error?: string | null;
          connected_by?: string | null;
          connected_at?: string;
        };
        Update: {
          account_email?: string;
          refresh_token_encrypted?: string;
          root_folder_id?: string;
          status?: GoogleConnectionStatus;
          last_error?: string | null;
          connected_by?: string | null;
          connected_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      app_role: AppRole;
      team_kind: TeamKind;
      drive_folder_status: DriveFolderStatus;
      google_connection_status: GoogleConnectionStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Invite = Database["public"]["Tables"]["invites"]["Row"];
export type Team = Database["public"]["Tables"]["teams"]["Row"];
export type TeamMember = Database["public"]["Tables"]["team_members"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Service = Database["public"]["Tables"]["services"]["Row"];
export type ServiceFolder =
  Database["public"]["Tables"]["service_folders"]["Row"];
