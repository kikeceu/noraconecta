import bcrypt from 'bcrypt';
import { AuthRepository } from './auth.repository';
import { signToken, JwtPayload } from '../../utils/jwt';
import { AppError } from '../../middleware/error-handler';

const SALT_ROUNDS = 10;

export interface LoginResult {
  token: string;
  admin: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export class AuthService {
  constructor(private readonly authRepository: AuthRepository) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const admin = await this.authRepository.findByEmail(email);

    if (!admin) {
      throw new AppError('Invalid email or password', 401);
    }

    const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);

    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    const payload: JwtPayload = {
      adminId: admin.id,
      email: admin.email,
      role: admin.role,
    };

    const token = signToken(payload);

    return {
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    };
  }

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }
}
