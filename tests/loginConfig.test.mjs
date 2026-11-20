import test from "node:test";
import assert from "node:assert/strict";
import { hasValidCredentials, LOGIN_PASSWORD, LOGIN_USERNAME } from "../src/loginConfig.mjs";

test("configured username and password are accepted", () => {
  assert.equal(hasValidCredentials(LOGIN_USERNAME, LOGIN_PASSWORD), true);
});

test("incorrect credentials are rejected", () => {
  assert.equal(hasValidCredentials("wrong-user", LOGIN_PASSWORD), false);
  assert.equal(hasValidCredentials(LOGIN_USERNAME, "wrong-password"), false);
});
