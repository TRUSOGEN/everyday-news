import { NextResponse } from "next/server";
import { getConfig, saveConfig } from "@/lib/storage";
import type { AppConfig } from "@/types";

export async function GET() {
  try {
    const config = await getConfig();
    return NextResponse.json(config);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[config GET] 失败:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body: AppConfig = await request.json();
    if (!Array.isArray(body.sources)) {
      return NextResponse.json({ error: "无效配置格式" }, { status: 400 });
    }
    await saveConfig(body);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[config POST] 失败:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
