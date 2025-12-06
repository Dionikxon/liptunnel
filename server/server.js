/**
 * LIPTunnel Server — Tunnel Router
 * By Lasisi Ibrahim Pelumi (Full-Stack Engineer)
 */

const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const tunnels = {};
const pending = {};

app.use(async (req, res) => {
  const host = req.headers.host || "";
  const sub = host.split(".")[0];

  if (!tunnels[sub]) {
    res.status(502).end("LIPTunnel: Subdomain not active");
    return;
  }

  const requestId = uuidv4();
  const body = await new Promise(resolve => {
    let d = "";
    req.on("data", c => d += c);
    req.on("end", () => resolve(d));
  });

  tunnels[sub].ws.send(JSON.stringify({
    type: "http-request",
    id: requestId,
    method: req.method,
    url: req.url,
    headers: req.headers,
    body
  }));

  pending[requestId] = res;
});

wss.on("connection", (ws) => {
  ws.on("message", msg => {
    const data = JSON.parse(msg);

    if (data.type === "register") {
      tunnels[data.subdomain] = { ws, port: data.port };
      console.log(`🔌 Registered: ${data.subdomain} → localhost:${data.port}`);
    }

    if (data.type === "http-response" && pending[data.id]) {
      const res = pending[data.id];

      res.writeHead(data.statusCode, data.headers || {});
      res.end(data.body || "");

      delete pending[data.id];
    }
  });

  ws.on("close", () => {
    for (let key in tunnels) {
      if (tunnels[key].ws === ws) delete tunnels[key];
    }
  });
});

server.listen(80, () => {
  console.log("🚀 LIPTunnel Server running on port 80");
});
