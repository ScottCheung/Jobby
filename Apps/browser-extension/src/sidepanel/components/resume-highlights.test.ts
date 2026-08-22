import { describe, expect, it } from 'vitest';
import {
  createResumeHighlightRules,
  tokenizeResumeText,
} from '../../../../../packages/ui/src/components/UI/Resume/highlights';

const rules = createResumeHighlightRules({
  skills: [{ type: 'Engineering', skills: ['Git', 'C++', '.NET', 'Node.js'] }],
});

describe('resume skill highlighting', () => {
  it('does not match a skill inside a normal word', () => {
    const tokens = tokenizeResumeText(
      'Built digital marketing assets with Git workflows.',
      rules,
    );

    expect(tokens).toEqual([
      { kind: 'plain', value: 'Built digital marketing assets with ' },
      { kind: 'skill', value: 'Git' },
      { kind: 'plain', value: ' workflows.' },
    ]);
  });

  it('still highlights technology names that contain punctuation', () => {
    expect(
      tokenizeResumeText('Used C++, .NET, and Node.js.', rules).filter(
        (token) => token.kind === 'skill',
      ),
    ).toEqual([
      { kind: 'skill', value: 'C++' },
      { kind: 'skill', value: '.NET' },
      { kind: 'skill', value: 'Node.js' },
    ]);
  });
});
