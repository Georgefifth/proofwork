import type { Project } from './engine';

export const baselineText = `# Northstar product catalogue\n\nSynthetic demonstration · values are invented.\n\n| Product | 2023 (USD) | 2024 (USD) |\n| --- | ---: | ---: |\n| Atlas chair | 119.00 | 125.60 |\n| Cove desk | 240.00 | 249.00 |\n| Reed lamp | 42.00 | 45.00 |`;

export const candidateText = `# Northstar product catalogue\n\nSynthetic demonstration · values are invented.\n\n| Product | 2023 (USD) | 2024 (USD) |\n| --- | ---: | ---: |\n| Atlas chair | 125.60 | 119.00 |\n| Reed lamp | 42.00 | 45.00 |`;

export function demoProject(hash: string): Project {
  const evidence = { page: 1, sourceHash: hash, rect: { x: 0.09, y: 0.21, width: 0.82, height: 0.22 } };
  return {
    version: 1, name: 'Northstar catalogue · synthetic demo', source: { name: 'northstar-demo.pdf', hash, pages: 2 },
    baseline: { name: 'baseline.md', format: 'markdown', text: baselineText },
    candidate: { name: 'candidate.md', format: 'markdown', text: candidateText },
    contracts: [
      { id: 'demo-atlas', title: 'Atlas chair keeps its 2024 price', tableIndex: 0, headerRow: 0, rowColumn: 'Product', rowLabel: 'Atlas chair', valueColumn: '2024 (USD)', expected: '125.60', evidence },
      { id: 'demo-cove', title: 'Cove desk is still present', tableIndex: 0, headerRow: 0, rowColumn: 'Product', rowLabel: 'Cove desk', valueColumn: '2024 (USD)', expected: '249.00', evidence },
      { id: 'demo-reed', title: 'Reed lamp retains its price', tableIndex: 0, headerRow: 0, rowColumn: 'Product', rowLabel: 'Reed lamp', valueColumn: '2024 (USD)', expected: '45.00', evidence }
    ]
  };
}
