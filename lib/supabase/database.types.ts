// Hand-written to match supabase/migrations. Once the Supabase CLI is linked,
// regenerate with: npx supabase gen types typescript --linked

export type AppRole = "admin" | "member" | "viewer";
export type TeamKind = "media" | "receiving";

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
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      app_role: AppRole;
      team_kind: TeamKind;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Invite = Database["public"]["Tables"]["invites"]["Row"];
export type Team = Database["public"]["Tables"]["teams"]["Row"];
export type TeamMember = Database["public"]["Tables"]["team_members"]["Row"];
