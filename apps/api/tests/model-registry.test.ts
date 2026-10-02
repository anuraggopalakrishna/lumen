import { describe, expect, it } from 'vitest';
import {
  APPROVED_MODELS,
  assertModelAllowed,
  findApprovedModel,
  isApprovedModel,
  normalizeModelRef,
} from '../src/modules/ai/model-registry.js';

describe('model allow-list', () => {
  it('rejects unknown models', () => {
    expect(isApprovedModel('totally-made-up:70b')).toBe(false);
    expect(findApprovedModel('totally-made-up:70b')).toBeUndefined();
    expect(() => assertModelAllowed('totally-made-up:70b')).toThrowError(
      /not on the Lumen allow-list/,
    );
  });

  it('accepts allow-listed models, including trailing :latest', () => {
    expect(isApprovedModel('qwen3:4b')).toBe(true);
    expect(isApprovedModel('qwen3:4b:latest')).toBe(true);
    expect(normalizeModelRef('gemma4:e4b:latest')).toBe('gemma4:e4b');
    expect(assertModelAllowed('phi4-mini:3.8b').license).toBe('MIT');
  });

  it('only exposes generator-capable models with documented licenses', () => {
    for (const model of APPROVED_MODELS) {
      expect(model.license.length).toBeGreaterThan(0);
      expect(model.minMemoryGb).toBeGreaterThan(0);
    }
    const tiny = APPROVED_MODELS.filter((model) => model.role === 'classifier');
    // Tiny models are never approved as user-facing generators.
    expect(tiny.every((model) => model.approxQ4SizeGb < 1)).toBe(true);
  });
});
