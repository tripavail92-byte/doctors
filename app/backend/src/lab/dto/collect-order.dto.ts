import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CollectOrderDto {
  // Optional externally-assigned accession; auto-generated if omitted.
  @IsOptional()
  @IsString()
  @MaxLength(40)
  accessionNumber?: string;
}
