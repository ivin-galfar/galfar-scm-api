import assert from "node:assert/strict";
import test from "node:test";
import {
  hasInvalidFitmentSelection,
  normalizeFleetRequestItems,
} from "../Utils/fleetRequestValidateItems.js";

test("accepts create and update Fleet Request fitment field shapes", () => {
  assert.equal(
    hasInvalidFitmentSelection([
      { adnoc_fitments: "yes", tpi: "normal" },
      { adnocFitments: "NO", tpi: "CP - 19" },
    ]),
    false,
  );
});

test("rejects missing or unsupported Fleet Request fitment selections", () => {
  assert.equal(hasInvalidFitmentSelection([{ tpi: "normal" }]), true);
  assert.equal(
    hasInvalidFitmentSelection([{ adnocFitments: "yes", tpi: "pending" }]),
    true,
  );
  assert.equal(
    hasInvalidFitmentSelection([{ adnocFitments: "yes", tpi: "yes" }]),
    true,
  );
});

test("persists Fleet Request TPI selections with canonical labels", () => {
  assert.deepEqual(
    normalizeFleetRequestItems([
      { tpi: "normal" },
      { tpi: "cp - 19" },
    ]).map((item) => item.tpi),
    ["Normal", "CP - 19"],
  );
});
