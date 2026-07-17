import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export interface BoundedJsonLimits {
  /** Maximum nesting depth (top-level object/array = depth 1). */
  maxDepth: number;
  /** Maximum total number of nodes (objects, arrays, scalars). */
  maxNodes: number;
  /** Maximum length of any individual string value or key. */
  maxStringLength: number;
}

export const DEFAULT_JSON_LIMITS: BoundedJsonLimits = {
  maxDepth: 8,
  maxNodes: 500,
  maxStringLength: 4000,
};

/**
 * Walks a JSON-ish value enforcing depth/size bounds. Returns an error string
 * on the first violation, or null when within limits. Iterative (explicit
 * stack) so a hostile deeply-nested payload can't blow the call stack before
 * the depth check fires.
 */
export function checkBoundedJson(value: unknown, limits: BoundedJsonLimits): string | null {
  let nodes = 0;
  const stack: { node: unknown; depth: number }[] = [{ node: value, depth: 1 }];

  while (stack.length > 0) {
    const { node, depth } = stack.pop()!;
    nodes++;
    if (nodes > limits.maxNodes) return `JSON has too many nodes (max ${limits.maxNodes})`;
    if (depth > limits.maxDepth) return `JSON nested too deeply (max depth ${limits.maxDepth})`;

    if (typeof node === 'string') {
      if (node.length > limits.maxStringLength) {
        return `JSON string exceeds ${limits.maxStringLength} characters`;
      }
    } else if (Array.isArray(node)) {
      for (const item of node) stack.push({ node: item, depth: depth + 1 });
    } else if (node !== null && typeof node === 'object') {
      for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
        if (key.length > limits.maxStringLength) {
          return `JSON key exceeds ${limits.maxStringLength} characters`;
        }
        stack.push({ node: val, depth: depth + 1 });
      }
    }
    // numbers/booleans/null: counted as a node, nothing to recurse.
  }
  return null;
}

@ValidatorConstraint({ name: 'isBoundedJson', async: false })
class IsBoundedJsonConstraint implements ValidatorConstraintInterface {
  private message = 'value exceeds JSON size limits';

  validate(value: unknown, args?: ValidationArguments): boolean {
    const override = (args?.constraints?.[0] as Partial<BoundedJsonLimits> | undefined) ?? {};
    const limits = { ...DEFAULT_JSON_LIMITS, ...override };
    const err = checkBoundedJson(value, limits);
    if (err) {
      this.message = err;
      return false;
    }
    return true;
  }

  defaultMessage(): string {
    return this.message;
  }
}

/**
 * Property decorator: bounds an arbitrary-JSON field (depth, node count, string
 * length) to prevent unbounded/hostile payloads from being stored or processed.
 * Combine with `@IsObject()` when the field must be an object.
 */
export function IsBoundedJson(
  limits?: Partial<BoundedJsonLimits>,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isBoundedJson',
      target: object.constructor,
      propertyName,
      constraints: [limits],
      options: validationOptions,
      validator: IsBoundedJsonConstraint,
    });
  };
}
