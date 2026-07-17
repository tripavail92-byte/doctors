import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * Payload for POST /auth/login.
 * Validated by the global ValidationPipe (class-validator).
 */
export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password!: string;
}