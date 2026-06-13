# Domain Docs

This is a single-context repo. Engineering skills should read root-level domain documentation before changing behavior when those files exist.

## Reading order

- Read `CONTEXT.md` at the repo root when present.
- Read relevant ADRs under `docs/adr/` when present.
- If either path does not exist, proceed without treating the absence as an error.

## Domain vocabulary

Use the project's documented vocabulary when naming issues, hypotheses, test cases, and architecture proposals. If a needed concept is not defined yet, note the gap before introducing a new term.

## ADR conflicts

If a proposed change contradicts an existing ADR, surface that conflict explicitly instead of silently overriding the decision.
