import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @MaxLength(120)
  room!: string;

  @IsString()
  @MaxLength(120)
  identity!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsBoolean()
  canPublish?: boolean;

  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(43200)
  ttlSeconds?: number;
}
