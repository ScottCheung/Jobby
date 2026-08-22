/** @format */

import type { ValidatedApplicationPlanResponse } from '../../shared/contracts/backend';
import type { PageInspection } from '../../shared/contracts/page-inspection';

const CONTAINER_ID = 'jobby-in-page-score-card';

/**
 * Clean up any legacy in-page DOM injected cards so host pages don't suffer
 * layout shifts or jumping.
 */
export function removeInPageScoreCard(): void {
  const existing = document.getElementById(CONTAINER_ID);
  if (existing) existing.remove();
}

export function injectInPageScoreCard(
  _inspection?: PageInspection | null,
  _plan?: ValidatedApplicationPlanResponse | null
): void {
  // Do not insert into host page DOM to avoid layout shifts / jumping.
  removeInPageScoreCard();
}
