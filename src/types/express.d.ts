import type { AuthUser } from "./auth";

type AppParent = {
  id: string;
  school_id: string;
  role: string;
  phone: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      appParent?: AppParent;
    }
  }
}

export {};
