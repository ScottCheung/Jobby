// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { extractStructuredText, cleanDescription } from './text-utils';

describe('extractStructuredText', () => {
  it('preserves line breaks and paragraph spacing across headings and paragraphs', () => {
    const el = document.createElement('div');
    el.innerHTML = `
      <h2>About the Job</h2>
      <p>We are looking for a Senior Frontend Developer.</p>
      <h3>Requirements:</h3>
      <p>Must know React and TypeScript.</p>
    `;

    const result = extractStructuredText(el);
    expect(result).toBe(
      `About the Job\n\nWe are looking for a Senior Frontend Developer.\n\nRequirements:\n• Must know React and TypeScript.`
    );
  });

  it('formats unbulleted li items into clean bullet points with •', () => {
    const el = document.createElement('div');
    el.innerHTML = `
      <h3>Responsibilities</h3>
      <ul>
        <li>Build modern user interfaces</li>
        <li>Optimize web application performance</li>
      </ul>
    `;

    const result = extractStructuredText(el);
    expect(result).toContain(`• Build modern user interfaces`);
    expect(result).toContain(`• Optimize web application performance`);
  });

  it('normalizes existing dashes or bullet characters without double bullets', () => {
    const el = document.createElement('div');
    el.innerHTML = `
      <ul>
        <li>- Dash bullet item</li>
        <li>* Star bullet item</li>
        <li>• Pre-existing bullet item</li>
      </ul>
    `;

    const result = extractStructuredText(el);
    expect(result).toContain(`• Dash bullet item`);
    expect(result).toContain(`• Star bullet item`);
    expect(result).toContain(`• Pre-existing bullet item`);
    expect(result).not.toContain(`• •`);
  });

  it('removes noisy tags such as script, style, and svg', () => {
    const el = document.createElement('div');
    el.innerHTML = `
      <span>Visible content</span>
      <style>body { color: red; }</style>
      <script>console.log("hidden");</script>
      <svg><path></path></svg>
      <button>Apply</button>
    `;

    const result = extractStructuredText(el);
    expect(result).toBe('Visible content');
  });

  it('handles br elements as line breaks', () => {
    const el = document.createElement('div');
    el.innerHTML = `Line 1<br>Line 2<br><br>Line 3`;

    const result = extractStructuredText(el);
    expect(result).toBe(`Line 1\nLine 2\n\nLine 3`);
  });
});

describe('cleanDescription', () => {
  it('parses HTML description strings structurally', () => {
    const html = `<div><p>Paragraph 1</p><p>Paragraph 2</p></div>`;
    const result = cleanDescription(html);
    expect(result).toBe(`Paragraph 1\n\nParagraph 2`);
  });

  it('normalizes plain multiline text with dashes to bullet points', () => {
    const text = `Job Overview\n\nKey skills:\n- React\n* TypeScript\n- Next.js`;
    const result = cleanDescription(text);
    expect(result).toBe(`Job Overview\n\nKey skills:\n• React\n• TypeScript\n• Next.js`);
  });

  it('formats squished text with missing spaces/newlines between sections and list items', () => {
    const squished = `Who is Shift? At Shift, we're business specialists dedicated to helping Australian SMEs take control of their cashflow, streamline trade terms and choose the right financial products.We believe Australian businesses are the driving force behind our economy and are core to our communities. That's why our business expertise, focus on relationships, and market-leading technology is at the core of everything we do. We've helped solve the credit and payment pain points for more than 30,000 businesses, providing over $6 billion in aggregate funding.Our unique approach to product innovation combined with our collaborative culture means you can build your career in a supportive environment. You'll be joining a diverse team of over 300 people who are always looking to deliver better outcomes for Australian businesses.About the role:We're looking for a Full Stack Software Engineer who enjoys building things end to end, from polished interfaces to the backend services that power them. This role can flex to suit you: whether you're a true 50/50 full stack engineer or someone who leans more front-end, we're interested in strong engineers who care about the whole picture.What you'll do:Design, build, and maintain modern web applications across JavaScript/TypeScript (React) and C# (.NET)Support and enhance backend services to keep integrations solid and systems reliablePartner with designers and product to take ideas from concept to something users loveContribute to architectural discussions across the stack, with a focus on maintainability and scaleFollow engineering best practices around code quality, accessibility, and continuous improvementStay curious`;

    const result = cleanDescription(squished);
    expect(result).toContain('Who is Shift?');
    expect(result).toContain('About the role:');
    expect(result).toContain('What you\'ll do:\n• Design, build');
    expect(result).toContain('• Support and enhance backend services');
    expect(result).toContain('• Partner with designers');
    expect(result).toContain('• Contribute to architectural discussions');
    expect(result).toContain('• Follow engineering best practices');
    expect(result).toContain('• Stay curious');
  });

  it('returns empty string for null or empty inputs', () => {
    expect(cleanDescription(null)).toBe('');
    expect(cleanDescription(undefined)).toBe('');
    expect(cleanDescription('')).toBe('');
  });
});
