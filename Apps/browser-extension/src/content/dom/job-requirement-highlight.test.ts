// @vitest-environment happy-dom
/** @format */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { highlightJobRequirement } from './job-requirement-highlight';

const visibleRect = {
  x: 0,
  y: 0,
  width: 320,
  height: 80,
  top: 0,
  right: 320,
  bottom: 80,
  left: 0,
  toJSON: () => ({}),
} as DOMRect;

beforeEach(() => {
  document.body.innerHTML = '';
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => visibleRect,
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
});

describe('highlightJobRequirement', () => {
  it('scrolls to and highlights the matching JD text', () => {
    document.body.innerHTML = `
      <main>
        <section class="job-description">
          <p>Applicants must hold Australian citizenship for this role.</p>
        </section>
      </main>
    `;

    expect(highlightJobRequirement(['citizenship', 'citizen'])).toBe(true);
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    });
    expect(document.documentElement.lastElementChild?.getAttribute('style')).toContain(
      'rgba(220, 38, 38, 0.95)',
    );
  });

  it('does not highlight when the requirement is absent', () => {
    document.body.innerHTML = '<section class="job-description">Open to all applicants.</section>';

    expect(highlightJobRequirement(['NV1'])).toBe(false);
  });
});
