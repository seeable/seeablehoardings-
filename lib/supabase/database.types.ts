/**
 * Generated Supabase database types.
 *
 * PLACEHOLDER — regenerated in Phase 1 once migrations exist:
 *   npm run db:types      (supabase gen types typescript --local)
 *
 * Until then this permissive stub keeps the typed clients compiling.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
