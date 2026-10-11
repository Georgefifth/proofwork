import { parseFragment, type DefaultTreeAdapterMap } from 'parse5';

export type Format = 'markdown' | 'html';
export type Rect = { x: number; y: number; width: number; height: number };
export type Evidence = { page: number; rect: Rect; sourceHash: string };
export type Contract = {
  id: string;
  title: string;
  tableIndex: number;
  headerRow: number;
  rowColumn: string;
  rowLabel: string;
  valueColumn: string;
  expected: string;
  evidence: Evidence;
};
export type Extraction = { name: string; format: Format; text: string };
export type Project = {
  version: 1;
  name: string;
  source: { name: string; hash: string; pages: number };
  baseline: Extraction;
  candidate: Extraction;
  contracts: Contract[];
};
export type Table = { rows: string[][]; issue?: string; caption?: string };
export type Outcome = { status: 'pass' | 'fail' | 'ambiguous' | 'unsupported'; actual?: string; reason: string };
export type Comparison = { contract: Contract; baseline: Outcome; candidate: Outcome; change: 'regression' | 'existing-failure' | 'improvement' | 'unchanged' | 'review' };

export const normalize = (value: string) => value.normalize('NFC').replace(/\s+/gu, ' ').trim();

type PNode = DefaultTreeAdapterMap['node'];
const children = (node: PNode): PNode[] => 'childNodes' in node ? node.childNodes : [];
const tag = (node: PNode) => 'tagName' in node ? node.tagName : '';
function nodeText(node: PNode): string {
  if (['script', 'style', 'template'].includes(tag(node))) return '';
  if ('value' in node) return node.value;
  if (tag(node) === 'br') return ' ';
  return children(node).map(nodeText).join('');
}

function displayCell(value: string): string {
  // Strip basic inline Markdown decoration; HTML is parsed strictly as data.
  const text = value.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1');
  return normalize(nodeText(parseFragment(text)));
}

function splitPipe(line: string): string[] {
  let value = line.trim();
  if (value.startsWith('|')) value = value.slice(1);
  const trailingSlashes = value.endsWith('|') ? (value.slice(0, -1).match(/\\+$/)?.[0].length ?? 0) : 0;
  if (value.endsWith('|') && trailingSlashes % 2 === 0) value = value.slice(0, -1);
  const cells: string[] = [];
  let current = '';
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '\\' && ['|', '\\'].includes(value[i + 1])) { current += value[i + 1]; i++; }
    else if (value[i] === '|') { cells.push(current.trim()); current = ''; }
    else current += value[i];
  }
  cells.push(current.trim());
  return cells;
}

