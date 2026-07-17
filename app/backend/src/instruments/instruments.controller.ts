import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { InstrumentsService } from './instruments.service';
import { RecordResponseDto } from './dto/record-response.dto';

/**
 * Scored instruments API.
 *
 * GET routes list/read the shared library; POST records a scored result for a
 * patient (clinical roles only). Reads are open to any authenticated role.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('instruments')
export class InstrumentsController {
  constructor(private readonly instruments: InstrumentsService) {}

  @Get()
  list() {
    return this.instruments.list();
  }

  // Two segments — distinct from GET /instruments/:key (one segment).
  @Get('responses/:patientId')
  responses(@Param('patientId') patientId: string) {
    return this.instruments.listResponses(patientId);
  }

  @Get(':key')
  get(@Param('key') key: string) {
    return this.instruments.get(key);
  }

  @Post(':key/responses')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DOCTOR, UserRole.TREATMENT)
  record(@Param('key') key: string, @Body() dto: RecordResponseDto) {
    return this.instruments.record(key, dto.patientId, dto.answers);
  }
}
