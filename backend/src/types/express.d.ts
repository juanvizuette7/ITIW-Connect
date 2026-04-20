import { JwtPayload } from "../utils/jwt";

declare global {
  namespace Express {
    interface User extends JwtPayload {
      token?: string;
    }
  }
}

export {};
