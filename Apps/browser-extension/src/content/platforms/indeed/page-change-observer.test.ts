// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { observeIndeedJobDom } from "./page-change-observer";

describe("Indeed late job detail rendering", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("notifies again when a slowly loaded detail pane becomes ready", async () => {
    const onChange = vi.fn();
    const cleanup = observeIndeedJobDom(onChange);

    document.body.innerHTML = `
      <div class="jobsearch-RightPane">
        <h1 data-testid="jobsearch-JobInfoHeader-title">Platform Engineer</h1>
        <div data-testid="inlineHeader-companyName">Acme</div>
      </div>
    `;
    await vi.advanceTimersByTimeAsync(100);
    expect(onChange).toHaveBeenCalledTimes(1);

    document.querySelector(".jobsearch-RightPane")?.insertAdjacentHTML(
      "beforeend",
      `<div id="jobDescriptionText">${"Build reliable React and TypeScript services. ".repeat(4)}</div>`,
    );
    await vi.advanceTimersByTimeAsync(100);
    expect(onChange).toHaveBeenCalledTimes(2);

    document.body.insertAdjacentHTML("beforeend", "<footer>Unrelated navigation update</footer>");
    await vi.advanceTimersByTimeAsync(100);
    expect(onChange).toHaveBeenCalledTimes(2);
    cleanup();
  });

  it("notifies when Indeed changes the selected card without waiting for another click", async () => {
    document.body.innerHTML = `
      <article class="job_seen_beacon resultWithShelf" data-jk="first-job">
        <h2>First Engineer</h2>
      </article>
      <article class="job_seen_beacon" data-jk="second-job">
        <h2>Second Engineer</h2>
      </article>
      <div class="jobsearch-RightPane">
        <h1 data-testid="jobsearch-JobInfoHeader-title">First Engineer</h1>
        <div id="jobDescriptionText">${"First job description. ".repeat(6)}</div>
      </div>
    `;
    const onChange = vi.fn();
    const cleanup = observeIndeedJobDom(onChange);
    await vi.advanceTimersByTimeAsync(100);
    expect(onChange).toHaveBeenCalledTimes(1);

    const cards = document.querySelectorAll<HTMLElement>("[data-jk]");
    cards.item(0).classList.remove("resultWithShelf");
    cards.item(1).classList.add("resultWithShelf");
    document.querySelector("[data-testid='jobsearch-JobInfoHeader-title']")!.textContent =
      "Second Engineer";
    document.querySelector("#jobDescriptionText")!.textContent =
      "Second job description loaded after the card click. ".repeat(4);
    await vi.advanceTimersByTimeAsync(100);
    expect(onChange).toHaveBeenCalledTimes(2);
    cleanup();
  });

  it("notifies when Indeed changes the pressed job link", async () => {
    document.body.innerHTML = `
      <article class="job_seen_beacon">
        <a data-jk="first-job" aria-pressed="true">First Engineer</a>
      </article>
      <article class="job_seen_beacon">
        <a data-jk="second-job">Second Engineer</a>
      </article>
    `;
    const onChange = vi.fn();
    const cleanup = observeIndeedJobDom(onChange);
    await vi.advanceTimersByTimeAsync(100);
    expect(onChange).toHaveBeenCalledTimes(1);

    const links = document.querySelectorAll<HTMLAnchorElement>("[data-jk]");
    links.item(0).setAttribute("aria-pressed", "false");
    links.item(1).setAttribute("aria-pressed", "true");
    await vi.advanceTimersByTimeAsync(100);
    expect(onChange).toHaveBeenCalledTimes(2);
    cleanup();
  });
});
