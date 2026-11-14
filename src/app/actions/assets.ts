"use server";

import { z } from "zod";
import { type AssetView, registerAsset } from "@/lib/assets";
import { requireUser } from "@/lib/session";
import type { ActionResult } from "./result";

export async function registerAssetAction(url: string, name: string): Promise<ActionResult<AssetView>> {
  try {
    const user = await requireUser();
    const parsed = z.object({ url: z.string().url().max(500), name: z.string().max(200) }).safeParse({ url, name });
    if (!parsed.success) return { ok: false, error: "Arquivo inválido" };
    return { ok: true, data: await registerAsset(user.id, parsed.data.url, parsed.data.name) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Não foi possível registrar o arquivo" };
  }
}
