import type { NextRequest } from "next/server";
import { getRuntime } from "@/adapters/http-next/runtime";
import {
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
    const apicalRequest = await toApicalRequest(request, params, { jsonBody: false, arrayQueryKeys: [] });
    const result = await runtime.controllers.deleteUser(apicalRequest);
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
    const apicalRequest = await toApicalRequest(request, params, { jsonBody: false, arrayQueryKeys: [] });
    const result = await runtime.controllers.getUserByName(apicalRequest);
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
    const result = await runtime.controllers.updateUser(apicalRequest);
    return handleControllerResult(result);
  } catch (error) {
    return handleControllerError(error);
  }
}
