# Browser extension platform architecture

This directory owns job-provider detection and provider-specific page-reading configuration. The architecture separates provider definitions from shared execution so adding a provider does not require copying a reader.

## Runtime flow

```text
page-classifier
  -> provider-routing
      -> dedicated LinkedIn / SEEK / Indeed reader
      -> registered ATS definition + shared ats reader
      -> generic fallback when no provider matches or a provider cannot confirm the page
```

Form inspection follows the same boundary:

```text
provider-routing
  -> LinkedIn / SEEK dedicated form reader
  -> registered application roots + shared ats form reader
  -> generic form reader fallback
  -> shared DOM form driver for field writes
```

`provider-routing.ts` detects a provider. `page-reader.ts` selects the reader. The registry is the only content-layer list of provider definitions.

## Directory responsibilities

| Location | Responsibility |
| --- | --- |
| `registry.ts` | Registers all provider definitions and exposes typed lookup functions. |
| `platform-definition.ts` | Defines the shape of routing, job, form, readiness, and autofill configuration. |
| `<provider>/definition.ts` | Owns that provider's hosts, DOM markers, selectors, roots, fallbacks, and declared policies. |
| `ats/` | Runs registered ATS definitions with shared job and form algorithms. |
| `generic/` | Reads genuinely unknown job and form pages. It must not own named-provider behavior. |
| `linkedin/`, `seek/`, `indeed/` | Dedicated readers for flows that do not fit the shared ATS job reader. |

## Provider support matrix

| Provider | Job reading | Form reading | Notable policy or adapter |
| --- | --- | --- | --- |
| LinkedIn | Dedicated | Dedicated | Voyager API and Easy Apply adapter |
| SEEK | Dedicated | Dedicated | SEEK application actions and selectors |
| Indeed | Dedicated | Shared ATS | Indeed readiness polling |
| Glassdoor | Shared ATS | Shared ATS | Selected-card identity and late posting age |
| Workday | Shared ATS | Shared ATS | Workday automation attributes |
| Greenhouse | Shared ATS | Shared ATS | React-select and location controls |
| Lever | Shared ATS | Shared ATS | Posting-page definition |
| Ashby | Shared ATS | Shared ATS | Sequential controlled-field autofill |
| SmartRecruiters | Shared ATS | Shared ATS | Shadow-DOM resume adapter |
| Taleo | Shared ATS | Shared ATS | Legacy requisition identifiers |
| iCIMS | Shared ATS | Shared ATS | White-label DOM markers |
| SuccessFactors | Shared ATS | Shared ATS | White-label DOM markers |
| Oracle | Shared ATS | Shared ATS | Candidate Experience selectors |
| Workable | Shared ATS | Shared ATS | `data-ui` selectors |
| BambooHR | Shared ATS | Shared ATS | BambooHR career-page selectors |
| Jora | Shared ATS | Shared ATS | Split-SERP pane & card selectors, Quick Apply roots |

Platforms recognised only by the page classifier, but not registered here, intentionally remain `generic`.

## Adding or changing a provider

1. Add or edit `<provider>/definition.ts`.
2. Register a new definition in `registry.ts`.
3. Add the platform name once in `shared/contracts/platform.ts` when it is new.
4. Use the shared ATS readers unless the provider requires a genuinely different workflow.
5. Put provider-only adapters or policies in the provider directory.
6. Add hostname and white-label routing coverage where applicable.
7. Add job and application-form fixtures.
8. Run the registry, routing, ATS reader, form detection, typecheck, and production build checks.

If the browser extension platform list changes, mirror the accepted platform value in the backend autofill contract and its tests. The backend is a separate Python boundary and cannot derive its runtime values from this TypeScript registry.
