// This is a placeholder for Supabase generated types
// To generate actual types, run:
// npx supabase gen types typescript --project-id <your-project-id> --schema public > src/lib/types/supabase.ts

export type Database = {
  public: {
    Tables: {
      User: {
        Row: {
          id: string;
          name: string | null;
          email: string | null;
          emailVerified: string | null;
          image: string | null;
          hashedPassword: string | null;
          createdAt: string;
          updatedAt: string;
          login: string | null;
          role: string;
          isAdmin: boolean;
        };
        Insert: {
          id?: string;
          name?: string | null;
          email?: string | null;
          emailVerified?: string | null;
          image?: string | null;
          hashedPassword?: string | null;
          createdAt?: string;
          updatedAt?: string;
          login?: string | null;
          role?: string;
          isAdmin?: boolean;
        };
        Update: {
          id?: string;
          name?: string | null;
          email?: string | null;
          emailVerified?: string | null;
          image?: string | null;
          hashedPassword?: string | null;
          createdAt?: string;
          updatedAt?: string;
          login?: string | null;
          role?: string;
          isAdmin?: boolean;
        };
      };
      // Other tables will be added here by the Supabase CLI
    };
    Views: {};
    Functions: {};
    Enums: {
      UserRole: 'user' | 'admin';
    };
  };
}; 