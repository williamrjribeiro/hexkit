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
    const apicalRequest = await toApicalRequest(request, params, { jsonBody: false });
    const result = await runtime.controllers.deleteOrder(apicalRequest);
    return handleControllerResult(result);
  } catch (error) {
    return handleControllerError(error);
  }
}

export async function GET(request: NextRequest, ctx: { params: Promise<Record<string, string>> }) {
  const params = await ctx.params;
  const runtime = getRuntime();
  try {
    const apicalRequest = await toApicalRequest(request, params, { jsonBody: false });
    const result = await runtime.controllers.getOrderById(apicalRequest);
    return handleControllerResult(result);
  } catch (error) {
    return handleControllerError(error);
  }
}