function markdownTables(text: string): Table[] {
  const lines = text.split(/\r?\n/);
  const tables: Table[] = [];
  let fence: { marker: string; length: number } | null = null;
  for (let i = 0; i < lines.length - 1; i++) {
    const match = lines[i].trim().match(/^(`{3,}|~{3,})/);
    if (fence) {
      if (match && match[1][0] === fence.marker && match[1].length >= fence.length && lines[i].trim() === match[1]) fence = null;
      continue;
    }
    if (match) { fence = { marker: match[1][0], length: match[1].length }; continue; }
    if (!lines[i].includes('|')) continue;
    const separator = splitPipe(lines[i + 1]);
    // GFM allows one or more hyphens, including Docling's single-hyphen exports.
    if (separator.length < 2 || !separator.every(cell => /^:?-+:?$/.test(cell))) continue;
    const rows = [splitPipe(lines[i]).map(displayCell)];
    i += 2;
    while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
      rows.push(splitPipe(lines[i]).map(displayCell)); i++;
      if (rows.length > 2000) return [{ rows: [], issue: 'A table exceeds the 2,000-row limit. Split the output into smaller review sets.' }];
    }
    i--;
    const issue = rows.some(row => row.length !== rows[0].length) ? 'Inconsistent column counts. Correct the table before checking it.' : undefined;
    tables.push({ rows, issue });
  }
  return tables;
}

function htmlTables(text: string): Table[] {
  const tables: Table[] = [];
  const visit = (node: PNode) => {
    if (tag(node) === 'table') { tables.push(readTable(node)); return; }
    children(node).forEach(visit);
  };
  visit(parseFragment(text));
  return tables;
}

function readTable(node: PNode): Table {
  const rawRows: PNode[] = [];
  let nested = false;
  let caption = '';
  const walk = (item: PNode) => {
    if (item !== node && tag(item) === 'table') { nested = true; return; }
    if (tag(item) === 'caption') caption = normalize(nodeText(item));
    if (tag(item) === 'tr') rawRows.push(item);
    children(item).forEach(walk);
  };
  walk(node);
  if (nested) return { rows: [], issue: 'Nested HTML tables require review; they are not supported in this version.' };
  if (rawRows.length > 2000) return { rows: [], issue: 'A table exceeds the 2,000-row limit. Split the output into smaller review sets.' };
  const grid: string[][] = [];
  let issue: string | undefined;
  rawRows.forEach((row, r) => {
    grid[r] ??= [];
    let c = 0;
    for (const cell of children(row).filter(n => ['td', 'th'].includes(tag(n)))) {
      while (grid[r][c] !== undefined) c++;
      const attrs = 'attrs' in cell ? cell.attrs : [];
      const span = (name: string) => {
        const raw = attrs.find(a => a.name === name)?.value ?? '1';
        if (!/^\d+$/.test(raw)) return NaN;
        return Number(raw);
      };
      const rs = span('rowspan'), cs = span('colspan');
      if (!Number.isInteger(rs) || !Number.isInteger(cs) || rs < 1 || cs < 1 || rs > 100 || cs > 100 || r + rs > rawRows.length || c + cs > 500) {
        issue = 'Invalid or oversized HTML cell span. This table cannot be checked safely.'; return;
      }
      const value = normalize(nodeText(cell));
      for (let y = r; y < r + rs; y++) {
        grid[y] ??= [];
        for (let x = c; x < c + cs; x++) {
          if (grid[y][x] !== undefined) issue = 'Overlapping HTML cell spans require review.';
          grid[y][x] = value;
        }
      }
      c += cs;
    }
  });
  const width = Math.max(0, ...grid.map(row => row.length));
  if (!width || grid.some(row => row.length !== width || Array.from({ length: width }, (_, i) => row[i]).some(v => v === undefined))) {
    issue ??= 'Incomplete table grid. Missing cells must be represented explicitly.';
  }
  return { rows: grid, issue, caption };
}

export function parseTables(extraction: Extraction): Table[] {
  if (extraction.text.length > 5_000_000) return [{ rows: [], issue: 'Extraction exceeds the 5 MB text limit.' }];
  const tables = extraction.format === 'html' ? htmlTables(extraction.text) : markdownTables(extraction.text);
  return tables.length > 100 ? [{ rows: [], issue: 'Extraction exceeds the 100-table limit. Split it into smaller review sets.' }] : tables;
}

export function checkContract(contract: Contract, tables: Table[], sourceHash: string): Outcome {
  if (contract.evidence.sourceHash !== sourceHash) return { status: 'unsupported', reason: 'Evidence belongs to a different source PDF.' };
  if (tables.length === 1 && tables[0].issue && !tables[0].rows.length) return { status: 'unsupported', reason: tables[0].issue };
  const table = tables[contract.tableIndex];
  if (!table) return { status: 'fail', reason: `Table ${contract.tableIndex + 1} is missing.` };
  if (table.issue) return { status: 'unsupported', reason: table.issue };
  const headers = table.rows[contract.headerRow];
  if (!headers) return { status: 'fail', reason: 'The selected header row is missing.' };
  const findColumns = (label: string) => headers.flatMap((h, index) => normalize(h) === normalize(label) ? [index] : []);
  const labelColumns = findColumns(contract.rowColumn), valueColumns = findColumns(contract.valueColumn);
  if (labelColumns.length > 1 || valueColumns.length > 1) return { status: 'ambiguous', reason: 'A selected header occurs more than once. Choose an unambiguous header row.' };
  if (!labelColumns.length || !valueColumns.length) return { status: 'fail', reason: `Required column is missing: ${!labelColumns.length ? contract.rowColumn : contract.valueColumn}.` };
  const matches = table.rows.slice(contract.headerRow + 1).filter(row => normalize(row[labelColumns[0]] ?? '') === normalize(contract.rowLabel));
  if (!matches.length) return { status: 'fail', reason: `Row “${contract.rowLabel}” is missing.` };
  if (matches.length > 1) return { status: 'ambiguous', reason: `Row “${contract.rowLabel}” appears ${matches.length} times. This check cannot identify one value.` };
  const actual = matches[0][valueColumns[0]];
  if (actual === undefined) return { status: 'unsupported', reason: 'The target cell is not represented in the table grid.' };
  return normalize(actual) === normalize(contract.expected)
    ? { status: 'pass', actual, reason: 'Row, column and value match.' }
    : { status: 'fail', actual, reason: 'The value at this row and column differs from the verified source.' };
}

export function compareProject(project: Project): Comparison[] {
  const baseline = parseTables(project.baseline), candidate = parseTables(project.candidate);
  return project.contracts.map(contract => {
    const a = checkContract(contract, baseline, project.source.hash), b = checkContract(contract, candidate, project.source.hash);
    const unresolved = [a, b].some(x => x.status === 'ambiguous' || x.status === 'unsupported');
    const change = unresolved ? 'review' : a.status === 'pass' && b.status === 'fail' ? 'regression'
      : a.status === 'fail' && b.status === 'pass' ? 'improvement' : b.status === 'fail' ? 'existing-failure' : 'unchanged';
    return { contract, baseline: a, candidate: b, change };
  });
}

export function validateProject(value: unknown): Project {
  const fail = () => { throw new Error('Invalid project. Import a version 1 Proofwork project with valid source evidence and table checks.'); };
  if (!value || typeof value !== 'object') return fail();
  const p = value as Project;
  const string = (v: unknown, max = 1000) => typeof v === 'string' && v.length <= max;
  const hash = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
  const integer = (v: unknown, min = 0, max = 100_000) => Number.isInteger(v) && Number(v) >= min && Number(v) <= max;
  const extraction = (v: Extraction) => v && string(v.name) && ['markdown', 'html'].includes(v.format) && string(v.text, 5_000_000);
  if (p.version !== 1 || !string(p.name) || !p.source || !string(p.source.name) || !hash(p.source.hash) || !integer(p.source.pages, 1, 10_000)
    || !extraction(p.baseline) || !extraction(p.candidate) || !Array.isArray(p.contracts) || p.contracts.length > 1000) return fail();
  const ids = new Set<string>();
  for (const c of p.contracts) {
    if (!c || !string(c.id) || !c.id || ids.has(c.id) || !string(c.title) || !c.title.trim() || !integer(c.tableIndex) || !integer(c.headerRow)
      || ![c.rowColumn, c.rowLabel, c.valueColumn, c.expected].every(v => string(v) && normalize(v).length > 0)
      || !c.evidence || !integer(c.evidence.page, 1, p.source.pages) || !hash(c.evidence.sourceHash) || c.evidence.sourceHash !== p.source.hash) return fail();
    const r = c.evidence.rect;
    if (!r || ![r.x, r.y, r.width, r.height].every(n => typeof n === 'number' && Number.isFinite(n))
      || r.x < 0 || r.y < 0 || r.width <= 0 || r.height <= 0 || r.x + r.width > 1.000001 || r.y + r.height > 1.000001) return fail();
    ids.add(c.id);
  }
  // Return only known fields: imported JSON is untrusted, never a spread into application state.
  return {
    version: 1, name: p.name, source: { name: p.source.name, hash: p.source.hash, pages: p.source.pages },
    baseline: { name: p.baseline.name, format: p.baseline.format, text: p.baseline.text },
    candidate: { name: p.candidate.name, format: p.candidate.format, text: p.candidate.text },
    contracts: p.contracts.map(c => ({ id: c.id, title: c.title, tableIndex: c.tableIndex, headerRow: c.headerRow, rowColumn: c.rowColumn,
      rowLabel: c.rowLabel, valueColumn: c.valueColumn, expected: c.expected,
      evidence: { page: c.evidence.page, sourceHash: c.evidence.sourceHash, rect: { x: c.evidence.rect.x, y: c.evidence.rect.y, width: c.evidence.rect.width, height: c.evidence.rect.height } } }))
  };
}
