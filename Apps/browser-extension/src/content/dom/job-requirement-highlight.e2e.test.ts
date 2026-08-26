// @vitest-environment happy-dom
/** @format */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleContentCommand } from '../command-handler';
import { getJobDescriptionRoot } from './job-description-root';
import { readLinkedInPage } from '../platforms/linkedin/job-reader';

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

let scrolledElement: HTMLElement | null = null;
let descriptionExpandCount = 0;

function mountLinkedInSearchDetail(job: {
  id: string;
  title: string;
  skill: string;
}): void {
  descriptionExpandCount = 0;
  document.body.innerHTML = `
    <aside class="jobs-search-results-list">
      <article class="job-card-container" data-occludable-job-id="111111111">
        <p>React appears in this unrelated job card.</p>
        <button class="jobs-description__footer-button">More</button>
      </article>
      <article class="job-card-container" data-occludable-job-id="222222222">
        <p>TypeScript appears in this unrelated job card.</p>
      </article>
    </aside>
    <section data-testid="expandable-text-box">
      React and TypeScript appear in an unrelated page section.
    </section>
    <section class="scaffold-layout__detail jobs-search-two-pane__job-details">
      <h1>${job.title}</h1>
      <div class="jobs-description__container">
        <div class="jobs-description__content">
          <div id="job-details">
            <p>Open the complete job description to view this role's requirements.</p>
          </div>
        </div>
        <button
          id="active-description-more"
          class="jobs-description__footer-button"
          aria-expanded="false"
        >
          Show more
        </button>
      </div>
    </section>
  `;

  const moreButton = document.querySelector<HTMLButtonElement>(
    '#active-description-more',
  );
  moreButton?.addEventListener('click', () => {
    descriptionExpandCount += 1;
    moreButton.setAttribute('aria-expanded', 'true');
    const description = document.querySelector<HTMLElement>('#job-details');
    if (description) {
      description.innerHTML = `<p id="active-${job.id}">The active ${job.title} job requires ${job.skill}.</p>`;
    }
  });
}

describe('LinkedIn skill navigation E2E', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    descriptionExpandCount = 0;
    scrolledElement = null;
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: new URL('https://www.linkedin.com/jobs/search/?currentJobId=333333333'),
    });
    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => visibleRect,
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(function (this: HTMLElement) {
        scrolledElement = this;
      }),
    });
  });

  it('opens and highlights the active JD across multiple LinkedIn job selections', async () => {
    const jobs = [
      { id: '333333333', title: 'Frontend Engineer', skill: 'ReactJS' },
      { id: '444444444', title: 'Platform Engineer', skill: 'TypeScript' },
    ];

    for (const job of jobs) {
      mountLinkedInSearchDetail(job);
      expect(readLinkedInPage().kind).toBe('job');
      expect(getJobDescriptionRoot('linkedin')?.id).toBe('job-details');

      const response = await handleContentCommand({
        type: 'content.highlight-job-requirement',
        searchTerms: job.skill === 'ReactJS' ? ['React', 'ReactJS'] : [job.skill],
      });

      expect(response).toEqual(
        expect.objectContaining({ highlighted: true }),
      );
      expect(descriptionExpandCount).toBe(1);
      expect(scrolledElement?.id).toBe(`active-${job.id}`);
    }
  });
});
