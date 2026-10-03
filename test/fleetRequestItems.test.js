import assert from "node:assert/strict";
import test from "node:test";
import { hasInvalidFitmentSelection } from "../Utils/fleetRequestItems.js";

test("accepts create and update Fleet Request fitment field shapes", () => {
  assert.equal(
    hasInvalidFitmentSelection([
      { adnoc_fitments: "yes", tpi: "normal" },
      { adnocFitments: "NO", tpi: "CPIS" },
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
