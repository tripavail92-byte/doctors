import { Edition } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateTenantDto {
  /** Display name of the clinic, e.g. "Derma Care — DHA". */
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  /**
   * URL-safe identifier, unique across the platform.
   *
   * Constrained rather than free text because it is a stable external handle:
   * lowercase, digits and hyphens only, so it can never collide on case or
   * carry whitespace that renders as a different clinic in a list.
   */
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase letters, digits and single hyphens, e.g. "derma-care"',
  })
  slug!: string;

  /** Which entitlement bundle this clinic is sold. */
  @IsEnum(Edition)
  edition!: Edition;

  /** The first user, who owns the clinic. */
  @IsEmail()
  @MaxLength(180)
  ownerEmail!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  ownerName!: string;

  /**
   * 12 characters minimum.
   *
   * This account can see every patient in the clinic from the moment it exists,
   * so the floor is set here rather than left to whoever is filling the form.
   * The same number the seed guard uses — one rule, not two.
   */
  @IsString()
  @MinLength(12, {
    message: 'ownerPassword must be at least 12 characters — this account can read every patient record in the clinic',
  })
  @MaxLength(200)
  ownerPassword!: string;

  /** First facility. Defaults to the clinic name if omitted. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  facilityName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;
}
