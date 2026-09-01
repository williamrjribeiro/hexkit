import type { NextRequest } from "next/server";
import { getRuntime } from "@/adapters/http-next/runtime";
import {
  handleControllerError,
  handleControllerResult,
  toApicalRequest,
} from "@/adapters/http-next/helpers";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
) {
  const params = await ctx.params;
  const runtime = getRuntime();
  try {
    const apicalRequest = await toApicalRequest(request, params, { jsonBody: true, arrayQueryKeys: [] });
    const result = await runtime.controllers.addPet(apicalRequest);
    return handleControllerResult(result);
  } catch (error) {
    return handleControllerError(error);
  }
}

export async function PUT(
  request: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
) {
  const params = await ctx.params;
  const runtime = getRuntime();
  try {
    const apicalRequest = await toApicalRequest(request, params, { jsonBody: true, arrayQueryKeys: [] });
    const result = await runtime.controllers.updatePet(apicalRequest);
    return handleControllerResult(result);
  } catch (error) {
    return handleControllerError(error);
  }
}
