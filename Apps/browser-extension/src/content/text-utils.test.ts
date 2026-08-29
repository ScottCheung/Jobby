/** @format */

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
      `About the Job\n\nWe are looking for a Senior Frontend Developer.\n\nRequirements:\n• Must know React and TypeScript.`,
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
    expect(result).toBe(
      `Job Overview\n\nKey skills:\n• React\n• TypeScript\n• Next.js`,
    );
  });

  it('formats squished text with missing spaces/newlines between sentences and sections', () => {
    const squished = `Who is Shift? At Shift, we're business specialists dedicated to helping Australian SMEs take control of their cashflow, streamline trade terms and choose the right financial products.We believe Australian businesses are the driving force behind our economy and are core to our communities. That's why our business expertise, focus on relationships, and market-leading technology is at the core of everything we do. We've helped solve the credit and payment pain points for more than 30,000 businesses, providing over $6 billion in aggregate funding.Our unique approach to product innovation combined with our collaborative culture means you can build your career in a supportive environment. You'll be joining a diverse team of over 300 people who are always looking to deliver better outcomes for Australian businesses.About the role:We're looking for a Full Stack Software Engineer who enjoys building things end to end, from polished interfaces to the backend services that power them. This role can flex to suit you: whether you're a true 50/50 full stack engineer or someone who leans more front-end, we're interested in strong engineers who care about the whole picture.What you'll do:
- Design, build, and maintain modern web applications across JavaScript/TypeScript (React) and C# (.NET)
- Support and enhance backend services to keep integrations solid and systems reliable
- Partner with designers and product to take ideas from concept to something users love
- Contribute to architectural discussions across the stack, with a focus on maintainability and scale
- Follow engineering best practices around code quality, accessibility, and continuous improvement
- Stay curious`;

    const result = cleanDescription(squished);
    expect(result).toContain('Who is Shift?');
    expect(result).toContain('About the role:');
    expect(result).toContain("What you'll do:\n• Design, build");
    expect(result).toContain('• Support and enhance backend services');
    expect(result).toContain('• Partner with designers');
    expect(result).toContain('• Contribute to architectural discussions');
    expect(result).toContain('• Follow engineering best practices');
    expect(result).toContain('• Stay curious');
  });

  it('preserves CamelCase company and brand names like GoDaddy, LinkedIn, and DevOps', () => {
    const text = `Location Details: Melbourne, Victoria, Australia

At GoDaddy the future of work looks different for each team. Some teams work in the office full-time; others have a hybrid arrangement and some work entirely remotely.

This is a remote position, so you'll be working remotely from your home. You may occasionally visit a GoDaddy office to meet with your team for events or meetings.

Key technologies used at GitHub and GitLab include TypeScript, JavaScript, NodeJS, GraphQL, PostgreSQL, MongoDB, and DevOps best practices.`;

    const result = cleanDescription(text);
    expect(result).toContain('At GoDaddy the future of work');
    expect(result).toContain('visit a GoDaddy office');
    expect(result).toContain('GitHub and GitLab');
    expect(result).toContain(
      'TypeScript, JavaScript, NodeJS, GraphQL, PostgreSQL, MongoDB, and DevOps',
    );
    expect(result).not.toContain('Go\nDaddy');
    expect(result).not.toContain('Git\nHub');
    expect(result).not.toContain('Dev\nOps');
    expect(result).not.toContain('• At Go');
    expect(result).not.toContain('• Daddy the future');
  });

  it('un-squishes lowercase words attached to uppercase acronyms and fixes abnormal punctuation spacing', () => {
    const text = `CORTO is part ofATI - one of the largest Legal Tech companies. Have fun with us . Celebrations.`;
    const result = cleanDescription(text);
    expect(result).toContain('of ATI');
    expect(result).toContain('Have fun with us. Celebrations.');
  });

  it('recognizes question headers and does not convert them into bullet items', () => {
    const text = `
Why join CORTO?
We solve real world problems.

Who we are
CORTO is a fast-growing legal tech team.
    `.trim();
    const result = cleanDescription(text);
    expect(result).toContain('Why join CORTO?');
    expect(result).not.toContain('• Why join CORTO?');
    expect(result).toContain('Who we are');
    expect(result).not.toContain('• Who we are');
  });

  it('preserves bullet items with colons on single lines without splitting or converting to headers', () => {
    const text = `You'll:\n• Provide technical leadership: Serve as the key technical SME for data scientists and ML engineers on technical problems.\n• Own the experimental lifecycle: Architect and support the transition from data science experimentation to productionised ML.\n• Systematize ML delivery: Set shared patterns for how models are deployed.`;
    const result = cleanDescription(text);

    expect(result).toBe(
      `You'll:\n• Provide technical leadership: Serve as the key technical SME for data scientists and ML engineers on technical problems.\n• Own the experimental lifecycle: Architect and support the transition from data science experimentation to productionised ML.\n• Systematize ML delivery: Set shared patterns for how models are deployed.`,
    );
  });

  it('correctly cleans SmartRecruiters HTML with section headers and prefixed bullet items', () => {
    const html = `
      <section class="job-section">
        <h2>Job Description</h2>
        <div class="wysiwyg">
          <p>We're looking for a Senior MLOps Engineer on AWS.</p>
          <p><strong>You’ll:</strong></p>
          <ul>
            <li>Provide technical leadership: Serve as the key technical SME for data scientists.</li>
            <li>Own the experimental lifecycle: Architect and support the transition to productionised ML.</li>
          </ul>
        </div>
      </section>
    `;
    const result = cleanDescription(html);
    expect(result).toContain('Job Description');
    expect(result).toContain("You’ll:");
    expect(result).toContain('• Provide technical leadership: Serve as the key technical SME for data scientists.');
    expect(result).toContain('• Own the experimental lifecycle: Architect and support the transition to productionised ML.');
  });

  it('correctly identifies process and compensation section headers preceding lists without bulletizing them', () => {
    const text = `
• Unlimited workspace budget. Build your ideal setup.
• Real ownership and impact from day one.

How we think about comp
Our overarching philosophy is to raise the ceiling for our best performers, not the floor. We pay based on the value you add to the company.

• The range listed for this role is total comp: cash plus equity combined.
• We re-evaluate compensation every 6 months.

Our interview process
1. A quick phone call to learn about you and share more about our company.
2. A technical interview, 1hr of system design, no live coding.
3. A paid work trial, so you get a feel for what it's like to work with us.
4. You get an offer, and we celebrate!
    `.trim();

    const result = cleanDescription(text);
    expect(result).toContain('How we think about comp');
    expect(result).not.toContain('• How we think about comp');
    expect(result).toContain('Our interview process');
    expect(result).not.toContain('• Our interview process');
    expect(result).toContain('• A quick phone call to learn about you');
  });

  it('separates inline section headers from paragraphs in SmartRecruiters style descriptions', () => {
    const text = `Company Description: Are you ready to be a big part of something big? At carsales, we’re all about making buying and selling a great experience.

Job Description: We're looking for a Senior MLOps Engineer to own how our AI team builds models.

Qualifications: What we’re looking for: You have 5+ years of experience across MLOps.`;

    const result = cleanDescription(text);
    expect(result).toContain('Company Description:');
    expect(result).toContain('Job Description:');
    expect(result).toContain('Qualifications:');
  });

  it('returns empty string for null or empty inputs', () => {
    expect(cleanDescription(null)).toBe('');
    expect(cleanDescription(undefined)).toBe('');
    expect(cleanDescription('')).toBe('');
  });
});
