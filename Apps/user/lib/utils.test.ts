import { describe, expect, it } from 'vitest';
import { parseDescriptionBlocks } from './utils';

describe('parseDescriptionBlocks', () => {
  it('parses section titles followed by continuous bullet points', () => {
    const text = `About the role:\n• We're looking for a Full Stack Software Engineer who enjoys building things end to end.\n• This role can flex to suit you.`;
    const blocks = parseDescriptionBlocks(text);

    expect(blocks).toEqual([
      {
        type: 'header',
        text: 'About the role:',
      },
      {
        type: 'list',
        items: [
          "We're looking for a Full Stack Software Engineer who enjoys building things end to end.",
          'This role can flex to suit you.',
        ],
      },
    ]);
  });

  it('parses short lines preceding bullet points as section titles even without colons', () => {
    const text = `What you will do\n- Build high performance web applications\n- Collaborate with backend engineers`;
    const blocks = parseDescriptionBlocks(text);

    expect(blocks).toEqual([
      {
        type: 'header',
        text: 'What you will do',
      },
      {
        type: 'list',
        items: [
          'Build high performance web applications',
          'Collaborate with backend engineers',
        ],
      },
    ]);
  });

  it('parses plain paragraphs alongside list sections', () => {
    const text = `We are a remote-first company building modern tools.\n\nKey Responsibilities:\n• Write clean TypeScript code\n• Deliver great UX`;
    const blocks = parseDescriptionBlocks(text);

    expect(blocks).toEqual([
      {
        type: 'paragraph',
        text: 'We are a remote-first company building modern tools.',
      },
      {
        type: 'header',
        text: 'Key Responsibilities:',
      },
      {
        type: 'list',
        items: [
          'Write clean TypeScript code',
          'Deliver great UX',
        ],
      },
    ]);
  });

  it('parses question headers like Why join CORTO? into header blocks', () => {
    const text = `Why join CORTO?\n• Your work matters.\n• We solve real world problems.`;
    const blocks = parseDescriptionBlocks(text);

    expect(blocks).toEqual([
      {
        type: 'header',
        text: 'Why join CORTO?',
      },
      {
        type: 'list',
        items: [
          'Your work matters.',
          'We solve real world problems.',
        ],
      },
    ]);
  });

  it('keeps bullet items with colons inside list block instead of promoting them to headers', () => {
    const text = `You'll:\n• Provide technical leadership: Serve as the key SME.\n• Own the experimental lifecycle: Architect ML handoffs.`;
    const blocks = parseDescriptionBlocks(text);

    expect(blocks).toEqual([
      {
        type: 'header',
        text: "You'll:",
      },
      {
        type: 'list',
        items: [
          'Provide technical leadership: Serve as the key SME.',
          'Own the experimental lifecycle: Architect ML handoffs.',
        ],
      },
    ]);
  });
});
