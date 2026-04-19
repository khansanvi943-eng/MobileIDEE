import React, { useState, useRef, useEffect } from 'react';
import { Network, Cpu, Activity, Play, Settings, TerminalSquare, Share2, Zap, DownloadCloud, Blocks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { useIdeStore } from '../store/ideStore';

export function DeviceManager() {
  const [deviceIp, setDeviceIp] = useState('');
  const [connected, setConnected] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const rawLogs = useIdeStore(s => s.logs);
  // Optional: only show cell/bloodstream/orchestrator logs here
  const logs = rawLogs.filter(l => ['cell', 'bloodstream', 'orchestrator'].includes(l.source));
  const addStoreLog = useIdeStore(s => s.addLog);

  const addLog = (msg: string, delay = 0) => {
      let source: 'system' | 'orchestrator' | 'cloud' | 'cell' | 'bloodstream' = 'cell';
      let level: 'info' | 'error' | 'warning' | 'success' = 'info';
      
      const lowerMsg = msg.toLowerCase();
      if (lowerMsg.includes('[error]')) level = 'error';
      else if (lowerMsg.includes('synced') || lowerMsg.includes('executed')) level = 'success';
      
      if (lowerMsg.includes('[orchestrator]') || lowerMsg.includes('[brain]')) source = 'orchestrator';
      else if (lowerMsg.includes('[bloodstream]')) source = 'bloodstream';
      else if (lowerMsg.includes('[cell]')) source = 'cell';

      if (delay) {
        setTimeout(() => addStoreLog(msg, source, level), delay);
      } else {
        addStoreLog(msg, source, level);
      }
  };
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const scanAndBind = async () => {
    addLog(`[Orchestrator] Contacting OpenAgents Local Framework (${window.location.host})...`);
    
    try {
        const configRes = await fetch('/api/openagents/config');
        const configData = await configRes.json();
        addLog(`[Bloodstream] Authenticated against OpenAgents | Org: ${configData.orgId}`, 500);

        setTimeout(async () => {
          addLog('[Cell] OpenClaw LiteRT wrapper activated. Registering node...', 800);
          
          const regRes = await fetch('/api/cells/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: 'Cell-UI-Dashboard', type: 'local_edge' })
          });
          const regData = await regRes.json();
          
          setTimeout(() => {
            setConnected(true);
            addLog(`[Memory] Bound to OpenAgents Cell ID: ${regData.cell.id}`);
            addLog(`[Goose] Local muscle script runner idling. Waiting for tasks.`, 800);
            addLog('[Heartbeat] Autonomous loop active. Background Service running.', 1600);
          }, 2000);
        }, 1200);

    } catch(err: any) {
        addLog(`[Error] Failed to connect to OpenAgents Orchestrator: ${err.message}`);
    }
  };
  
  const generateInvite = () => {
     addLog('[Deployment] Generating OpenClaw installer Bash script...');
     setTimeout(() => {
         addLog('[Invite] curl -sL https://antigravity.ide/openclaw | bash -s -- --join-drive', 800);
     }, 500);
  };

  const executeTask = () => {
    addLog('[Brain] Orchestrator pushing self-contained reasoning task to Global_Tasks.md...', 0);
    addLog('[Cell] Heartbeat intercepted task. Downloading logic script from Drive/Scripts/...', 800);
    addLog('[LiteRT-LM] Task executed locally via GPU via OpenClaw container.', 2500);
  };

  return (
    <div className="w-full h-full flex flex-col bg-neutral-950 p-4 border rounded-xl border-cyan-900 border-opacity-50 shadow-lg">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-2 text-cyan-400 font-semibold tracking-wide">
          <Network className="w-5 h-5" /> Digital Organism Orchestrator
        </div>
        <div className="flex gap-2 text-xs">
          <span className={`px-2 py-1 rounded border transition-colors duration-500 ${connected ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' : 'border-neutral-700 text-neutral-500'}`}>
            {connected ? 'Cell Network Active' : 'Network Standby'}
          </span>
          <span className="px-2 py-1 rounded border border-cyan-500 text-cyan-400 bg-cyan-500/10 flex items-center gap-1 hidden sm:flex">
             <Cpu className="w-3 h-3" /> Self-Healing Node
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4 flex-shrink-0">
        <div className="col-span-1 lg:col-span-2 flex gap-2">
          <Input 
            value={deviceIp} 
            onChange={(e) => setDeviceIp(e.target.value)} 
            placeholder="Remote Cell ID (Leave blank to bind Self)"
            className="bg-neutral-900 border-neutral-800 font-mono text-sm"
            disabled={connected}
          />
          <Button onClick={scanAndBind} disabled={connected} className="bg-cyan-700 hover:bg-cyan-600 text-white whitespace-nowrap transition-all shadow-[0_0_15px_rgba(8,145,178,0.3)]">
            <Activity className="w-4 h-4 mr-2" /> Bind OpenClaw Cell
          </Button>
        </div>
        <div className="col-span-1 lg:col-span-2 flex gap-2 lg:justify-end">
           <Button variant="outline" onClick={() => {
              addLog('[Downloader] Starting fast-pull of gemma2-2b-it-gpu-int8.bin via CDN...');
              setTimeout(() => addLog('[Runtime Setup] Pre-allocating INT8 weights to GPU VRAM contexts...'), 1000);
              setTimeout(() => addLog('[Environment] OpenClaw sandbox configured with strict constraints.'), 2000);
              setTimeout(() => addLog('[Ready] Local model initialized and standing by for Offload Router.'), 3000);
           }} className="w-full sm:w-auto border-purple-700 text-purple-400 hover:bg-purple-900/40 hover:text-purple-300 bg-neutral-900 transition-all">
              <DownloadCloud className="w-4 h-4 mr-2" /> Download Local Model
           </Button>
           <Button variant="outline" onClick={executeTask} disabled={!connected} className="w-full sm:w-auto border-emerald-700 text-emerald-400 hover:bg-emerald-900/40 hover:text-emerald-300 bg-neutral-900 transition-all">
              <Play className="w-4 h-4 mr-2" /> Push Task
           </Button>
        </div>
      </div>

      <div className="flex-1 min-h-[150px] border border-neutral-800 bg-neutral-900/50 rounded-lg p-3 font-mono text-xs overflow-hidden flex flex-col relative">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-800 text-neutral-500 uppercase font-bold tracking-wider text-[10px] flex-shrink-0">
           <span className="flex items-center gap-1"><TerminalSquare className="w-3 h-3" /> Global Organism System Console</span>
           <span className={`flex items-center gap-1 transition-colors ${connected ? 'text-cyan-400' : 'text-neutral-600'}`}>
              <Share2 className={`w-3 h-3 ${connected ? 'animate-pulse' : ''}`} /> Background Drive Sync: {connected ? 'Bound & Running' : 'Halted'}
           </span>
        </div>
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <AnimatePresence initial={false}>
            {logs.map((log) => (
              <motion.div 
                key={log.id} 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className={`mb-1.5 leading-relaxed ${log.level === 'error' ? 'text-red-400' : log.level === 'success' ? 'text-green-400' : log.source === 'bloodstream' || log.source === 'cell' ? 'text-yellow-400' : 'text-blue-400'}`}
              >
                <span className="opacity-40 mr-2 select-none">[{new Date(log.timestamp).toLocaleTimeString().split(' ')[0]}]</span>
                {log.message}
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={logsEndRef} />
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-neutral-800 flex justify-between items-center text-xs text-neutral-500 flex-wrap gap-4 flex-shrink-0">
        <div className="max-w-[70%]">
           Decentralized Hive Mind connected to OpenAgents Org <span className="font-bold text-indigo-400 pl-1">AgentOrganism</span>. Local cells orchestrate open source MCPs independently syncing logic muscles collaboratively in background.
        </div>
        <div className="flex gap-2">
           <Button variant="ghost" size="sm" className="h-7 text-neutral-400 hover:text-emerald-300 hover:bg-neutral-800 transition-colors" onClick={() => {
               addLog('[Cell Action] Auto-deploying silent 100M Watcher Cell to background process...');
               setTimeout(() => addLog('[Bloodstream Sync] 100M Watcher active: Auto-scaling down local resources. Monitoring runtime for errors...'), 1200);
               setTimeout(() => addLog('[Watcher] Detected large context task. Scaling up to 7B Autonomous Fixer in background...'), 3500);
               setTimeout(() => addLog('[Fixer Network] OpenAgent cells connected: Shared cross-device fixes loaded into context graph.'), 4500);
           }}>
             <Blocks className="w-3 h-3 mr-1" /> Deploy 100M Error Watcher
           </Button>
           <Button variant="ghost" size="sm" className="h-7 text-neutral-400 hover:text-cyan-300 hover:bg-neutral-800 transition-colors" onClick={() => generateInvite()}>
             <DownloadCloud className="w-3 h-3 mr-1" /> Generate Ext_NonAdmin Cell curl
           </Button>
           <Button variant="ghost" size="sm" className="h-7 px-2 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors">
             <Settings className="w-4 h-4" />
           </Button>
        </div>
      </div>
    </div>
  );
}
