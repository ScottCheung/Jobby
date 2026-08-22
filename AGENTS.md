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

Files & Cleanup

- Keep files focused. Treat 300 lines as a guideline, not a hard limit; split by responsibility when a file becomes difficult to maintain.
- After replacing or refactoring code, remove superseded files, dead code, unused imports/exports, duplicate implementations, and commented-out legacy code.
- Do not keep parallel Old, Legacy, V2, New, Backup, or Temp implementations unless explicitly required.
