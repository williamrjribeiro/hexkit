import { RequestValidationError } from "./controllers.ts";
import type { NextRequest } from "next/server";

type ApicalRequest = {
  query: unknown;
  path: unknown;
  headers: unknown;
  body?: unknown;
  contentType?: "application/json";
};

function toApicalHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key.toLowerCase()] = value;
  });
  return result;
}

export async function toApicalRequest(
  request: NextRequest,
  params: Record<string, string>,
  options: { jsonBody: boolean },
): Promise<ApicalRequest> {
  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const baseRequest: ApicalRequest = {
    query,
    path: params,
    headers: toApicalHeaders(request.headers),
  };

  if (!options.jsonBody) return baseRequest;

  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim();
  if (contentType !== "application/json") {
    throw new RequestValidationError("body-error");
  }

  try {
    return {
      ...baseRequest,
      body: await request.json(),
      contentType: "application/json",
    };
  } catch {
    throw new RequestValidationError("body-error");
  }
}

export function handleControllerResult(result: {
  status: string;
  contentType?: "application/json";
  data?: unknown;
}): Response {
  const status = Number(result.status);
  if (result.data === undefined) return new Response(null, { status });
  return Response.json(result.data, {
    status,
    headers: { "content-type": result.contentType ?? "application/json" },
  });
}

export function handleControllerError(error: unknown): Response {
  if (error instanceof RequestValidationError) {
    return Response.json({ error: "Bad Request" }, { status: 400 });
  }
  return Response.json({ error: "Internal Server Error" }, { status: 500 });
}
