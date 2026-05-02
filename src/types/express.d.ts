import { JwtPayload } from '../utils/jwt';

declare global {
  namespace Express {
    interface Request {
      admin?: JwtPayload;
    }
  }
}

export {};
