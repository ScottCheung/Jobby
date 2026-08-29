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

function setLocation(url: string): void {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: new URL(url),
  });
}

beforeEach(() => {
  document.body.innerHTML = '';
  setLocation('https://www.linkedin.com/jobs/view/123456789/');
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
  it('scrolls to the matching JD text without creating a full-page overlay', async () => {
    document.body.innerHTML = `
      <main class="jobs-details__main-content">
        <section id="job-details">
          <p>Applicants must hold Australian citizenship for this role.</p>
        </section>
      </main>
    `;

    const result = await highlightJobRequirement(['citizenship', 'citizen']);
    expect(result.highlighted).toBe(true);
    expect(result.matchCount).toBe(1);
    expect(result.currentIndex).toBe(1);
    expect(
      document.querySelector('[data-jobby-skill-highlight="true"]'),
    ).toBeNull();
  });

  it('never activates unrelated LinkedIn controls while locating a skill', async () => {
    document.body.innerHTML = `
      <main class="jobs-details__main-content">
        <a id="company-link" href="https://www.linkedin.com/company/acme/">
          Show more about the company
        </a>
        <button id="people-search">See all</button>
        <section id="job-details">
          <p>Build production services with TypeScript.</p>
        </section>
      </main>
    `;
    const companyLink = document.querySelector<HTMLAnchorElement>('#company-link')!;
    const onCompanyClick = vi.fn((event: Event) => event.preventDefault());
    companyLink.addEventListener('click', onCompanyClick);
    const peopleSearch = document.querySelector<HTMLButtonElement>('#people-search')!;
    const onPeopleSearchClick = vi.fn();
    peopleSearch.addEventListener('click', onPeopleSearchClick);

    const result = await highlightJobRequirement(['TypeScript']);

    expect(result.highlighted).toBe(true);
    expect(onCompanyClick).not.toHaveBeenCalled();
    expect(onPeopleSearchClick).not.toHaveBeenCalled();
  });

  it('uses an exact CSS text highlight without creating a browser selection', async () => {
    document.body.innerHTML = `
      <main class="jobs-details__main-content">
        <section id="job-details">
          <p>Experience with Angular and TypeScript is required.</p>
        </section>
      </main>
    `;
    class TestHighlight {
      readonly ranges: Range[];

      constructor(...ranges: Range[]) {
        this.ranges = ranges;
      }
    }
    const registry = {
      set: vi.fn(),
      delete: vi.fn(() => true),
    };
    const originalHighlight = Object.getOwnPropertyDescriptor(
      window,
      'Highlight',
    );
    const originalRegistry = Object.getOwnPropertyDescriptor(
      window.CSS,
      'highlights',
    );
    window.Highlight = TestHighlight as any;
    globalThis.Highlight = TestHighlight as any;
    (window as any).CSS = { highlights: registry };
    (globalThis as any).CSS = { highlights: registry };
    window.getSelection()?.removeAllRanges();

    try {
      const result = await highlightJobRequirement(['Angular']);
      expect(result.highlighted).toBe(true);
      expect(registry.set).toHaveBeenCalled();
      expect(window.getSelection()?.rangeCount).toBe(0);
      expect(
        document.querySelector('[data-jobby-skill-highlight="true"]'),
      ).toBeNull();
    } finally {
      if (originalHighlight) {
        Object.defineProperty(window, 'Highlight', originalHighlight);
        Object.defineProperty(globalThis, 'Highlight', originalHighlight);
      } else {
        Reflect.deleteProperty(window, 'Highlight');
        Reflect.deleteProperty(globalThis, 'Highlight');
      }
      if (originalRegistry) {
        Object.defineProperty(window.CSS, 'highlights', originalRegistry);
      } else {
        Reflect.deleteProperty(window.CSS, 'highlights');
      }
    }
  });

  it('does not highlight when the requirement is absent', async () => {
    document.body.innerHTML =
      '<main class="jobs-details__main-content"><section id="job-details">Open to all applicants.</section></main>';

    const result = await highlightJobRequirement(['NV1']);
    expect(result.highlighted).toBe(false);
    expect(result.matchCount).toBe(0);
  });

  it('ignores matching keywords in navigation, search bar, and sidebars, locating only inside the job description', async () => {
    document.body.innerHTML = `
      <nav>
        <a href="/search?q=React">Search React Jobs</a>
      </nav>
      <header>
        <input type="text" value="React Developer" />
      </header>
      <aside class="jobs-search-results-list">
        <div>React Software Engineer</div>
      </aside>
      <main class="jobs-details__main-content">
        <div id="job-details" class="jobs-description__content">
          <h3>About the role</h3>
          <p id="target-jd-p">We require hands-on experience building web apps with React.</p>
        </div>
      </main>
    `;

    const result = await highlightJobRequirement(['React']);
    expect(result.highlighted).toBe(true);
    expect(result.matchCount).toBe(1);
    expect(result.currentIndex).toBe(1);
  });

  it('correctly detects multiple matches and cycles through them on successive calls', async () => {
    document.body.innerHTML = `
      <main class="jobs-details__main-content">
        <div id="job-details" class="jobs-description__content">
          <p>Overview: Looking for a senior React engineer.</p>
          <ul>
            <li>Requirement 1: 5+ years of React development</li>
            <li>Requirement 2: Familiarity with React Native or React.js</li>
          </ul>
        </div>
      </main>
    `;

    // 1st call -> match 1 of 4
    const call1 = await highlightJobRequirement(['React', 'React.js', 'ReactJS']);
    expect(call1.highlighted).toBe(true);
    expect(call1.matchCount).toBe(4);
    expect(call1.currentIndex).toBe(1);

    // 2nd call -> match 2 of 4
    const call2 = await highlightJobRequirement(['React', 'React.js', 'ReactJS']);
    expect(call2.highlighted).toBe(true);
    expect(call2.matchCount).toBe(4);
    expect(call2.currentIndex).toBe(2);

    // 3rd call -> match 3 of 4
    const call3 = await highlightJobRequirement(['React', 'React.js', 'ReactJS']);
    expect(call3.highlighted).toBe(true);
    expect(call3.matchCount).toBe(4);
    expect(call3.currentIndex).toBe(3);

    // 4th call -> match 4 of 4
    const call4 = await highlightJobRequirement(['React', 'React.js', 'ReactJS']);
    expect(call4.highlighted).toBe(true);
    expect(call4.matchCount).toBe(4);
    expect(call4.currentIndex).toBe(4);

    // 5th call -> wraps back to match 1 of 4
    const call5 = await highlightJobRequirement(['React', 'React.js', 'ReactJS']);
    expect(call5.highlighted).toBe(true);
    expect(call5.matchCount).toBe(4);
    expect(call5.currentIndex).toBe(1);
  });

  it('uses fluorescent styling in the injected highlight style tag', async () => {
    document.body.innerHTML = `
      <main class="jobs-details__main-content">
        <div id="job-details">
          <p>We use Python for data processing.</p>
        </div>
      </main>
    `;

    await highlightJobRequirement(['Python']);
    const style = document.getElementById('jobby-skill-highlight-style');
    expect(style).not.toBeNull();
    expect(style?.textContent).toContain('#facc15');
  });

  it('uses the detected provider JD selector instead of a generic matching card', async () => {
    setLocation('https://careers.example.com/jobs/123');
    document.body.innerHTML = `
      <main data-automation-id="jobPostingPage">
        <section data-automation-id="jobPostingDescription">
          <p>We are looking for engineers experienced with TypeScript.</p>
        </section>
      </main>
      <section class="job-description">
        <p>React is mentioned in a related job card.</p>
      </section>
    `;

    const reactRes = await highlightJobRequirement(['React']);
    expect(reactRes.highlighted).toBe(false);

    const tsRes = await highlightJobRequirement(['TypeScript']);
    expect(tsRes.highlighted).toBe(true);
  });

  it('does not scan unrecognised pages for matching text', async () => {
    setLocation('https://careers.example.com/jobs/123');
    document.body.innerHTML = `
      <main>
        <section class="job-description">
          <p>React is mentioned here, but this page has no supported provider.</p>
        </section>
      </main>
    `;

    const result = await highlightJobRequirement(['React']);
    expect(result.highlighted).toBe(false);
  });

  it('respects word boundaries so partial substrings do not trigger false matches', async () => {
    document.body.innerHTML = `
      <main class="jobs-details__main-content">
        <div id="job-details">
          <p>We are looking for JavaScript and Reaction engineers.</p>
        </div>
      </main>
    `;

    expect((await highlightJobRequirement(['Java'])).highlighted).toBe(false);
    expect((await highlightJobRequirement(['React'])).highlighted).toBe(false);
    expect((await highlightJobRequirement(['JavaScript'])).highlighted).toBe(true);
  });

  it('automatically clicks LinkedIn more button to expand the job description', async () => {
    let expanded = false;
    document.body.innerHTML = `
      <main class="jobs-details__main-content">
        <div class="jobs-description__container">
          <div id="job-details" class="jobs-description__content">
            <p>Short snippet...</p>
          </div>
          <button class="jobs-description__footer-button" aria-expanded="false">
            Show more
          </button>
        </div>
      </main>
    `;

    const button = document.querySelector<HTMLButtonElement>(
      '.jobs-description__footer-button',
    )!;
    button.addEventListener('click', () => {
      expanded = true;
      button.setAttribute('aria-expanded', 'true');
      const details = document.querySelector('#job-details')!;
      details.innerHTML = '<p>Full description with Python requirements.</p>';
    });

    const result = await highlightJobRequirement(['Python']);
    expect(result.highlighted).toBe(true);
    expect(expanded).toBe(true);
  });

  it('automatically clicks Glassdoor show more button to expand the job description', async () => {
    setLocation('https://www.glassdoor.com/Job/software-engineer-jobs.htm');
    let expanded = false;
    document.body.innerHTML = `
      <div class="JobDetails_jobDetailsContainer__abc">
        <header data-test="job-details-header">
          <h1 id="jd-job-title-101">Software Engineer</h1>
        </header>
        <div class="JobDetails_jobDescriptionWrapper__abc JobDetails_truncated__abc">
          <section class="JobDetails_jobDescription__abc" data-test="job-description">
            <p>Initial preview...</p>
          </section>
          <button class="JobDetails_showMore__abc" data-test="show-more-button" aria-expanded="false">
            Show More
          </button>
        </div>
      </div>
    `;

    const button = document.querySelector<HTMLButtonElement>(
      "[data-test='show-more-button']",
    )!;
    button.addEventListener('click', () => {
      expanded = true;
      button.setAttribute('aria-expanded', 'true');
      const details = document.querySelector('[data-test="job-description"]')!;
      details.innerHTML = '<p>Full job description requiring Kubernetes and Docker.</p>';
    });

    const result = await highlightJobRequirement(['Kubernetes']);
    expect(result.highlighted).toBe(true);
    expect(expanded).toBe(true);
  });
});
