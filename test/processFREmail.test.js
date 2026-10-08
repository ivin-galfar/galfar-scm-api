import test from "node:test";
import assert from "node:assert/strict";
import {
  buildInithIntimationEmail,
  shouldSendInithIntimation,
} from "../EmailAlerts/ProcessFREmail.js";

test("inith intimation applies after PM approval for standard and special project queues", () => {
  assert.equal(
    shouldSendInithIntimation({ role: "pm", status: "pending for hod" }),
    true,
  );
  assert.equal(
    shouldSendInithIntimation({ role: ["pm"], status: "pending for pd" }),
    true,
  );
});

test("inith intimation does not apply to other workflow transitions", () => {
  assert.equal(
    shouldSendInithIntimation({ role: "cm", status: "pending for pm" }),
    false,
  );
  assert.equal(
    shouldSendInithIntimation({ role: "pd", status: "pending for hod" }),
    false,
  );
  assert.equal(
    shouldSendInithIntimation({ role: "pm", status: "approved" }),
    false,
  );
});

test("inith intimation identifies the next queue and escapes document fields", () => {
  const email = buildInithIntimationEmail({
    recipients: ["initiator@example.com"],
    doc_id: "FR-<123>",
    project: "7102",
    location: "Site & Yard",
    created_at: "2026-10-07T00:00:00.000Z",
    nextRole: "pd",
    requestUrl: "https://example.com/fleetrequest/123",
  });

  assert.deepEqual(email.to, ["initiator@example.com"]);
  assert.match(email.subject, /PM Approved the document/);
  assert.match(email.html, /approved by PM and is now in the PD queue/);
  assert.match(email.html, /FR-&lt;123&gt;/);
  assert.match(email.html, /Site &amp; Yard/);
  assert.match(email.html, /https:\/\/example\.com\/fleetrequest\/123/);
});
