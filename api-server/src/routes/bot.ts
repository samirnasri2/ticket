import { Router } from "express";
import http from "http";

const router = Router();
const BOT_HOST = "localhost";
const BOT_PORT = 3000;

function proxyRequest(
  path: string,
  method: string,
  body: unknown,
  res: import("express").Response
) {
  const postData = body ? JSON.stringify(body) : undefined;
  const options: http.RequestOptions = {
    hostname: BOT_HOST,
    port: BOT_PORT,
    path,
    method,
    headers: {
      "Content-Type": "application/json",
      ...(postData ? { "Content-Length": Buffer.byteLength(postData) } : {}),
    },
  };
  const req = http.request(options, (proxyRes) => {
    res.status(proxyRes.statusCode ?? 200);
    proxyRes.pipe(res);
  });
  req.on("error", (err) => {
    res.status(502).json({ success: false, message: err.message });
  });
  if (postData) req.write(postData);
  req.end();
}

router.get("/bot/stats", (_req, res) => {
  proxyRequest("/bot/stats", "GET", null, res);
});

router.post("/bot/verify", (req, res) => {
  proxyRequest("/bot/verify", "POST", req.body, res);
});

router.get("/bot/servers", (_req, res) => {
  proxyRequest("/bot/servers", "GET", null, res);
});

router.post("/bot/ban", (req, res) => {
  proxyRequest("/bot/ban", "POST", req.body, res);
});

router.post("/bot/kick", (req, res) => {
  proxyRequest("/bot/kick", "POST", req.body, res);
});

export default router;
