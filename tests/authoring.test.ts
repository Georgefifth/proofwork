import test from "node:test";
import assert from "node:assert/strict";
import { cellProposal } from "../src/authoring";
import { checkContract } from "../src/engine";
test("cell proposal preserves semantic target and never invents source proof", () => {
  const table = {
    rows: [
      ["Product", "2023", "2024"],
      ["Atlas", "119.00", "125.60"],
    ],
  };
  const proposal = cellProposal(table, 0, 0, 1, 2)!;
  assert.deepEqual(proposal, {
    tableIndex: 0,
    headerRow: 0,
    rowColumn: "Product",
    rowLabel: "Atlas",
    valueColumn: "2024",
    expected: "125.60",
  });
  assert.equal("evidence" in proposal, false);
  const contract = {
    ...proposal,
    id: "a",
    title: "Price",
    evidence: {
      page: 1,
      sourceHash: "source",
      rect: { x: 0, y: 0, width: 1, height: 1 },
    },
  } as Parameters<typeof checkContract>[0];
  assert.equal(checkContract(contract, [table], "source").status, "pass");
  assert.equal(
    checkContract(
      contract,
      [{ rows: [table.rows[0], ["Atlas", "125.60", "119.00"]] }],
      "source",
    ).status,
    "fail",
  );
});
test("ambiguous, unsupported, header and label cells cannot become proposals", () => {
  assert.equal(
    cellProposal(
      {
        rows: [
          ["P", "V"],
          ["A", "1"],
          ["A", "2"],
        ],
      },
      0,
      0,
      1,
      1,
    ),
    null,
  );
  assert.equal(
    cellProposal(
      {
        rows: [
          ["P", "V", "V"],
          ["A", "1", "2"],
        ],
      },
      0,
      0,
      1,
      2,
    ),
    null,
  );
  assert.equal(
    cellProposal(
      {
        rows: [
          ["P", "V"],
          ["A", "1"],
        ],
        issue: "nested",
      },
      0,
      0,
      1,
      1,
    ),
    null,
  );
  assert.equal(
    cellProposal(
      {
        rows: [
          ["P", "V"],
          ["A", "1"],
        ],
      },
      0,
      0,
      0,
      1,
    ),
    null,
  );
  assert.equal(
    cellProposal(
      {
        rows: [
          ["P", "V"],
          ["A", "1"],
        ],
      },
      0,
      0,
      1,
      0,
    ),
    null,
  );
});
