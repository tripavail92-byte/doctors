import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { RequiresEntitlement } from '../auth/decorators/requires-entitlement.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CLINICAL_ROLES } from '../rbac/role-groups';
import { ObstetricsService } from './obstetrics.service';
import { StartEpisodeDto } from './dto/start-episode.dto';
import { AddAncVisitDto } from './dto/add-anc-visit.dto';
import { AddUltrasoundDto } from './dto/add-ultrasound.dto';
import { RedateDto } from './dto/redate.dto';
import { CloseEpisodeDto } from './dto/close-episode.dto';
import { UpsertGynaeProfileDto } from './dto/upsert-gynae-profile.dto';
import { StartPartogramDto } from './dto/start-partogram.dto';
import { AddPartogramEntryDto, ClosePartogramDto } from './dto/add-partogram-entry.dto';

@UseGuards(JwtAuthGuard, RolesGuard, EntitlementGuard)
@RequiresEntitlement('pack.obgyn')
@Controller('obgyn')
@Roles(...CLINICAL_ROLES)
export class ObstetricsController {
  constructor(private readonly obgyn: ObstetricsService) {}

  // Episodes
  @Post('episodes')
  startEpisode(@Body() dto: StartEpisodeDto) {
    return this.obgyn.startEpisode(dto);
  }

  @Get('patients/:patientId/episodes')
  listEpisodes(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.obgyn.listEpisodes(patientId);
  }

  @Get('episodes/:id')
  getEpisode(@Param('id', ParseUUIDPipe) id: string) {
    return this.obgyn.getEpisode(id);
  }

  @Post('episodes/:id/anc-visits')
  addAncVisit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddAncVisitDto) {
    return this.obgyn.addAncVisit(id, dto);
  }

  @Post('episodes/:id/ultrasounds')
  addUltrasound(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddUltrasoundDto) {
    return this.obgyn.addUltrasound(id, dto);
  }

  @Patch('episodes/:id/redate')
  redate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RedateDto) {
    return this.obgyn.redate(id, dto);
  }

  @Patch('episodes/:id/close')
  closeEpisode(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CloseEpisodeDto) {
    return this.obgyn.closeEpisode(id, dto);
  }

  // Partogram
  @Post('episodes/:id/partograms')
  startPartogram(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StartPartogramDto) {
    return this.obgyn.startPartogram(id, dto);
  }

  @Post('partograms/:id/entries')
  addPartogramEntry(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddPartogramEntryDto) {
    return this.obgyn.addPartogramEntry(id, dto);
  }

  @Get('partograms/:id')
  getPartogram(@Param('id', ParseUUIDPipe) id: string) {
    return this.obgyn.getPartogram(id);
  }

  @Patch('partograms/:id/close')
  closePartogram(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ClosePartogramDto) {
    return this.obgyn.closePartogram(id, dto);
  }

  // Gynae profile
  @Put('patients/:patientId/gynae-profile')
  upsertGynaeProfile(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: UpsertGynaeProfileDto,
  ) {
    return this.obgyn.upsertGynaeProfile(patientId, dto);
  }

  @Get('patients/:patientId/gynae-profile')
  getGynaeProfile(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.obgyn.getGynaeProfile(patientId);
  }
}
