import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthUser } from './jwt.strategy';
import { SwitchContextDto } from './dto/switch-context.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * POST /auth/login -> { accessToken }
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<{ accessToken: string }> {
    return this.auth.login(dto.email, dto.password);
  }

  @Get('contexts')
  @UseGuards(JwtAuthGuard)
  contexts(@Req() req: { user: AuthUser }) {
    return this.auth.contextsForUser(req.user.userId);
  }

  @Post('switch-context')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  switchContext(@Req() req: { user: AuthUser }, @Body() dto: SwitchContextDto) {
    return this.auth.switchContext(req.user.userId, dto);
  }
}