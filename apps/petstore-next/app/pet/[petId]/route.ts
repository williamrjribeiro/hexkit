import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/adapters/http-next/controllers";
import { getRuntime } from "@/adapters/http-next/runtime";
import {
  extractCredentials,
  handleControllerError,
  handleControllerResult,
  toApicalRequest,
} from "@/adapters/http-next/helpers";

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
) {
  const params = await ctx.params;
  const runtime = getRuntime();
  try {
    const apicalRequest = await toApicalRequest(request, params, { jsonBody: false });
    const result = await runtime.controllers.deletePet(apicalRequest);
    return handleControllerResult(result);
  } catch (error) {
    return handleControllerError(error);
  }
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
) {
  const params = await ctx.params;
  const runtime = getRuntime();
  try {
    const apicalRequest = await toApicalRequest(request, params, { jsonBody: false });
    const credentials = extractCredentials(request.headers, { schemes: [{ name: "api_key", type: "apiKey", headerName: "api_key" }] });
    if (credentials === undefined) {
      throw new AuthenticationError("credentials-missing");
    }
    const principal = await runtime.authenticator.authenticate(credentials);
    if (principal === null) {
      throw new AuthenticationError("principal-missing");
    }
    const result = await runtime.controllers.getPetById(apicalRequest, principal);
    return handleControllerResult(result);
  } catch (error) {
    return handleControllerError(error);
  }
}
