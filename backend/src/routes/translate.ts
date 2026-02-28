import { Router } from "express";
import { requireAuth } from "../http/auth";
import { env } from "../config/env";
import { asyncHandler } from "../http/errors";

export const translateRouter = Router();
translateRouter.use(requireAuth);

translateRouter.post("/", asyncHandler(async (req, res) => {
  const text = String(req.body?.text ?? "");
  const to = String(req.body?.to ?? "hi").toLowerCase();
  const from = String(req.body?.from ?? "en").toLowerCase();

  if (!text.trim()) {
    res.status(400).json({ error: "missing_text" });
    return;
  }

  if (!env.translatorEndpoint || !env.translatorKey || !env.translatorRegion) {
    res.status(501).json({ error: "translator_not_configured" });
    return;
  }

  const url = new URL(`${env.translatorEndpoint.replace(/\/$/, "")}/translate`);
  url.searchParams.set("api-version", "3.0");
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": env.translatorKey,
      "Ocp-Apim-Subscription-Region": env.translatorRegion,
      "Content-Type": "application/json"
    },
    body: JSON.stringify([{ text }])
  });

  if (!response.ok) {
    res.status(502).json({ error: "translator_failed" });
    return;
  }

  const json = (await response.json()) as any[];
  const translated = json?.[0]?.translations?.[0]?.text;
  res.json({ text: translated ?? "" });
}));
