import { IsObject } from 'class-validator';
import { IsBoundedJson } from '../../common/validation/is-bounded-json';

/**
 * Body for POST /packs/publish and POST /packs/validate.
 * `manifest` is a full PackManifest; it is deep-validated by validateManifest()
 * (class-validator only asserts it's an object here).
 */
export class PublishManifestDto {
  // Manifests are larger than clinical payloads (nested groups, templates,
  // service catalog, order sets), so allow a bigger budget; validateManifest()
  // does the deep semantic validation.
  @IsObject()
  @IsBoundedJson({ maxDepth: 12, maxNodes: 5000, maxStringLength: 8000 })
  manifest!: Record<string, unknown>;
}
