import { normalize, type Contract, type Table } from "./engine";
export function cellProposal(
  table: Table,
  tableIndex: number,
  headerRow: number,
  rowIndex: number,
  columnIndex: number,
): Partial<Contract> | null {
  const headers = table.rows[headerRow];
  if (table.issue || !headers || rowIndex <= headerRow || columnIndex === 0)
    return null;
  const row = table.rows[rowIndex];
  const rowColumn = headers[0],
    valueColumn = headers[columnIndex];
  if (
    !row ||
    !normalize(row[0] ?? "") ||
    !normalize(row[columnIndex] ?? "") ||
    !rowColumn ||
    !valueColumn
  )
    return null;
  if (
    [rowColumn, valueColumn].some(
      (name) =>
        headers.filter((h) => normalize(h) === normalize(name)).length !== 1,
    )
  )
    return null;
  if (
    table.rows
      .slice(headerRow + 1)
      .filter((r) => normalize(r[0] ?? "") === normalize(row[0])).length !== 1
  )
    return null;
  return {
    tableIndex,
    headerRow,
    rowColumn,
    rowLabel: row[0],
    valueColumn,
    expected: row[columnIndex],
  };
}
