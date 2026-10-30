export type AuthUser = {
  id: string | number;
  role: string;
  // All roles this user holds (primary + secondary from user_roles table).
  // Embedded in the JWT so requireRole() never needs a DB call per request.
  secondary_roles?: string[];
  school_id?: string | number;
  auth_type?: "school" | "platform";
  token_type?: "access" | "refresh";
  [key: string]: unknown;
};
