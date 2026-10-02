import { AppError } from '../../errors.js';

/**
 * Model release policy (§9): production may only use models on this allow-list.
 * Membership here means the model has documented open weights, a compatible
 * license, sufficient hardware headroom, and passing structured-output/safety
 * evaluation. Adding an entry is a deliberate, reviewed change — never a runtime
 * `ollama pull` of an arbitrary name.
 *
 * Sizes are approximate Q4_K_M downloads and are guidance, not limits.
 */
export type ApprovedModel = {
  ollamaModelRef: string;
  family: 'qwen' | 'gemma' | 'phi' | 'llama' | 'other';
  license: string;
  contextWindowTokens: number;
  approxQ4SizeGb: number;
  minMemoryGb: number;
  role: 'suggestion-generator' | 'classifier' | 'embedding';
  notes: string;
};

export const APPROVED_MODELS: readonly ApprovedModel[] = [
  {
    ollamaModelRef: 'qwen3:4b',
    family: 'qwen',
    license: 'Apache-2.0',
    contextWindowTokens: 32768,
    approxQ4SizeGb: 2.6,
    minMemoryGb: 6,
    role: 'suggestion-generator',
    notes: 'Default generator: strongest sub-7B instruction and schema following.',
  },
  {
    ollamaModelRef: 'qwen3.5:4b',
    family: 'qwen',
    license: 'Apache-2.0',
    contextWindowTokens: 32768,
    approxQ4SizeGb: 2.7,
    minMemoryGb: 6,
    role: 'suggestion-generator',
    notes: 'Newer edge series; 2B/0.8B variants exist for constrained hosts.',
  },
  {
    ollamaModelRef: 'gemma4:e4b',
    family: 'gemma',
    license: 'Gemma Terms of Use',
    contextWindowTokens: 131072,
    approxQ4SizeGb: 3.3,
    minMemoryGb: 6,
    role: 'suggestion-generator',
    notes: 'Native function-call tokens give lower output variance on schemas.',
  },
  {
    ollamaModelRef: 'phi4-mini:3.8b',
    family: 'phi',
    license: 'MIT',
    contextWindowTokens: 131072,
    approxQ4SizeGb: 2.5,
    minMemoryGb: 6,
    role: 'suggestion-generator',
    notes: 'Fastest option; strong reasoning, weaker raw schema mapping.',
  },
  {
    ollamaModelRef: 'llama3.2:3b',
    family: 'llama',
    license: 'Llama Community License',
    contextWindowTokens: 131072,
    approxQ4SizeGb: 2.0,
    minMemoryGb: 6,
    role: 'suggestion-generator',
    notes: 'Conservative fallback; slightly behind Qwen3 on adherence.',
  },
  {
    ollamaModelRef: 'qwen3:0.6b',
    family: 'qwen',
    license: 'Apache-2.0',
    contextWindowTokens: 32768,
    approxQ4SizeGb: 0.5,
    minMemoryGb: 2,
    role: 'classifier',
    notes: 'Tiny pre-filter only. Never write user-facing health guidance with it.',
  },
  {
    ollamaModelRef: 'functiongemma:270m',
    family: 'gemma',
    license: 'Gemma Terms of Use',
    contextWindowTokens: 32768,
    approxQ4SizeGb: 0.3,
    minMemoryGb: 2,
    role: 'classifier',
    notes: 'Tiny function-call dispatcher; classification only.',
  },
] as const;

/** Strip a trailing `:latest` so `qwen3:4b` and `qwen3:4b:latest` compare equal. */
export function normalizeModelRef(ref: string): string {
  return ref.trim().replace(/:latest$/, '');
}

export function findApprovedModel(ref: string): ApprovedModel | undefined {
  const normalized = normalizeModelRef(ref);
  return APPROVED_MODELS.find(
    (model) => normalizeModelRef(model.ollamaModelRef) === normalized,
  );
}

export function isApprovedModel(ref: string): boolean {
  return findApprovedModel(ref) !== undefined;
}

/** Throws unless the configured model is on the allow-list. Fails closed. */
export function assertModelAllowed(ref: string): ApprovedModel {
  const approved = findApprovedModel(ref);
  if (!approved) {
    throw AppError.forbidden(
      `Model "${ref}" is not on the Lumen allow-list. Add it deliberately after it passes the safety and structured-output evaluation suite.`,
    );
  }
  return approved;
}
