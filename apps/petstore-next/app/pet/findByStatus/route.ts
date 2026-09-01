import type { NextRequest } from "next/server";
import { getRuntime } from "@/adapters/http-next/runtime";
import {
  handleControllerError,
  handleControllerResult,
  toApicalRequest,
} from "@/adapters/http-next/helpers";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
) {
  const params = await ctx.params;
  const runtime = getRuntime();
  try {
    const apicalRequest = await toApicalRequest(request, params, { jsonBody: false, arrayQueryKeys: ["status"] });
    const result = await runtime.controllers.findPetsByStatus(apicalRequest);
    return handleControllerResult(result);
  } catch (error) {
    return handleControllerError(error);
  }
}
