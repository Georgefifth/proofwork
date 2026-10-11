# PDF Regression Workbench

## Goal
Help document-pipeline maintainers turn human-verified facts from a PDF into repeatable table regression checks. The product connects source evidence, test authoring, and baseline/candidate comparison. It does not certify an entire document or infer truth with an LLM.

## Workspace constraint
Work only in this newly created directory. Do not inspect or reuse other local projects. Research references are public URLs in PRODUCT.md. Do not overwrite the parent workspace's instructions.

## Architecture
- React + TypeScript + Vite: local browser interface.
- PDF.js: source PDF rendering. PDF bytes stay in the browser.
- Pure TypeScript engine: Markdown/HTML table parsing, exact normalized row/column/value contracts, and regression classification.
- JSON project export: source SHA-256, normalized source rectangles, human-authored contracts and original extraction outputs. Source PDF must be reattached and its hash verified.
- Optional device draft: IndexedDB retains one project JSON, never PDF bytes. Opt-out removes only our draft. Save errors must be visible; restored drafts require the matching PDF.
- CLI: run the same engine in CI, returning nonzero for candidate failures or unresolved checks.

## Constraints
- No account, backend, AI API, telemetry, or document upload.
- Never insert extraction HTML into the DOM. Parse it as data.
- Checks require a human-confirmed expected value and source evidence rectangle.
- Distinguish failure from ambiguity/unsupported input. Never silently pass unresolved cases.
- Be explicit about supported formats, table selection and normalization.
- Changing source documents invalidates existing evidence. Require exact source hash match.
- Demo is synthetic, clearly labelled; no marketing accuracy claims.
- Reuse maintained parsers and PDF rendering dependencies where appropriate; do not implement PDF rendering or OCR.

## Quality and tests
- Engine tests cover wrong-column values, missing values, duplicate labels, numeric precision, escaped pipes, HTML spans, regressions and unresolved gating.
- Typecheck and production build must pass.
- Exercise the demo and the import/export path in a browser when available.
- Accessible form labels, keyboard controls, visible focus, responsive layout, and empty/error states are required.
- Keep specifications and README consistent with final behavior.

## Deployment
Use relative asset paths for GitHub Pages project sites. Deploy only built dist through the reviewed Pages workflow after tests/build. Verify the actual public URL, including demo PDF and worker. Never stage files outside this isolated repository.
