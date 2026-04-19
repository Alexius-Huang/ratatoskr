import { describe, expect, it } from 'vitest';
import { parsePrPath } from './github';

describe('parsePrPath', () => {
  it('should parse a full owner/repo/pull/n path', () => {
    const result = parsePrPath('Alexius-Huang/ratatoskr/pull/85');
    expect(result).toEqual({ owner: 'Alexius-Huang', repo: 'ratatoskr', number: 85 });
  });

  it('should return null for a malformed path with no fallback', () => {
    expect(parsePrPath('not-a-valid-path')).toBeNull();
    expect(parsePrPath('owner/repo')).toBeNull();
    expect(parsePrPath('owner/repo/issues/1')).toBeNull();
  });

  it('should use github_repo as fallback when path is a bare number', () => {
    const result = parsePrPath('42', 'Alexius-Huang/ratatoskr');
    expect(result).toEqual({ owner: 'Alexius-Huang', repo: 'ratatoskr', number: 42 });
  });

  it('should not fall back when path is non-numeric and malformed', () => {
    const result = parsePrPath('not-a-number', 'Alexius-Huang/ratatoskr');
    expect(result).toBeNull();
  });

  it('should reject a fallback repo that is not owner/repo shaped', () => {
    const result = parsePrPath('42', 'justareponame');
    expect(result).toBeNull();
  });
});
