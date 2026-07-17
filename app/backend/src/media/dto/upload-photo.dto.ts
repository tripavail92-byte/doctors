import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadPhotoDto {
  // Base64 image data, optionally a data: URL (data:image/png;base64,....).
  // Bounded to ~9 MB of base64 (≈ 6.5 MB decoded) to cap request memory.
  @IsString()
  @IsNotEmpty()
  @MaxLength(9_000_000)
  imageBase64!: string;

  // Used only when imageBase64 is raw base64 (no data: prefix).
  @IsOptional()
  @IsString()
  contentType?: string;
}
