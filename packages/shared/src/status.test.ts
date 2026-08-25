import { describe, expect, it } from "vite-plus/test";

import { isSuccessStatus } from "./status.ts";

describe("Given an OpenAPI response status string", () => {
  it.each([
    { status: "200", expected: true, reason: "OK is success" },
    { status: "201", expected: true, reason: "Created is success" },
    { status: "204", expected: true, reason: "No Content is success" },
    { status: "299", expected: true, reason: "the last 2xx code is success" },
    { status: "100", expected: false, reason: "informational codes are not success" },
    { status: "301", expected: false, reason: "redirects are not success" },
    { status: "404", expected: false, reason: "client errors are not success" },
    { status: "500", expected: false, reason: "server errors are not success" },
    { status: "default", expected: false, reason: "OpenAPI default is not a 2xx code" },
    { status: "20", expected: false, reason: "short strings are not three-digit codes" },
    { status: "2000", expected: false, reason: "longer strings are not three-digit codes" },
    { status: "2xx", expected: false, reason: "range tokens are not numeric codes" },
    { status: "", expected: false, reason: "empty strings are not success" },
  ] as const)("when the status is $status, then $reason", ({ status, expected }) => {
    expect(isSuccessStatus(status)).toBe(expected);
  });
});
