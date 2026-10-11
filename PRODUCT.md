# Product specification — MVP

## User and job
A developer maintains a PDF extraction pipeline. Before shipping a parser/model/configuration change they want to know whether specific, previously reviewed table facts still hold. Today they compare files, inspect the PDF, and write/maintain assertions separately.

## Core workflow
1. Open a source PDF and add baseline and candidate extraction results (Markdown or HTML).
2. On a source page, mark a rectangle containing a table fact. Select the corresponding extracted table, row label and column header, then explicitly confirm the expected value against the PDF.
3. Run every saved check against both outputs. Review new regressions first, with source evidence, expected and actual values visible together.
4. Export a portable project. Reopen it with the matching PDF or run it with the CLI in CI.

## Scope
- Single PDF; page navigation, zoom, normalized rectangular evidence.
- Single-header-row Markdown tables, escaped pipes, optional row labels in any selected column.
- HTML tables parsed as data, with rowspan/colspan expansion. Header row is explicitly selected at contract creation. No script execution.
- Human chooses a table ordinal, header row, row-label column, row label and value column. Table ordinals are part of the contract; reordered tables require review.
- Exact values after Unicode NFC and whitespace normalization. Numeric punctuation, signs, units and decimal precision are preserved. No fuzzy matching and no automatic numeric conversion.
- Four check outcomes: pass, fail, ambiguous, unsupported. Only pass satisfies a gate.
- Baseline/candidate states: regression, existing failure, improvement, unchanged pass, needs review.
- Project JSON stores original text outputs and checks, not PDF bytes. PDF evidence is bound to SHA-256; mismatches cannot be approved or evaluated as source-verified.
- CLI can use exported outputs or replacement output files. It runs checks without needing PDF rendering. Source hash represents the human-reviewed source, not validation of arbitrary new PDFs.

## Acceptance criteria
- Synthetic demo contains a correct baseline and a candidate with a wrong year column, omitted product, and unchanged control. Saved checks classify those as two regressions and one pass.
- A repeated row label or header gives an ambiguous outcome; a malformed/unsupported table never becomes a pass.
- `125.60` does not equal `125.6`; `−125` does not equal `125`; spaces/newlines and Unicode composition do not create failures.
- Checks require source page/rectangle, reviewed source hash, expected value, and an explicit confirmation by the human.
- Project export/import preserves source identity, evidence, outputs and contracts. A mismatched PDF is clearly rejected without silently rebinding evidence.
- The CLI exits 0 only when every candidate check passes; it emits actionable expected/actual diagnostics otherwise.
- Files are handled locally. Extraction HTML is never rendered as executable markup.
- Demo and empty states explain what to do without requiring knowledge of the internal implementation.

## Validation plan
Verify correctness with semantic engine tests and the browser demo. Validate usability later with developers performing the same creation/review task using their current tools; measure time, missed regressions and unnecessary review. No user-study or willingness-to-pay claim is made by this implementation.

## Public research and existing solutions
- https://github.com/allenai/olmocr/blob/main/olmocr/bench/README.md — fact-based OCR tests; source review UI. This MVP follows the established exact-check approach but does not claim compatibility with its JSONL schema.
- https://github.com/run-llama/ParseBench — maintained evaluation and comparison framework. Full benchmark metrics are outside this MVP.
- https://github.com/scub-france/docling-Studio — visual inspection of Docling outputs.
- https://github.com/docling-project/docling/issues/1922 — historical omitted-table-content report, not a reproduced current-version failure.
- https://needl.ai/technical-notes/benchmarking-pdf-extraction-tools — human-verified references and reference-correction workflow.

The small pure engine is limited to explicit table contracts, allowing a shared browser/CLI runtime. Maintained parse5 handles HTML; PDF.js handles PDF rendering. This is workflow software, not a new OCR or benchmark algorithm.
