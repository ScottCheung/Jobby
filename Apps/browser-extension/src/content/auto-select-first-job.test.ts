/** @format */

// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import {
  autoClickFirstJobCard,
  findFirstJobCard,
  isSearchOrListingPage,
  triggerJobCardClick,
} from './auto-select-first-job';

describe('auto-select-first-job', () => {
  it('identifies search and listing URLs correctly across platforms including SEEK', () => {
    expect(
      isSearchOrListingPage('https://www.linkedin.com/jobs/search/?keywords=React'),
    ).toBe(true);
    expect(
      isSearchOrListingPage('https://www.linkedin.com/jobs/collections/recommended/'),
    ).toBe(true);
    expect(
      isSearchOrListingPage('https://www.seek.com.au/jobs?keywords=Developer'),
    ).toBe(true);
    expect(
      isSearchOrListingPage('https://www.seek.com.au/software-engineer-jobs'),
    ).toBe(true);
    expect(
      isSearchOrListingPage('https://www.seek.com.au/software-engineer-jobs/in-All-Brisbane-QLD'),
    ).toBe(true);
    expect(
      isSearchOrListingPage('https://www.seek.com.au/jobs-in-information-communication-technology'),
    ).toBe(true);
    expect(
      isSearchOrListingPage('https://www.seek.com.au/react-jobs?classification=6281'),
    ).toBe(true);
    expect(
      isSearchOrListingPage('https://www.seek.com.au/job/78912345'),
    ).toBe(false);
    expect(
      isSearchOrListingPage('https://www.seek.com.au/profile'),
    ).toBe(false);
    expect(
      isSearchOrListingPage('https://www.indeed.com/jobs?q=Frontend'),
    ).toBe(true);
    expect(
      isSearchOrListingPage('https://www.glassdoor.com/Job/jobs.htm?sc.keyword=Engineer'),
    ).toBe(true);
  });

  it('finds the first job card matching platform selectors', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="unrelated-banner">Hello</div>
      <div class="jobs-search-results-list">
        <div class="job-card-container" id="first-job">
          <a class="job-card-list__title" href="/jobs/view/123">Software Engineer</a>
        </div>
        <div class="job-card-container" id="second-job">
          <a class="job-card-list__title" href="/jobs/view/456">Product Manager</a>
        </div>
      </div>
    `;

    const firstEl = container.querySelector<HTMLElement>('#first-job')!;
    const found = findFirstJobCard(container);
    expect(found).toBe(firstEl);
  });

  it('finds the first job card on SEEK search results with various card formats', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="page-content">
        <article data-automation="premiumJob" data-job-id="10001" id="seek-first">
          <a data-automation="jobTitle" href="/job/10001">Principal Engineer</a>
        </article>
        <article data-automation="normalJob" data-job-id="10002" id="seek-second">
          <a data-automation="jobTitle" href="/job/10002">Senior Developer</a>
        </article>
      </div>
    `;

    const firstEl = container.querySelector<HTMLElement>('#seek-first')!;
    const found = findFirstJobCard(container);
    expect(found && (found === firstEl || firstEl.contains(found))).toBe(true);
  });

  it('triggers click and mouse events on the target element', () => {
    const card = document.createElement('div');
    card.className = 'job-card-container';
    const link = document.createElement('a');
    link.href = '#';
    card.appendChild(link);

    const clickSpy = vi.fn();
    link.addEventListener('click', clickSpy);

    triggerJobCardClick(card);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('autoClickFirstJobCard clicks immediately on SEEK search page if card already exists in DOM', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <article data-automation="normalJob" id="seek-job">
        <a data-automation="jobTitle" href="/job/999">Full Stack Developer</a>
      </article>
    `;

    const link = container.querySelector('a')!;
    const clickSpy = vi.fn();
    link.addEventListener('click', clickSpy);

    const cleanup = autoClickFirstJobCard(container, {
      maxWaitMs: 500,
      url: 'https://www.seek.com.au/software-engineer-jobs',
    });
    cleanup();

    expect(clickSpy).toHaveBeenCalled();
  });
});
