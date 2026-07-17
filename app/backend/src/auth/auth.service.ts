import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma/prisma.service';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Look up a user by (globally unique) email and verify the password.
   *
   * Login is the one read that legitimately has no tenant context — you cannot
   * know the tenant until you have found the user. "User" carries RLS like
   * every other tenant table, so a plain `prisma.user.findUnique` here would
   * evaluate the policy with no `app.tenant_id` and find nothing: every login
   * would fail. It goes through auth_find_user_by_email (SECURITY DEFINER, see
   * prisma/rls-user.sql), which is the single sanctioned way past the policy —
   * deliberately narrow: lookup by unique email, no list variant.
   */
  async validateUser(email: string, password: string): Promise<User> {
    const rows = await this.prisma.$queryRaw<User[]>`
      SELECT * FROM auth_find_user_by_email(${email})
    `;
    const user = rows[0];
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }

  /**
   * Validate credentials and return a signed access token.
   */
  async login(email: string, password: string): Promise<{ accessToken: string }> {
    const user = await this.validateUser(email, password);
    const payload: JwtPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      isPlatformAdmin: user.isPlatformAdmin,
    };
    return { accessToken: await this.jwt.signAsync(payload) };
  }
}