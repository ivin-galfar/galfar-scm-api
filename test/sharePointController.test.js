import assert from "node:assert/strict";
import test from "node:test";
import { respondWithMissingUserPhoto } from "../Controllers/sharePoint.js";

function createResponse() {
  return {
    headers: {},
    statusCode: null,
    body: undefined,
    set(headers) {
      Object.assign(this.headers, headers);
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };
}

test("missing user photo response is an empty successful response", () => {
  const response = createResponse();
  respondWithMissingUserPhoto(response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.ended, true);
  assert.equal(response.headers["Cache-Control"], "private, max-age=300");
});
