import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs-extra";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // Real-time Collaboration & AI Network Mesh
  io.on("connection", (socket) => {
    console.log(`[Socket] User connected: ${socket.id}`);

    socket.on("join-workspace", (workspaceId) => {
      socket.join(workspaceId);
      console.log(`[Socket] User ${socket.id} joined room: ${workspaceId}`);
    });

    // Broadcast cell actions to others in the same workspace
    socket.on("cell-action", ({ workspaceId, action }) => {
      socket.to(workspaceId).emit("remote-cell-action", action);
    });

    // Handle CLI commands from terminal
    socket.on("cli-command", (command) => {
      console.log(`[CLI] Execute: ${command}`);
      // Simulate CLI execution response
      setTimeout(() => {
        socket.emit("cli-output", `Executed command: ${command} \nStatus: SUCCESS \nEnvironment: Isolated Mesh Node`);
      }, 500);
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] User disconnected: ${socket.id}`);
    });
  });

  // API Routes
  app.use(express.json());

  // Filesystem API for FileExplorer
  app.get("/api/fs/ls", async (req, res) => {
    try {
      const targetPath = path.resolve(process.cwd(), (req.query.path as string) || ".");
      if (!targetPath.startsWith(process.cwd())) {
        return res.status(403).json({ error: "Access denied" });
      }
      const items = await fs.readdir(targetPath, { withFileTypes: true });
      res.json({
        items: items.map(item => ({
          name: item.name,
          isDirectory: item.isDirectory(),
          path: path.relative(process.cwd(), path.join(targetPath, item.name))
        }))
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/fs/read", async (req, res) => {
    try {
      const filePath = path.resolve(process.cwd(), req.body.filePath);
      if (!filePath.startsWith(process.cwd())) {
        return res.status(403).json({ error: "Access denied" });
      }
      const content = await fs.readFile(filePath, "utf-8");
      res.json({ content });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/fs/write", async (req, res) => {
    try {
      const filePath = path.resolve(process.cwd(), req.body.filePath);
      if (!filePath.startsWith(process.cwd())) {
        return res.status(403).json({ error: "Access denied" });
      }
      await fs.ensureDir(path.dirname(filePath));
      await fs.writeFile(filePath, req.body.content || "");
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/fs/delete", async (req, res) => {
    try {
      const targetPath = path.resolve(process.cwd(), req.body.path);
      if (!targetPath.startsWith(process.cwd())) {
        return res.status(403).json({ error: "Access denied" });
      }
      await fs.remove(targetPath);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({
      status: "healthy",
      network: "OpenAgents Live Mesh",
      uptime: process.uptime(),
      cellsActive: Math.floor(Math.random() * 10) + 1
    });
  });

  // OpenAgents Network Lifecycle
  console.log("[OpenAgents] Initializing local mesh network...");
  console.log("[OpenAgents] Publishing to openagents.org/local-node-8a39...");

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Core running on http://localhost:${PORT}`);
  });
}

startServer();
