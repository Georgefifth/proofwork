# Competitive review and improvement plan

Reviewed 2026-10-11. Facts below are documented capabilities, not independently measured accuracy or market traction. No competitor latency ranking is warranted: their extraction and our regression check are different tasks.

## Competitors

| Product / source | Verified capability and workflow | Cost / constraint | Where it is better than Proofwork |
|---|---|---|---|
| [olmOCR-Bench](https://github.com/allenai/olmocr/blob/main/olmocr/bench/README.md) | Page facts; text presence/absence/order, table relationships and math; Python benchmark and human review app | Open-source framework; installation and data preparation, inference costs separate | Much broader assertions and established benchmark data; review/edit instead of rebuilding tests |
| [ParseBench](https://github.com/run-llama/ParseBench) | Five evaluation dimensions; CLI run → serve interactive report, compare pipelines, export results | Apache-2.0; Python environment; provider API fees depend on parser | Structural table metrics and multi-document/provider reporting |
| [Docling Studio](https://github.com/scub-france/docling-Studio) | Upload → configure extraction → PDF with boxes and synchronized page output; history and exports | MIT, self-hosted backend; local image ~1.9 GB and first model download ~400 MB (README figures) | Integrated extraction, history, resizable results, page synchronization |
| [Parsyn](https://parsyn.ai/) | Vendor documents editable validation rules, guided fixes, corrections as regression ground truth | Commercial; no public price on reviewed page; demo request | Complete operational correction/rollback workflow; claims not independently reproduced |
| [pdfmarkdown.app](https://pdfmarkdown.app/) | Public sample converter; side-by-side PDF/output and click-to-locate | Advertises free, no account and local processing; independent privacy/accuracy audit not performed | Easy entry and contextual inspection; actual public sample tried separately below |

[Docling issue #1922](https://github.com/docling-project/docling/issues/1922) reports a lost nested-table line. This is historical user evidence, not proof the latest version still has that bug. It supports looking for omissions instead of treating valid output syntax as completeness. Our nested-table behavior remains an explicit unsupported outcome.

## Product audit and priorities

| Priority | Problem | Change | Acceptance / risk |
|---|---|---|---|
| P0 | Project Pages path breaks demo fetch | Relative deployment base and BASE_URL asset fetch | Built app works under a project subpath, PDF worker and demo load |
| P1 | Closing tab loses source-reviewed checks | Optional device draft, explicit retained-text/no-PDF disclosure and visible save failures | Reload restores JSON; matching PDF must be reattached; opt-out removes our draft only |
| P1 | Correcting a check requires delete/recreate | Edit existing check; require renewed confirmation | Stable ID/count, invalidates comparison, cancellation leaves saved check intact |
| P1 | Re-enter row/column/value while looking elsewhere | Click a baseline cell in the authoring form to propose four fields | Proposal never counts as source proof; unique headers/row required; manual input retained |
| P2 | Hero and four statistic cards delay PDF | Compact workspace title and inline summary; stronger readable type/contrast | Measure source panel vertical position at same viewport; mobile no overflow |
| P2 | Destructive native confirmations block context | Accessible in-app replacement/delete dialog | Explicit target, cancel safe, export available before replacement |

No parser, AI, server, database or dashboard is added. The product remains a focused authoring/review layer over existing extraction pipelines. Multi-document suites and richer assertions remain competitors' advantages.

## Design pass 1

Palette: paper #ffffff, desk #eef1f5, ink #182638, annotation blue #2356b5, failure red #a52d36, verified green #226044. Neutral muted text #536174 and borders #ccd4df are supporting tokens. Use document-editor typography: Segoe UI for controls/body with platform fallback, Georgia for the product title, monospace only exact values and raw output. No network font dependency.

The visual idea is a blue margin annotation around source-linked work, with quiet document surfaces. Replace promotional headings with task names, remove redundant four-card stats, keep existing navigation and PDF engine. Align panel headings and table/form edges on an 8 px spacing rhythm. Controls at least 32 px high, form text 14–16 px, visible keyboard focus.

Before:
```
sidebar | breadcrumb
        | promotional title + action
        | demo banner
        | four statistic cards
        | PDF             | checks
```
After:
```
sidebar | task title + run
        | compact demo / save status
        | PDF             | failure queue / edit
        |                 | baseline-cell proposal
```

Review: retain the useful side-by-side evidence layout, discard generic dashboard chrome. The title uses serif sparingly; task controls remain legible sans-serif. Animation is unnecessary. Mobile stacks the same work, preserving project actions.

## Measurement policy

Steps count UI actions, excluding optional title, PDF page navigation and already chosen default table/header. Original manual creation after New check needs source-region selection + row column selection + row label entry + value column selection + expected value entry + confirmation + save = 7 actions. Proposed simple-cell route uses cell selection + source-region selection + confirmation + save = 4. This is a designed action-count reduction, not measured user-time or success-rate improvement. Complex headers or ambiguous rows need manual selection. Browser task results recorded after implementation.

## Public competitor experience

Opened pdfmarkdown.app and clicked “Try a sample” once. Its public 15-page research-paper sample reached a workspace with the original PDF, Markdown text, synchronized-scrolling option and preview toggle. This verifies entry and result presentation, not full extraction accuracy, privacy claims or sustained response speed. Polling occurred while other work ran, so the elapsed observation interval is not a conversion-time measurement. Other products were reviewed through official documentation/source; their self-hosted/authenticated workflows were not installed or benchmarked.

## Local acceptance results

- 20 automated tests passed; TypeScript check and production build passed. Tests preserve existing semantic/CLI gates and add correct-cell proposals, column-swap detection after proposal and refusal of ambiguous/unsupported proposals.
- Browser: editing the Atlas check retained `demo-atlas`, kept three checks, required renewed confirmation and invalidated old results. A new 2023-price check created by baseline cell selection plus keyboard evidence bounds produced a fourth check. Save was disabled until confirmation. Comparison returned three regressions and one passing control, as expected.
- Device draft: opt-in showed a completed-save status; reload restored all four checks and the edited title, without PDF. Reattaching the exact source restored comparison. Opt-out removed the saved draft; reload returned the original three-check synthetic demo.
- Delete cancellation preserved the project. Replacement/delete use a named in-app dialog; portable export remains available before replacement.
- At the same default desktop viewport (720 px high), initial synthetic-demo source panel document Y changed from 418.7 px to 278.1 px (140.6 px earlier). Counts are unchanged: two regressions, one passing control. This measures layout, not user speed or success.
- No user study or comparative extraction latency benchmark was run. The 7 → 4 pointer-action count applies to a simple supported table; keyboard region entry adds actions to both routes.

## Public-site acceptance

Published at https://georgefifth.github.io/proofwork/ and opened the actual HTTPS site. GitHub Actions run 38110907003 completed tests, production build and Pages deployment successfully (https://github.com/Georgefifth/proofwork/actions/runs/38110907003).

On that public version: sample PDF/worker rendered; original demo returned two regressions and one passing control. Editing required renewed confirmation and kept three checks. Cell-prefill plus keyboard evidence created a fourth check; device save/reload restored four checks and the edited name without PDF. Reattaching the original PDF returned three regressions/one control. Replacing candidate text with baseline text invalidated results and a fresh run passed all four checks. Copy JSON reported success; its visible exported JSON passed the local CLI with matching PDF (exit 0, four checks). New-project replacement used the in-app dialog.

A download-event capture for Download JSON timed out in the in-app browser. File delivery through its download manager remains unverified; JSON copy/export contents and CLI portability were verified. No claim is made that the download-manager interaction passed.

Responsive test used an actual 390 px CSS viewport (375 px client area after scrollbar); document scrollWidth equalled clientWidth, with no page-level horizontal overflow. The project menu remained available. Desktop source-panel measurement above uses the same original demo state; mobile numbers are not mixed into that comparison.

Remaining constraints: table ordinal must stay stable; complex/nested structures can need review; no cross-page table merging, batch suite or OCR; only one optional device draft per origin (multiple opted-in tabs can replace it). PDF reattachment is deliberate. Save completion must be visible before closing; portable JSON remains the backup. Real-user task time, error rate, willingness to adopt and comparative parser performance have not been measured.

Starting a new project while device saving was enabled showed “previous draft removed”; reloading returned the initial three-check demo, rather than resurrecting the old four-check draft. Verification test data was removed before leaving the public site open. Screenshots: preview-before.jpg records the earlier local layout; preview.jpg records the deployed review workspace. Browser console inspection during public checks reported no errors.
