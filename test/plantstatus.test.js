import test from "node:test";
import assert from "node:assert/strict";
import { statusExpected } from "../helpers/plantstatus.js";

test("statusExpected reads normal projects from NORMAL_PROJECTS", () => {
  const previousNormalProjects = process.env.NORMAL_PROJECTS;
  process.env.NORMAL_PROJECTS = " 101, 202 ";

  try {
    assert.equal(
      statusExpected(["cm"], "approve", "fn", "FWA", 202, false),
      "pending for gm",
    );
    assert.equal(
      statusExpected(["cm"], "approve", "fn", "FWA", "303", false),
      "pending for pm",
    );
  } finally {
    if (previousNormalProjects === undefined) {
      delete process.env.NORMAL_PROJECTS;
    } else {
      process.env.NORMAL_PROJECTS = previousNormalProjects;
    }
  }
});
