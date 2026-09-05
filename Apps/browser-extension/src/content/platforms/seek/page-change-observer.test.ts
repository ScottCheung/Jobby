// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { observeSeekJobDom } from "./page-change-observer";

describe("SEEK late job detail rendering", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("notifies when a slowly loaded detail pane becomes identifiable", async () => {
    const onChange = vi.fn();
    const cleanup = observeSeekJobDom(onChange);

    document.body.innerHTML = `
      <div data-automation="jobDetailsPage">
        <h1 data-automation="job-detail-title">Platform Engineer</h1>
        <span data-automation="advertiser-name">Acme</span>
      </div>
    `;
    await vi.advanceTimersByTimeAsync(100);
    expect(onChange).toHaveBeenCalledTimes(1);

    document.querySelector("[data-automation='jobDetailsPage']")?.insertAdjacentHTML(
      "beforeend",
      `<div data-automation="jobAdDetails">${"Build reliable React and TypeScript services. ".repeat(4)}</div>`,
    );
    await vi.advanceTimersByTimeAsync(100);
    expect(onChange).toHaveBeenCalledTimes(2);

    document.body.insertAdjacentHTML("beforeend", "<footer>Unrelated navigation update</footer>");
    await vi.advanceTimersByTimeAsync(100);
    expect(onChange).toHaveBeenCalledTimes(2);
    cleanup();
  });

  it("notifies when SEEK mounts its current split-view detail wrapper", async () => {
    const onChange = vi.fn();
    const cleanup = observeSeekJobDom(onChange);

    document.body.innerHTML = `
      <div data-automation="splitViewJobDetailsWrapper">
        <h1 data-automation="job-detail-title">Google Cloud Engineer</h1>
        <div data-automation="jobAdDetails">${"NV1 or NV2 security clearance is preferred. ".repeat(3)}</div>
      </div>
    `;

    await vi.advanceTimersByTimeAsync(100);
    expect(onChange).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("notifies when SEEK changes the selected card without changing the URL", async () => {
    document.body.innerHTML = `
      <article data-testid="job-card" data-job-id="40000001" aria-selected="true">
        <a data-automation="jobTitle" href="/job/40000001">First Engineer</a>
      </article>
      <article data-testid="job-card" data-job-id="40000002" aria-selected="false">
        <a data-automation="jobTitle" href="/job/40000002">Second Engineer</a>
      </article>
      <div data-automation="jobDetailsPage"><h1 data-automation="job-detail-title">First Engineer</h1></div>
    `;
    const onChange = vi.fn();
    const cleanup = observeSeekJobDom(onChange);
    await vi.advanceTimersByTimeAsync(100);
    expect(onChange).toHaveBeenCalledTimes(1);

    const cards = document.querySelectorAll<HTMLElement>("[data-testid='job-card']");
    cards.item(0).setAttribute("aria-selected", "false");
    cards.item(1).setAttribute("aria-selected", "true");
    document.querySelector("[data-automation='job-detail-title']")!.textContent = "Second Engineer";
    await vi.advanceTimersByTimeAsync(100);
    expect(onChange).toHaveBeenCalledTimes(2);
    cleanup();
  });

  it("does not starve a card-change notification while SEEK keeps mutating the page", async () => {
    document.body.innerHTML = `
      <article data-testid="job-card" data-job-id="50000001" aria-selected="true">
        <a data-automation="jobTitle" href="/job/50000001">First Engineer</a>
      </article>
      <article data-testid="job-card" data-job-id="50000002" aria-selected="false">
        <a data-automation="jobTitle" href="/job/50000002">Second Engineer</a>
      </article>
      <div data-automation="jobDetailsPage"><h1 data-automation="job-detail-title">First Engineer</h1></div>
    `;
    const onChange = vi.fn();
    const cleanup = observeSeekJobDom(onChange);
    await vi.advanceTimersByTimeAsync(100);

    const cards = document.querySelectorAll<HTMLElement>("[data-testid='job-card']");
    cards.item(0).setAttribute("aria-selected", "false");
    cards.item(1).setAttribute("aria-selected", "true");
    document.querySelector("[data-automation='job-detail-title']")!.textContent = "Second Engineer";
    for (let index = 0; index < 3; index += 1) {
      document.body.insertAdjacentHTML("beforeend", `<div data-change="${index}"></div>`);
      await vi.advanceTimersByTimeAsync(50);
    }

    expect(onChange).toHaveBeenCalledTimes(2);
    cleanup();
  });
});
