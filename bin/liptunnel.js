#!/usr/bin/env node

/**
 * LIPTunnel – Self-Hosted Ngrok Alternative
 * Created by Lasisi Ibrahim Pelumi (Full-Stack Engineer)
 * GitHub: https://github.com/ibrahimpelumi6142
 * License: MIT
 */

const WebSocket = require("ws");
const express = require("express");
const http = require("http");
const args = process.argv.slice(2);

function banner() {
  console.log(`
  ██╗     ██╗██████╗ ████████╗██╗   ██╗███╗   ██╗██╗██╗     ███████╗███╗   ██╗
  ██║     ██║██╔══██╗╚══██╔══╝██║   ██║████╗  ██║██║██║     ██╔════╝████╗  ██║
  ██║     ██║██████╔╝   ██║   ██║   ██║██╔██╗ ██║██║██║     █████╗  ██╔██╗ ██║
  ██║     ██║██╔═══╝    ██║   ██║   ██║██║╚██╗██║██║██║     ██╔══╝  ██║╚██╗██║
  ███████╗██║██║        ██║   ╚██████╔╝██║ ╚████║██║███████╗███████╗██║ ╚████║
  ╚══════╝╚═╝╚═╝        ╚═╝    ╚═════╝ ╚═╝  ╚═══╝╚═╝╚══════╝╚══════╝╚═╝  ╚═══╝

              LIPTunnel — By Lasisi Ibrahim Pelumi (v1.0.0)
  `);
}

function usage() {
  console.log("Usage: liptunnel http <local-port> --server yourdomain.com\n");
}

if (args[0] !== "http" || !args[1]) {
  banner();
  usage();
  process.exit(1);
}

const localPort = args[1];
let serverHost = "yourdomain.com";

const flagIndex = args.indexOf("--server");
if (flagIndex !== -1 && args[flagIndex + 1]) {
  serverHost = args[flagIndex + 1];
}

const subdomain = Math.random().toString(36).substring(2, 8);
const ws = new WebSocket(`ws://${serverHost}`);
const logs = [];

function dashboard() {
  console.clear();
  banner();
  console.log("Status: Online");
  console.log("Forwarding: http://" + subdomain + "." + serverHost + " → http://localhost:" + localPort);
  console.log("Local Dashboard: http://127.0.0.1:4040\n");
  console.log("Recent HTTP Requests:");
  logs.slice(-10).forEach(l => console.log(l));
}

ws.on("open", () => {
  ws.send(JSON.stringify({ type: "register", subdomain, port: localPort }));
  dashboard();
});

ws.on("message", async (msg) => {
  const data = JSON.parse(msg);

  if (data.type === "http-request") {
    const options = { method: data.method, headers: data.headers };

    const req = http.request(`http://localhost:${localPort}${data.url}`, options, (res) => {
      let body = "";

      res.on("data", chunk => body += chunk);
      res.on("end", () => {
        ws.send(JSON.stringify({
          type: "http-response",
          id: data.id,
          statusCode: res.statusCode,
          headers: res.headers,
          body
        }));

        const now = new Date();
        logs.push(`${now.toISOString()}  ${data.method}  ${data.url}  ${res.statusCode}`);
        dashboard();
      });
    });

    req.on("error", (err) => {
      ws.send(JSON.stringify({
        type: "http-response",
        id: data.id,
        statusCode: 502,
        headers: { "content-type": "text/plain" },
        body: "Proxy Error: " + err.message
      }));

      logs.push(`${new Date().toISOString()} ERROR 502`);
      dashboard();
    });

    if (data.body) req.write(data.body);
    req.end();
  }
});

ws.on("close", () => console.log("❌ Tunnel closed"));
ws.on("error", (e) => console.log("WebSocket Error:", e.message));

express()
  .get("/", (req, res) => {
    res.send(`
      <h1>LIPTunnel Dashboard</h1>
      <p>Public URL: http://${subdomain}.${serverHost}</p>
      <pre>${logs.join("\n")}</pre>
    `);
  })
  .listen(4040);
