import { IsObject, IsUUID } from 'class-validator';
import { IsBoundedJson } from '../../common/validation/is-bounded-json';

/**
 * Payload for recording a scored-instrument result against a patient.
 * `answers` maps each instrument item key to its selected numeric value;
 * the server computes score & band via the engine (never trusting a
 * client-supplied score).
 */
export class RecordResponseDto {
  @IsUUID()
  patientId!: string;

  @IsObject()
  @IsBoundedJson({ maxDepth: 3 })
  answers!: Record<string, number>;
}
