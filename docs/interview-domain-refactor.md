# Interview Domain Refactor

## Goal

Refactor the interview prep data model so `Question` stays a clean content entity while user state, community activity, answers, and cached metrics live in separate entities.

This plan favors low long-term technical debt over preserving the current schema shape. Existing user data is not treated as critical.

## Current Problems

1. `interview_questions` mixes:
   - prompt content
   - author-provided reference content
   - user-specific answer/progress data
2. `question_comments` mixes:
   - real discussion / feedback
   - answer-like `example` content
3. public metrics are recomputed ad hoc and are not cached centrally
4. question popularity and quality signals are not separated from question author defaults

## Target Domain Boundaries

### 1. Questions

`interview_questions` should represent only the shared question artifact and author defaults.

Keep here:
- title
- category / tags / companies / source linkage
- author default frequency
- author default importance
- archival / ownership metadata

Move away from here over time:
- answer bodies
- community examples
- user personal answers
- user progress notes
- public counters

### 2. User-Question State

`user_questions` already models the relationship between a user and a question. We will formalize that role instead of creating another join table.

`user_questions` should own:
- library membership
- user-specific category override
- user-specific frequency / importance override
- personal answer / notes
- favorited state
- per-user counters and timestamps

### 3. Answers

Create `question_answers` as the canonical home for answer-like artifacts:
- author reference answers
- AI-generated reference answers
- community-contributed answers
- frameworks
- future rubrics / scoring guides

Recommended initial fields:
- `question_id`
- `author_user_id`
- `source` (`author`, `ai`, `community`, `user`)
- `answer_type` (`reference`, `framework`, `rubric`)
- `status` (`draft`, `published`, `archived`)
- `title`
- `body`
- `metadata`
- `is_recommended`
- `recommended_by_user_id`
- `recommended_at`

### 4. Community Interaction

Short term:
- keep `question_comments` for discussion / feedback
- stop treating `example` as the long-term home for answer content

Long term:
- comments should be able to target answers as well

### 5. Cached Public Metrics

Create `question_metrics` as one cached row per question for public aggregates:
- view count
- unique viewer count
- practice count
- unique practicer count
- total practice seconds
- average practice seconds
- favorite count
- upvote count
- downvote count
- seen in interview count
- rating counts and averages
- blended importance / frequency scores

## Scoring and Weighting Model

Author defaults remain on the question.

Community contribution grows as ratings accumulate, capped at 80%.

Example:

- `community_weight = min(0.8, rating_count / 50 * 0.8)`
- `author_weight = 1 - community_weight`
- `blended_importance = author_importance * author_weight + community_importance_avg * community_weight`
- `blended_frequency = author_frequency * author_weight + community_frequency_avg * community_weight`

This keeps the author signal at a permanent minimum of 20%.

## Phase 1 Implementation

Phase 1 should preserve current app behavior while adding the long-term structure.

### Database

1. add `question_answers`
2. add `question_answer_reactions`
3. add `question_metrics`
4. extend `question_ratings` with optional `frequency_rating`
5. extend `practice_records` with timing fields
6. extend `user_questions` with favorite and engagement counters
7. add question author default fields without removing current legacy fields yet

### Backend

1. expose metrics through the community summary API
2. backfill author reference answer and framework rows from question legacy fields
3. sync question create/update so author answer rows stay aligned during transition
4. keep legacy question response fields for now to avoid frontend breakage

### Frontend

Short term:
- keep existing three tabs
- keep existing question fields working

Transition path:
- reference answers tab reads `question_answers`
- framework tab reads `question_answers` filtered by `answer_type=framework`
- discussion tab keeps reading `question_comments`

## Phase 2

1. remove `example` from comment creation UI
2. move author answer editing to answer APIs
3. move framework editing to answer APIs
4. allow answer likes and answer comments
5. deprecate legacy question answer fields once UI no longer depends on them

## Non-Goals For Phase 1

- full AI scoring implementation
- replacing all frontend tabs in one pass
- hard deletion of legacy question answer fields
- polymorphic comments

## Why This Path

This sequence gives us:
- a clean final model
- minimal disruption while refactoring
- room to add AI answer generation and AI scoring without further schema churn
