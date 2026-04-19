import express from "express";
import { createServer as createViteServer } from "vite";
import * as path from "path";
import * as fs from "fs";
import { exec, spawn } from "child_process";
import { EventEmitter } from "events";

// Central Bloodstream Bus on the Server
const bloodstream = new EventEmitter();

const cells = new Map<string, any>();
const tasks = new Map<string, any>();

// Simulated OpenAgents Organization Link
const openAgentsConfig = {
    userId: process.env.OPENAGENTS_USER_ID || 'NEYUrlp0gYOiCcmVEmPLk6aOgSu1',
    orgId: process.env.OPENAGENTS_ORG_ID || 'abhishekjha77309',
    // The platform will inject OPENAGENTS_API_KEY securely via process.env
    apiKey: process.env.OPENAGENTS_API_KEY || ''
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes for Orchestrator -> Cell Communication
  
  // --- FILE SYSTEM API ---
  app.get("/api/fs/ls", (req, res) => {
    const dir = (req.query.path as string) || ".";
    const absolutePath = path.resolve(process.cwd(), dir);
    
    // Safety check: ensure user stays within app directory
    if (!absolutePath.startsWith(process.cwd())) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const items = fs.readdirSync(absolutePath, { withFileTypes: true });
      const result = items.map(item => ({
        name: item.name,
        isDirectory: item.isDirectory(),
        path: path.join(dir, item.name)
      })).filter(item => !item.name.startsWith('.') || item.name === '.env.example'); // Hide hidden dirs except some
      res.json({ items: result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/fs/read", (req, res) => {
    const { filePath } = req.body;
    const absolutePath = path.resolve(process.cwd(), filePath);
    if (!absolutePath.startsWith(process.cwd())) return res.status(403).send("Denied");
    
    try {
      const content = fs.readFileSync(absolutePath, "utf-8");
      res.json({ content });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/fs/write", (req, res) => {
    const { filePath, content } = req.body;
    const absolutePath = path.resolve(process.cwd(), filePath);
    if (!absolutePath.startsWith(process.cwd())) return res.status(403).send("Denied");
    
    try {
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, content, "utf-8");
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/fs/delete", (req, res) => {
    const { path: targetPath, isDirectory } = req.body;
    const absolutePath = path.resolve(process.cwd(), targetPath);
    if (!absolutePath.startsWith(process.cwd())) return res.status(403).send("Denied");

    try {
      if (isDirectory) fs.rmSync(absolutePath, { recursive: true, force: true });
      else fs.unlinkSync(absolutePath);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/fs/rename", (req, res) => {
    const { oldPath, newPath } = req.body;
    const absOld = path.resolve(process.cwd(), oldPath);
    const absNew = path.resolve(process.cwd(), newPath);
    if (!absOld.startsWith(process.cwd()) || !absNew.startsWith(process.cwd())) return res.status(403).send("Denied");

    try {
      fs.renameSync(absOld, absNew);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- TERMINAL API ---
  app.post("/api/terminal/exec", (req, res) => {
    const { command } = req.body;
    // VERY DANGEROUS - ONLY FOR THIS PROTECTED IDE ENVIRONMENT
    exec(command, { cwd: process.cwd() }, (error, stdout, stderr) => {
      res.json({
        stdout,
        stderr,
        exitCode: error ? error.code : 0
      });
    });
  });

  // --- CODE SEARCH API ---
  app.get("/api/search", (req, res) => {
    const query = req.query.q as string;
    if (!query) return res.json({ results: [] });

    // Use grep for fast searching
    const grepCmd = `grep -rI --line-number --exclude-dir={node_modules,dist,.git} "${query}" .`;
    exec(grepCmd, { cwd: process.cwd() }, (error, stdout, stderr) => {
      const lines = stdout.split("\n").filter(Boolean);
      const results = lines.map(line => {
        const parts = line.split(":");
        const filePath = parts[0].replace("./", "");
        const lineNum = parts[1];
        const content = parts.slice(2).join(":").trim();
        return { filePath, lineNum, content };
      });
      res.json({ results });
    });
  });

  // Health & Config Check
  app.get("/api/openagents/config", (req, res) => {
    // Return sanitized config (no API key) confirming network is active
    res.json({
        status: 'active',
        userId: openAgentsConfig.userId,
        orgId: openAgentsConfig.orgId,
        networkStatus: openAgentsConfig.apiKey ? 'authenticated' : 'pending_key'
    });
  });

  // Register a local OpenClaw Cell instance
  app.post("/api/cells/register", (req, res) => {
      const { name, type } = req.body;
      const cellId = `cell_${Math.random().toString(36).substring(2, 10)}`;
      
      const cell = {
          id: cellId,
          name,
          type,
          status: 'idle',
          load: 10,
          registeredAt: Date.now(),
          lastHeartbeat: Date.now()
      };
      
      cells.set(cellId, cell);
      console.log(`[OpenAgents Network] Cell registered: ${name} (${cellId}) under Org: ${openAgentsConfig.orgId}`);
      res.json({ cell });
  });

  // Get active cells
  app.get("/api/cells", (req, res) => {
      res.json({ cells: Array.from(cells.values()) });
  });

  // Shared memory architecture across cells (Drive Bloodstream equivalent)
  const sharedMemory = new Map<string, any>(); // Stores common patterns and context

  // Heartbeat endpoint
  app.post("/api/cells/:id/heartbeat", (req, res) => {
      const cell = cells.get(req.params.id);
      if (cell) {
          cell.lastHeartbeat = Date.now();
          cells.set(req.params.id, cell);
          res.json({ status: 'ok' });
      } else {
          res.status(404).json({ error: 'Cell not found' });
      }
  });

  // Cell Context Sharing via Google Drive Bloodstream Simulation
  app.post("/api/bloodstream/context", (req, res) => {
      const { taskId, step, context } = req.body;
      const key = `task_ctx_${taskId}_${Date.now()}`;
      sharedMemory.set(key, { taskId, step, context, timestamp: Date.now() });
      bloodstream.emit('context_update', { taskId, step, context });
      console.log(`[Bloodstream Sync] Cell shared context for task ${taskId}: ${step}`);
      res.json({ success: true, memorySize: sharedMemory.size });
  });

  app.get("/api/bloodstream/patterns", (req, res) => {
      // Provide active, self-correcting patterns saved by background agents
      res.json({ patterns: Array.from(sharedMemory.values()) });
  });

  // Runtime Auto-Fix Feedback Endpoint
  app.post("/api/cells/runtime-fix", (req, res) => {
      const { cellId, errorPattern, fixAction } = req.body;
      console.log(`[OpenAgents Core] Auto-learning runtime fix from ${cellId} | Pattern: ${errorPattern} | Applied: ${fixAction}`);
      // Emitting to all cells so the whole organism gets the fix instantly
      bloodstream.emit('runtime_fix_broadcast', { errorPattern, fixAction });
      res.json({ status: 'adapted' });
  });

  // Task synchronization endpoints
  app.post("/api/tasks/sync", (req, res) => {
      const { prompt, priority, isRecurring, cron } = req.body;
      const taskId = `task_${Math.random().toString(36).substring(2, 10)}`;
      
      const task = {
          id: taskId,
          prompt,
          priority,
          isRecurring,
          cron,
          status: 'pending',
          createdAt: Date.now()
      };
      
      tasks.set(taskId, task);
      bloodstream.emit('new_task', task);
      console.log(`[OpenAgents Network] Task securely committed to Bloodstream: ${taskId}`);
      
      res.json({ task });
  });

  // Cell claiming task
  app.post("/api/tasks/:id/claim", (req, res) => {
      const { cellId } = req.body;
      const task = tasks.get(req.params.id);
      
      if (task && task.status === 'pending') {
          task.status = 'working';
          task.assignedTo = cellId;
          tasks.set(req.params.id, task);
          res.json({ success: true, task });
      } else {
          res.json({ success: false, reason: 'unvailable' });
      }
  });

  // Background processor to handle task distribution
  bloodstream.on('new_task', (task) => {
      // If we have open agents connected, we simulate OpenAgents framework distribution
      if (openAgentsConfig.apiKey) {
         console.log(`[OpenAgents] Propagating task to remote distributed cloud (Org: ${openAgentsConfig.orgId})`);
         // Here, actual fetch logic to OpenAgents endpoints would reside
      }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Setup for express 5 production serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`OpenAgents Local Network Orchestrator running on http://localhost:${PORT}`);
    console.log(`Bound to Organization: [${openAgentsConfig.orgId}]`);
  });
}

startServer();
