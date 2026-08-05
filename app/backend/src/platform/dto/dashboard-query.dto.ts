import { TenantStatus } from '@prisma/client';
import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { SummaryPeriod } from '../platform-dashboard.service';

/** GET /platform/summary?period=…&from=…&to=… */
export class PlatformSummaryQueryDto {
  // `custom` is the only value that requires from/to; the service enforces
  // that pairing, so this DTO only validates the shape.
  @IsOptional()
  @IsEnum(['this-month', 'last-30d', 'last-90d', 'ytd', 'custom'] as const, {
    message: 'period must be one of: this-month, last-30d, last-90d, ytd, custom',
  })
  period?: SummaryPeriod;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}

/** GET /platform/tenants?limit=&offset=&q=&status= */
export class PlatformTenantsListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;
}

/** GET /platform/onboarding-activity?limit= */
export class OnboardingActivityQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}
