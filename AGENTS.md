<!-- @format -->

Implementation

- Implement only what is explicitly requested. Do not add features, abstractions, configuration, validation, fallbacks, or refactors unless necessary.
- Choose the smallest and simplest implementation that fully satisfies the current requirement.
- Keep changes scoped. Do not modify or refactor unrelated code.
- Do not preserve backward compatibility unless explicitly requested. Remove obsolete paths instead of adding compatibility layers.
- Do not design for hypothetical future requirements. Introduce abstractions only when they clearly simplify the current implementation.
- Reuse existing project patterns, components, utilities, and dependencies before creating new ones.
- Prefer established, well-maintained libraries when they reduce complexity. Do not reimplement common functionality without a clear reason.
- Keep responsibilities separated, but avoid unnecessary layers, indirection, and architectural complexity.
- If ambiguity would materially affect scope or architecture, ask before implementing.

Product UI

- Treat UI copy and visual decoration as requested scope, not implementation detail. Do not add subtitles, descriptions, helper text, marketing copy, onboarding, badges, status/debug panels, or agent reasoning to product pages unless explicitly requested.
- For a page or section title, render only the requested title. Do not add an icon, subtitle, description, gradient, or decorative wrapper unless explicitly requested.
- Preserve existing page content and layout when adding a feature; change only what the feature requires. Reuse existing copy and components instead of adding explanatory UI.

Frontend Performance

- Keep shared layouts and providers lightweight. They must not import route-specific or heavyweight features such as PDF renderers, charts, maps, data tables, or full icon libraries.
- Import only the symbols and modules needed by the feature. Avoid broad barrel imports that can pull unrelated modules; use direct imports for heavyweight or feature-only UI.
- Load heavyweight client features only on the routes or interactions that need them.
- Do not add polling, intervals, event listeners, observers, object URLs, or unbounded client caches unless necessary; always clean them up on unmount.
- When changing a shared frontend import boundary, verify the affected build output or targeted test before finishing.

Communication

- Keep responses, plans, comments, and code concise. Use the fewest tokens and lines that fully satisfy the request.
- Do not add comments, documentation, explanations, or user-facing copy that the request did not ask for.

Files & Cleanup

- Keep files focused. Treat 300 lines as a guideline, not a hard limit; split by responsibility when a file becomes difficult to maintain.
- After replacing or refactoring code, remove superseded files, dead code, unused imports/exports, duplicate implementations, and commented-out legacy code.
- Do not keep parallel Old, Legacy, V2, New, Backup, or Temp implementations unless explicitly required.
