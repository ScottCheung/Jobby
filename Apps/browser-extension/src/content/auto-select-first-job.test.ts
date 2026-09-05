/** @format */

// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import {
  autoSelectFirstJobCard,
  extractTargetJobId,
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
      isSearchOrListingPage('https://www.seek.com.au/jobs/in-Melbourne-VIC'),
    ).toBe(true);
    expect(
      isSearchOrListingPage('https://www.seek.com.au/jobs-in-information-communication-technology'),
    ).toBe(true);
    expect(
      isSearchOrListingPage('https://www.seek.com.au/software-engineer-jobs/in-All-Melbourne-VIC'),
    ).toBe(true);
    expect(
      isSearchOrListingPage('https://www.seek.com.au/job/78912345'),
    ).toBe(false);
    expect(
      isSearchOrListingPage('https://www.seek.com.au/job/78912345/apply'),
    ).toBe(false);
    expect(
      isSearchOrListingPage('https://www.seek.com.au/apply/78912345'),
    ).toBe(false);
    expect(
      isSearchOrListingPage('https://www.seek.com.au/profile'),
    ).toBe(false);
    expect(
      isSearchOrListingPage('https://www.seek.com.au/login'),
    ).toBe(false);
    expect(
      isSearchOrListingPage('https://www.seek.com.au/account'),
    ).toBe(false);
    expect(
      isSearchOrListingPage('https://www.seek.com.au/saved-jobs'),
    ).toBe(false);
    expect(
      isSearchOrListingPage('https://www.seek.com.au/applied-jobs'),
    ).toBe(false);
    expect(
      isSearchOrListingPage('https://www.seek.com.au/'),
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

  it('detects when a job is already selected in DOM or SEEK details pane is rendered', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <article data-automation="job-card" data-selected="true" id="selected-card">
        <span>Job Selected</span>
      </article>
    `;

    expect(isJobAlreadySelected(container)).toBe(true);

    const seekContainer = document.createElement('div');
    seekContainer.innerHTML = `
      <div data-automation="jobAdDetails">
        <p>Job Description text</p>
      </div>
    `;
    expect(isJobAlreadySelected(seekContainer)).toBe(true);
  });

  it('extracts target jobId from query parameters across platforms', () => {
    expect(extractTargetJobId('https://au.seek.com/jobs?jobId=94321887')).toBe('94321887');
    expect(extractTargetJobId('https://www.linkedin.com/jobs/search/?currentJobId=388888')).toBe('388888');
    expect(extractTargetJobId('https://www.indeed.com/jobs?vjk=abc12345')).toBe('abc12345');
    expect(extractTargetJobId('https://www.indeed.com/jobs?jk=xyz67890')).toBe('xyz67890');
    expect(extractTargetJobId('https://au.seek.com/jobs')).toBeNull();
  });

  it('selects targeted card matching requested jobId instead of the first card', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <article data-automation="normalJob" data-job-id="111" aria-selected="true" id="first-card">
        <a data-automation="jobTitle" href="/job/111">First Job</a>
      </article>
      <article data-automation="normalJob" data-job-id="222" id="target-card">
        <a data-automation="jobTitle" href="/job/222">Target Job</a>
      </article>
      <div data-automation="jobAdDetails">First job description</div>
    `;

    const firstCard = container.querySelector('#first-card')!;
    const targetCard = container.querySelector('#target-card')!;
    const firstSpy = vi.fn();
    const targetSpy = vi.fn();
    firstCard.addEventListener('click', firstSpy);
    targetCard.addEventListener('click', targetSpy);

    const cleanup = autoSelectFirstJobCard(container, {
      maxWaitMs: 500,
      url: 'https://au.seek.com/jobs?jobId=222',
    });
    cleanup();

    expect(targetSpy).toHaveBeenCalledTimes(1);
    expect(firstSpy).not.toHaveBeenCalled();
  });

  it('does not select first card if a specific jobId was requested in the URL but not found', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <article data-automation="normalJob" data-job-id="111" id="first-card">
        <a data-automation="jobTitle" href="/job/111">First Job</a>
      </article>
    `;

    const firstCard = container.querySelector('#first-card')!;
    const firstSpy = vi.fn();
    firstCard.addEventListener('click', firstSpy);

    const cleanup = autoSelectFirstJobCard(container, {
      maxWaitMs: 10,
      url: 'https://au.seek.com/jobs?jobId=99999999',
    });
    cleanup();

    expect(firstSpy).not.toHaveBeenCalled();
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
