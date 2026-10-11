# MVP validation record

Validated on 2026-10-11. This records implementation checks, not a user study or production accuracy benchmark.

## Automated checks

- `npm test`: 18 passing tests, including actual CLI subprocess exit codes.
- `npm run build`: TypeScript check and Vite production build pass. Application, React, HTML parsing and PDF rendering are split into separate bundles.
- Dependency installation audit reported zero known vulnerabilities for the resolved lockfile.
- Synthetic fixture: baseline passes all three contracts; candidate swaps Atlas prices, omits Cove, and preserves Reed. Result: two regressions and one unchanged pass.
- Empty suites, malformed projects and source mismatches cannot produce a passing CLI gate.
- Duplicate row/header labels, unsupported structures and oversized review sets do not silently pass.

## Browser checks

- PDF rendering and normalized evidence overlay on the source.
- New test created through keyboard-entered evidence bounds, row/column selectors, expected value and explicit human confirmation; saved test participates in comparison.
- Candidate replaced with the correct baseline: all three candidate checks pass.
- Export dialog exposes complete portable project JSON. Its visible JSON was saved as a QA fixture, opened through the project file chooser, and the matching PDF was attached.
- The actual browser-exported JSON was run through the CLI with the source PDF: two regressions, one pass, expected exit code 1.
- Mobile layout at 390 × 844 requested viewport: document content fits available width; project creation/open/export/help remain available in a mobile menu. Viewport override reset afterwards.
- Final desktop source/results view captured in `preview.jpg`.

The in-app browser download-event capture did not complete, so download-manager behavior is not claimed as verified. The copyable JSON export path and file import were verified. Source files were synthetic and created within this new project; no existing local project was inspected.

## Product limits

The current product verifies saved table facts, not all document content. It has optional device draft storage, but no semantic table matching, cross-page table reconciliation, or OCR. Export for portable backups. Usability gains and adoption remain to be measured with real users.

## Improvement release (2026-10-11)

20 automated tests now pass. Production build and GitHub Pages deployment passed, and the actual public version was exercised. See [IMPROVEMENTS.md](IMPROVEMENTS.md) for current workflow measurements, browser checks, and limits; earlier observations above describe the initial MVP. Download-manager delivery remains unverified, while copyable project JSON and CLI interoperability passed.
