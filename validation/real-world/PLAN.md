# Pre-registered real-world validation v1

Frozen before product execution. Target: source-linked exact table regression checking, not OCR/extraction accuracy. Original upstream outputs remain byte-for-byte unchanged in natural-input tests. No document is removed because it proves unsupported or hard. Download failures stay in the manifest. SHA-256 provenance is recorded.

Corpus, selected by document type/known difficulty before results:
- Docling pinned corpus: 2203.01017v2, 2206.01062, 2305.03393v1, amt_handbook_sample, redp5110_sampled, elsevier-00, table_misidentified_as_form, table_mislabeled_as_picture.
- olmOCR pinned sample corpus: earnings, discoverworld_crazy_table4, mathfuncs, lincoln_letter, small_page_size, multi_column_miss.
- US Census 2012 Statistical Abstract entire edition: large-document boundary.
- Synthetic/derived fault supplements remain a separate stratum: wrong target value/column, missing row, duplicate labels/headers, reordered tables, truncated original PDF, script markup, explicitly oversized input.

Independent references: inspect original PDF page images and source annotations before running the product. Docling snapshots are regression outputs, not infallible truth. olmOCR JSONL labels are upstream human-reviewed relationship tests, still subject to source-page verification. For fields without verified evidence record unknown, not pass. Input outputs and oracle answers use separate directories; mutation records are not supplied to the application. Product expected-value contracts are its normal user input, not hidden benchmark answers.

Tests:
1. Import/render each available PDF through deployed Firefox app, assert actual page canvas and navigate to last page; collect load/render duration, browser errors and screenshot. No assumption that rendering means extraction capability.
2. Inventory unmodified upstream Markdown tables with an independent parser and upstream JSON table cells. Select at least one source-verified fact per tabular document, targeting complex headers as well as simple facts; preserve hard/unaddressable examples.
3. Run original output and review the selected fact using the CLI, then public browser authoring for representative simple, complex and ambiguous documents. Score a correct fact separately from a safe unresolved result. PDF binding and export roundtrip are verified through normal UI.
4. For addressable source-verified facts, use deterministic separately marked mutations, proving wrong values/omissions cannot pass; unchanged and column-reordered controls must not create false failures. Whole-table reorder is a documented unsupported workflow, scored as limitation rather than extraction error.
5. Compare the same fact tasks to existing maintained olmOCR TableTest where practical, and a naive text-presence baseline only as an intentionally weak reference. Do not compare OCR extractors as if they perform this workbench's same task.

Fixed scoring:
- Source loading success: valid available in-limit PDFs render and navigation works; unavailable downloads are Blocked, invalid/oversized source rejection is expected.
- Addressable fact correctness: observed source-verified unchanged facts must pass; intentional changed target/missing row must not pass; precision/sign/unit changes must not pass. False pass is a core correctness failure.
- Unresolved/unsupported cases count as safe gate rejections, but never as successful fact verification or extraction accuracy. Report them separately in workflow coverage.
- Natural workflow usefulness target: >=80% of selected verified tabular documents can author and correctly check at least one intended fact without rewriting upstream output, including complex examples. Correctness threshold: zero false passes and zero false failures on in-scope unchanged facts; safe recovery on malformed inputs.
- Final PASS requires all correctness thresholds and usefulness target; PARTIAL means correct supported tasks with meaningful workflow coverage limitations; FAIL means unsafe false passes or core in-scope failure; INCONCLUSIVE means no sufficient verified reference set.

Holdout: reserve Docling 2305.03393v1 and olmOCR small_page_size as independent final check documents; do not inspect their product results until after any development fixes. Their source references may be inspected to set an oracle. If fixes use their failures, disclose loss of holdout status and do not call retest independent.

Performance: record wall time and peak RSS for isolated CLI processes; browser source load/render timing and process RSS have separate definitions. No aggregate extractor accuracy, commercial superiority, satisfaction or full-benchmark score will be claimed from a small purposive sample. Public copyrighted PDFs and raw upstream outputs are not redistributed in Git; retain download URLs and checksums.
