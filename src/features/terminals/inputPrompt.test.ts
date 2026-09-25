import { describe, expect, it } from 'vitest';
import { isInputPrompt } from './inputPrompt';

describe('input prompt detection', () => {
  it('recognizes explicit interactive prompts', () => {
    expect(isInputPrompt('Trust this folder?')).toBe(true);
    expect(isInputPrompt('\x1b[1mContinue? [Y/n] ')).toBe(true);
    expect(isInputPrompt('Press Enter to continue')).toBe(true);
  });
  it('does not flag ordinary output or arbitrary questions', () => {
    expect(isInputPrompt('Build complete\n')).toBe(false);
    expect(isInputPrompt('What about this?')).toBe(false);
  });
});
