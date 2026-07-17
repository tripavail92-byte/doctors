import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PacksService } from './packs.service';
import { PublishManifestDto } from './dto/publish-manifest.dto';

/**
 * Specialty-pack catalog, authoring/versioning, and per-tenant activation.
 *
 * - Listing/reading is open to any authenticated role.
 * - Authoring (publish) is platform-admin only — it writes the GLOBAL catalog.
 * - Activate/deactivate are tenant owner/admin — they seed the tenant.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('packs')
export class PacksController {
  constructor(private readonly packs: PacksService) {}

  @Get()
  available() {
    return this.packs.listAvailable();
  }

  @Get('activated')
  activated() {
    return this.packs.listActivated();
  }

  // ---- Authoring & versioning -------------------------------------------

  // Dry-run validation of a manifest (any authenticated user — authoring UI).
  @Post('validate')
  validate(@Body() dto: PublishManifestDto) {
    return this.packs.validate(dto.manifest);
  }

  // Publish a manifest into the global catalog — platform admins only.
  @Post('publish')
  @Roles(UserRole.PLATFORM_ADMIN)
  publish(@Body() dto: PublishManifestDto) {
    return this.packs.publish(dto.manifest);
  }

  @Get(':key/versions')
  versions(@Param('key') key: string) {
    return this.packs.listVersions(key);
  }

  @Get(':key/versions/:version')
  version(@Param('key') key: string, @Param('version') version: string) {
    return this.packs.getVersion(key, version);
  }

  // ---- Activation (tenant) ----------------------------------------------

  @Post(':key/activate')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  activate(@Param('key') key: string) {
    return this.packs.activate(key);
  }

  @Post(':key/deactivate')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  deactivate(@Param('key') key: string) {
    return this.packs.deactivate(key);
  }
}
