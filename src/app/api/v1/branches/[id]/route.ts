import { NextResponse } from "next/server";
import { withApiV1, notFoundIfMissing } from "@/lib/api-v1";
import { getBranch, updateBranch, deleteBranch } from "@/services/branch.service";
import { updateBranchSchema } from "@/lib/validations/branch";

export const GET = withApiV1<{ id: string }>(
  async (_req, { params, apiKey }) => {
    const branch = await notFoundIfMissing(() => getBranch(apiKey.companyId, params.id));
    return NextResponse.json(branch);
  },
  { scopes: ["branches:read"] }
);

export const PATCH = withApiV1<{ id: string }>(
  async (req, { params, apiKey }) => {
    const { name } = updateBranchSchema.parse(await req.json());
    const branch = await notFoundIfMissing(() => updateBranch(apiKey.companyId, params.id, name));
    return NextResponse.json(branch);
  },
  { scopes: ["branches:write"] }
);

export const DELETE = withApiV1<{ id: string }>(
  async (_req, { params, apiKey }) => {
    await notFoundIfMissing(() => deleteBranch(apiKey.companyId, params.id));
    return NextResponse.json({ id: params.id, deleted: true });
  },
  { scopes: ["branches:write"] }
);
