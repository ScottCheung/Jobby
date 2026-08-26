# Platform implementation rules

These instructions apply to the `platforms/` subtree.

## Ownership

- Every named provider must have exactly one provider directory containing its `definition.ts`.
- Keep provider host rules, DOM markers, job selectors, application roots, metadata fallbacks, and provider policies in that provider's `definition.ts`.
- Keep complex provider-only readers, adapters, or strategies beside that definition in the same provider directory.
- Keep `ats/` provider-agnostic. It may execute registered definitions but must not contain named-provider selector tables or branches.
- Keep `generic/` provider-agnostic. Cross-provider semantic heuristics are allowed, but provider-only names, selectors, URL rules, and workarounds belong in the provider directory.
- Shared contracts own platform-name tuples. Do not create another platform-name list in content code.

## Registration

- Register every named provider in `registry.ts`.
- Add ATS job providers to `atsProviderDefinitions`; the registry completeness tests must pass.
- Route platforms through `provider-routing.ts`; do not add hostname checks to `page-reader.ts`.
- Prefer a declarative definition field over a platform-name conditional in shared code.

## Behaviour and testing

- Preserve the generic fallback when a provider reader cannot confirm a job or form.
- Do not duplicate the shared job reader, form inspector, or form driver inside simple provider directories.
- Add or update routing, job-reading, and form-reading tests when provider definitions change.
- Test white-label DOM detection when the provider can run on employer-owned hostnames.
- Never make automatic final application submission part of a platform adapter.

See `README.md` in this directory for the runtime flow and the provider support matrix.
