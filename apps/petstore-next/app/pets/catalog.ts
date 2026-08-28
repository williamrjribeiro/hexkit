import type { Pet } from "@/core/domain/pet";
import { getServerAccess } from "@/adapters/http-next/server-access";

const allStatuses = ["available", "pending", "sold"] as const;
export const catalogTagOptions = ["friendly", "quiet", "trained"] as const;

function normalizeMultiParam(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).map((entry) => entry.trim()).filter(Boolean);
}

export async function loadPetCatalog(searchParams: {
  status?: string | string[];
  tags?: string | string[];
}): Promise<Pet[]> {
  const access = getServerAccess();
  const tags = normalizeMultiParam(searchParams.tags);
  if (tags.length > 0) {
    return access.findPetsByTags(tags);
  }

  const statuses = normalizeMultiParam(searchParams.status);
  if (statuses.length > 0) {
    return access.findPetsByStatus(statuses as Array<(typeof allStatuses)[number]>);
  }

  return access.findPetsByStatus([...allStatuses]);
}

export function catalogRouteHint(searchParams: {
  status?: string | string[];
  tags?: string | string[];
}): string {
  const tags = normalizeMultiParam(searchParams.tags);
  if (tags.length > 0) {
    const query = tags.map((tag) => `tags=${encodeURIComponent(tag)}`).join("&");
    return `GET /pet/findByTags?${query}`;
  }

  const statuses = normalizeMultiParam(searchParams.status);
  if (statuses.length > 0) {
    const query = statuses.map((status) => `status=${encodeURIComponent(status)}`).join("&");
    return `GET /pet/findByStatus?${query}`;
  }

  return "GET /pet/findByStatus?status=available&status=pending&status=sold";
}
