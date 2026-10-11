import { mkdirSync, writeFileSync } from 'node:fs';

// A small original synthetic PDF fixture, written without a PDF/OCR service.
const text = (x, y, size, value) => `BT /F1 ${size} Tf ${x} ${y} Td (${value.replace(/[\\()]/g, '\\$&')}) Tj ET`;
const table = [
  '0.12 0.16 0.2 rg', text(54, 744, 25, 'NORTHSTAR'), text(54, 716, 12, 'Product catalogue / 2024'),
  '0.4 0.43 0.46 rg', text(54, 677, 10, 'SYNTHETIC DEMO - All names and prices are invented.'),
  '0.95 0.95 0.92 rg 54 567 504 45 re f', '0.12 0.16 0.2 rg',
  text(66, 586, 11, 'Product'), text(280, 586, 11, '2023 (USD)'), text(427, 586, 11, '2024 (USD)'),
  text(66, 542, 12, 'Atlas chair'), text(280, 542, 12, '119.00'), text(427, 542, 12, '125.60'),
  text(66, 498, 12, 'Cove desk'), text(280, 498, 12, '240.00'), text(427, 498, 12, '249.00'),
  text(66, 454, 12, 'Reed lamp'), text(280, 454, 12, '42.00'), text(427, 454, 12, '45.00'),
  '0.78 0.8 0.79 RG 0.7 w', ...[612, 567, 523, 479, 435].map(y => `54 ${y} m 558 ${y} l S`),
  text(54, 377, 11, 'Prices are per item, before tax. Currency: USD.'),
  text(54, 352, 11, 'Verify a value with its product name and year.'),
  '0.4 0.43 0.46 rg', text(54, 60, 10, 'Proofwork demonstration / 1 of 2')
].join('\n');
const notes = [
  '0.12 0.16 0.2 rg', text(54, 744, 25, 'Catalogue notes'), text(54, 698, 12, 'This PDF is a synthetic source for regression testing.'),
  text(54, 661, 12, 'The baseline transcribes the table on page 1 correctly.'),
  text(54, 636, 12, 'The candidate swaps the two Atlas prices and omits Cove.'),
  text(54, 611, 12, 'Reed remains correct and serves as a control.'),
  text(54, 560, 12, 'Three saved checks show two regressions and one pass.'),
  text(54, 535, 12, 'They demonstrate the workflow, not production accuracy.'),
  '0.4 0.43 0.46 rg', text(54, 60, 10, 'Proofwork demonstration / 2 of 2')
].join('\n');
const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  `<< /Length ${Buffer.byteLength(table)} >>\nstream\n${table}\nendstream`,
  `<< /Length ${Buffer.byteLength(notes)} >>\nstream\n${notes}\nendstream`
];
let pdf = '%PDF-1.4\n';
const offsets = [0];
objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('');
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
mkdirSync(new URL('../public/', import.meta.url), { recursive: true });
writeFileSync(new URL('../public/northstar-demo.pdf', import.meta.url), pdf);
