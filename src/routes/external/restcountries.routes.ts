import express from "express";
import { env } from "../../configs/env";

const router = express.Router();

// Proxy GET /api/v1/external/restcountries?q=... -> REST Countries v5
router.get("/", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) {
    return res.status(400).json({ error: "query parameter 'q' is required" });
  }

  const url = `https://api.restcountries.com/countries/v5?q=${encodeURIComponent(q)}&pretty=true`;

  try {
    const headers: Record<string, string> = {};
    if (env.REST_COUNTRIES_KEY) {
      headers["Authorization"] = `Bearer ${env.REST_COUNTRIES_KEY}`;
    }

    const r = await fetch(url, { headers });
    const contentType = r.headers.get("content-type") || "application/json";
    const body = await r.text();

    res.status(r.status).type(contentType).send(body);
  } catch (err: any) {
    console.error("restcountries proxy error", err);
    res.status(502).json({ error: "failed to fetch from restcountries" });
  }
});

export { router as restCountriesRoutes };
