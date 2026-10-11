# Proofwork

A local PDF extraction regression workbench. Confirm a table fact in the original PDF, save its source evidence, and check it against baseline and candidate extraction outputs.

Try the [live workspace](https://georgefifth.github.io/proofwork/), or browse the [repository](https://github.com/Georgefifth/proofwork). All document processing stays in your browser.

## Run

Requires Node 22 or newer.

```sh
npm install
npm run dev
```

Open the URL printed by Vite. The initial workspace is a clearly labelled synthetic demo: two deliberate regressions and one passing control. Use **New project** to attach your own files.

## Workflow

1. Attach the source PDF (maximum 50 MB).
2. In **Extraction outputs**, upload/paste baseline and candidate Markdown or HTML.
3. In **Source & checks**, create a check. Drag an evidence rectangle on the PDF, or use keyboard-entered percentage bounds. Choose table/header row, row-label column, row label, value column, and expected value.
4. Confirm the value against the PDF, then save and **Run comparison**.
5. Review each failure alongside its original source. Use **Export project** for a portable backup, or opt into **Keep a draft on this device**. Device drafts retain extraction text/checks but no PDF bytes; reattach the same PDF after reload. Storage failures are shown explicitly.

Project JSON contains extraction text, tests, source fingerprint and evidence coordinates. It excludes PDF bytes. Reopen a project and attach the exact original PDF; a different fingerprint is rejected while tests exist. Do not treat an exported project as safe to share if its extraction text is private.

## CI / terminal

```sh
npm run check -- proofwork-project.json --candidate next-output.md --pdf source.pdf
npm run check -- proofwork-project.json --candidate next-output.html --json
```

Optional `--baseline` replaces the baseline. `.html` / `.htm` files are parsed as HTML; other output files as Markdown. `--pdf` verifies the source fingerprint. Without it, the CLI trusts the reviewed source metadata in the project; it cannot verify that an arbitrary output came from that PDF.

Exit codes: **0** all candidate checks passed; **1** candidate failure/ambiguity/unsupported check; **2** invalid project, empty suite, missing file or source mismatch. Only candidate checks gate CI; unresolved baseline checks remain labelled **Needs review** in comparisons.

## Boundaries

- Exact comparison after whitespace and Unicode NFC normalization. Numbers, punctuation, signs and units are preserved.
- Markdown: pipe tables with separator rows, escaped pipes and basic inline decoration. Tables in fenced code are ignored. HTML embedded in Markdown is not treated as an HTML table; select HTML format instead.
- HTML: `table`, `tr`, `td`, `th`, spans and entities are parsed as data using parse5. Nested tables, invalid spans and incomplete grids need review.
- Select a header row with unique names. Duplicate row labels or selected column headers are ambiguous, never silently passing.
- Table ordinal and header-row position are part of the contract. Table reordering requires review; this version has no semantic table matching.
- Review sets are limited to 5 MB extraction text, 100 tables and 2,000 rows per table. Oversized or unsupported sets block the gate.
- A check protects a saved fact, not all contents of an unseen document. No OCR, model training, LLM judge, or accessibility certification.
- Files stay on the device. The browser loads only this app and its locally served PDF.js worker/demo. There are no external fonts, telemetry, accounts or APIs.

## Verify

```sh
npm test
npm run build
```

The semantic tests cover column swaps despite unchanged text presence, missing rows, precision, duplicate labels, malformed data, source identity, portable projects and actual CLI exit codes.

See [PRODUCT.md](PRODUCT.md) for acceptance criteria and research, and [AGENTS.md](AGENTS.md) for architecture and development constraints. This is an original MVP in a new directory; no existing local project was inspected or reused.

## Improvements and deployment

See [competitive review and acceptance results](docs/IMPROVEMENTS.md) and [Pages deployment notes](docs/DEPLOYMENT.md). In check authoring, clicking a supported baseline cell proposes the row/column/value; source evidence and renewed confirmation are still mandatory. Existing checks can be edited without replacing their IDs.

## Firefox end-to-end acceptance

```sh
npx playwright install firefox
npm run dev -- --host 127.0.0.1
# In another terminal: tests the deployed site and localhost in fresh Firefox contexts
npm run test:e2e
# Or run only local acceptance
npm run test:e2e -- --project=local-firefox
```

The suite uses real file choosers, pointer evidence selection, keyboard controls, native downloads and clipboard paste. Business outcomes and unexpected browser/network errors are asserted. Network and clipboard failures are explicitly simulated to verify recovery. Reports, screenshots and failure traces are written under ignored `qa/artifacts/`. See [QA checklist](qa/CHECKLIST.md) and [acceptance report](qa/REPORT.md).

## Real-world validation

[External-data validation report](validation/real-world/REPORT.md): 13 real public PDFs plus 2 separately labelled external fixtures. Supported exact checks passed; native table workflows completed on 6/8 verified tabular documents, below the preregistered 80% target, so the product verdict is **PARTIAL**. The report preserves initial failures, an oracle erratum, independent holdouts, measured limits, official TableTest comparisons and machine-readable results. Docling single-hyphen GFM output is now accepted; source pages can be entered directly. Headerless or structurally damaged outputs still need review.
