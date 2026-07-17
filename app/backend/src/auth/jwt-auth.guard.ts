import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard that runs the 'jwt' passport strategy.
 * Attach with @UseGuards(JwtAuthGuard) — populates req.user with AuthUser.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}