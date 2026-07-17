import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { MembraneStatus } from '@prisma/client';

export class StartPartogramDto {
  @IsInt()
  @Min(0)
  @Max(20)
  parity!: number;

  /** WHO LCG active-phase record starts at ≥5 cm — enforced by the service. */
  @IsInt()
  @Min(0)
  @Max(10)
  startDilationCm!: number;

  @IsOptional()
  @IsEnum(MembraneStatus)
  membraneStatus?: MembraneStatus;

  @IsOptional()
  @IsBoolean()
  companionPresent?: boolean;

  @IsOptional()
  @IsBoolean()
  painReliefOffered?: boolean;

  @IsOptional()
  @IsBoolean()
  oralFluidsAllowed?: boolean;
}
