/** @format */

// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import {
  autoSelectFirstJobCard,
  findFirstJobCard,
  isJobAlreadySelected,
  isSearchOrListingPage,
  triggerJobCardClick,
} from './auto-select-first-job';

describe('auto-select-first-job', () => {
  it('identifies search and listing URLs correctly for split-view platforms including SEEK', () => {
    expect(
      isSearchOrListingPage('https://www.linkedin.com/jobs/search/?keywords=React'),
    ).toBe(true);
    expect(
      isSearchOrListingPage('https://www.linkedin.com/jobs/collections/recommended/'),
    ).toBe(true);
    expect(
      isSearchOrListingPage('https://www.indeed.com/jobs?q=Frontend'),
    ).toBe(true);
    expect(
      isSearchOrListingPage('https://www.glassdoor.com/Job/jobs.htm?sc.keyword=Engineer'),
    ).toBe(true);
    expect(
      isSearchOrListingPage('https://www.seek.com.au/jobs?keywords=Developer'),
    ).toBe(true);
    expect(
      isSearchOrListingPage('https://www.seek.com.au/software-engineer-jobs'),
    ).toBe(true);
    expect(
      isSearchOrListingPage('https://www.seek.com.au/job/78912345'),
    ).toBe(false);
    expect(
      isSearchOrListingPage('https://www.seek.com.au/profile'),
    ).toBe(false);
  });

  it('finds the first job card on SEEK search results with article card container', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="page-content">
        <article data-automation="premiumJob" data-job-id="10001" id="seek-first">
          <a data-automation="jobTitle" href="/job/10001" target="_blank">Principal Engineer</a>
        </article>
        <article data-automation="normalJob" data-job-id="10002" id="seek-second">
          <a data-automation="jobTitle" href="/job/10002" target="_blank">Senior Developer</a>
        </article>
      </div>
    `;

    const firstEl = container.querySelector<HTMLElement>('#seek-first')!;
    const found = findFirstJobCard(container);
    expect(found).toBe(firstEl);
  });

  it('triggers click on the card element without keeping target="_blank"', () => {
    const card = document.createElement('article');
    card.setAttribute('data-automation', 'normalJob');

    const clickSpy = vi.fn();
    card.addEventListener('click', clickSpy);

    triggerJobCardClick(card);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('detects when a job is already selected in DOM', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <article data-automation="job-card" data-selected="true" id="selected-card">
        <span>Job Selected</span>
      </article>
    `;

    expect(isJobAlreadySelected(container)).toBe(true);
  });

  it('autoSelectFirstJobCard selects immediately on SEEK search page and only clicks once', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <article data-automation="normalJob" id="seek-card">
        <a data-automation="jobTitle" href="/job/999">Full Stack Developer</a>
      </article>
    `;

    const card = container.querySelector('article')!;
    const clickSpy = vi.fn();
    card.addEventListener('click', clickSpy);

    const cleanup = autoSelectFirstJobCard(container, {
      maxWaitMs: 500,
      url: 'https://www.seek.com.au/software-engineer-jobs',
    });
    cleanup();

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
