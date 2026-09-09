import { NextResponse } from "next/server";
import { listScenarios } from "@/services/scenario-engine.service";

export async function GET() {
  return NextResponse.json({ scenarios: listScenarios() });
}
