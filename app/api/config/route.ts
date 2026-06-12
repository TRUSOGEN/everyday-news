import { NextResponse } from "next/server";
import { getConfig, saveConfig } from "@/lib/storage";
import type { AppConfig } from "@/types";

export async function GET() {
  const config = await getConfig();
  return NextResponse.json(config);
}

export async function POST(request: Request) {
  const body: AppConfig = await request.json();

  if (!Array.isArray(body.sources)) {
    return NextResponse.json({ error: "无效配置格式" }, { status: 400 });
  }

  await saveConfig(body);
  return NextResponse.json({ success: true });
}
