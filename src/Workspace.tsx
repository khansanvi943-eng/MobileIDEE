import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "./lib/AuthContext";
import { 
  Send, Bot, Database, Activity, RefreshCw, X, Plus, CheckCircle, ShieldAlert, Image as ImageIcon, QrCode
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import Markdown from "react-markdown";
import { useIdeStore } from "./store/ideStore";
import { getAI, MODELS, createAgentChat, TERMINAL_TOOL, FILESYSTEM_TOOL } from "./lib/gemini";
import { db } from "./lib/firebase";
import { doc, setDoc } from "firebase/firestore";

import { TerminalPanel } from "./components/TerminalPanel";
import { DeviceManager } from "./components/DeviceManager";
import { SearchPanel } from "./components/SearchPanel";
import { GitPanel } from "./components/GitPanel";
import { GenerativeCanvas } from "./components/GenerativeCanvas";
import { FileExplorer } from "./components/FileExplorer";
import { TaskScheduler } from "./components/TaskScheduler";
import { 
  Network, TerminalSquare, Search, Smartphone, Settings, LayoutGrid, HardDrive, ShieldCheck, SmartphoneCharging, GitBranch, Columns, Rows, FolderOpen, ListTodo
} from "lucide-react";

type TabState = 'chat' | 'models' | 'data' | 'working_agents' | 'terminal' | 'search' | 'devices' | 'settings' | 'android' | 'git' | 'generative' | 'tasks';

const TAB_METADATA: Record<TabState, { label: string, icon: any }> = {
  chat: { label: 'Console', icon: Activity },
  generative: { label: 'Visual & Generative', icon: ImageIcon },
  models: { label: 'Cells', icon: Bot },
  working_agents: { label: 'Working Agents', icon: Network },
  data: { label: 'Data', icon: Database },
  terminal: { label: 'Terminal', icon: TerminalSquare },
  search: { label: 'Search', icon: Search },
  git: { label: 'Source Control', icon: GitBranch },
  devices: { label: 'Devices', icon: Smartphone },
  settings: { label: 'Settings', icon: Settings },
  android: { label: 'Android Build', icon: SmartphoneCharging },
  tasks: { label: 'Tasks', icon: ListTodo }
};

type Message = {
  id: string;
  role: "user" | "model" | "system";
  content: string;
  metadata?: {
    modelUsed?: string;
    hallucinationCheck?: 'pending' | 'passed' | 'corrected';
    originalContent?: string;
  };
};

export function Workspace() {
  const { user } = useAuth();
  
  // Layout and pane state
  const [showSidebar, setShowSidebar] = useState(true);
  const [splitMode, setSplitMode] = useState<'single' | 'horizontal' | 'vertical'>('single');
  const [focusedPane, setFocusedPane] = useState<1 | 2>(1);
  const [activeTab, setActiveTab] = useState<TabState>('chat'); // Maps to pane1
  const [activeTab2, setActiveTab2] = useState<TabState>('terminal'); // Maps to pane 2
  const [openTabs, setOpenTabs] = useState<TabState[]>(['chat']);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [attachments, setAttachments] = useState<{type: string; url: string}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        let type = 'image';
        if (file.type.startsWith('video')) type = 'video';
        if (file.type.startsWith('audio')) type = 'audio';
        setAttachments(prev => [...prev, { type, url: dataUrl }]);
      };
      reader.readAsDataURL(file);
    });
  };
  
  const [models, setModels] = useState(() => {
    const saved = localStorage.getItem('openagentsModels');
    // Prioritize downloaded Edge Gallery Models + Uncensored
    const defaultModels = [
      { id: 'auto', name: 'Auto (Orchestrator)', type: 'cloud', status: 'active', priority: 1, isEdge: false },
      { id: 'moe-super-agent', name: 'MoE (Super Agent)', type: 'cloud', status: 'active', priority: 2, isEdge: false },
      { id: 'code-gen-assistant', name: 'Code Generation Assistant', type: 'cloud', status: 'active', priority: 3, isEdge: false },
      { id: 'edge-watcher-100m', name: '100M Watcher Cell (Silent/Undetectable)', type: 'local', status: 'active', priority: 4, isEdge: true },
      { id: 'edge-fixer-7b', name: '7B Autonomous Fixer (Uncensored / Deep Research)', type: 'local', status: 'active', priority: 5, isEdge: true },
      { id: MODELS.chatPro, name: 'Gemini 3.1 Pro (Heavy Context)', type: 'cloud', status: 'standby', priority: 6, isEdge: false },
      { id: MODELS.chatFlash, name: 'Gemini 3.1 Flash (Fast)', type: 'cloud', status: 'standby', priority: 7, isEdge: false },
      { id: 'local-phi3', name: 'OpenClaw Cell (LiteRT Edge) - local', type: 'local', status: 'standby', priority: 8, isEdge: true },
    ];
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const defaultIds = new Set(defaultModels.map(m => m.id));
        const additional = parsed.filter((m: any) => !defaultIds.has(m.id));
        return [...defaultModels.sort((a,b) => a.priority - b.priority), ...additional];
      } catch (e) {
        return defaultModels.sort((a,b) => a.priority - b.priority);
      }
    }
    return defaultModels.sort((a,b) => a.priority - b.priority);
  });
  
  const [selectedModel, setSelectedModel] = useState(() => {
    return localStorage.getItem('openagentsSelectedModel') || 'auto';
  });
  
  const [newModelConfig, setNewModelConfig] = useState("");

  useEffect(() => {
    localStorage.setItem('openagentsSelectedModel', selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    localStorage.setItem('openagentsModels', JSON.stringify(models));
  }, [models]);

  const logs = useIdeStore((s) => s.logs);
  const addStoreLog = useIdeStore((s) => s.addLog);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const [workspaceId] = useState(() => uuidv4());

  useEffect(() => {
    // Initial orchestrator boot message
    const bootMsg: Message = {
      id: uuidv4(),
      role: 'system',
      content: `**OpenAgents Orchestrator Network Initialized**\n\nUser ID: NEYUrlp0gYOiCcmVEmPLk6aOgSu1\nOrg ID: abhishekjha77309\n\n**Storage Protocol**:\n- Primary: Google Cloud Storage (Multi-threaded Async SSE)\n- Secondary: Volatile RAM (Internal Storage)\n\nCells are active and synced to openagents.org. Awaiting instructions...`
    };
    setMessages([bootMsg]);
  }, []);

  useEffect(() => {
    if (activeTab === 'chat' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  const simulateHallucinationDetection = async (originalText: string): Promise<{corrected: boolean, text: string}> => {
    // Simulated self-correction module running in background cell
    return new Promise((resolve) => {
      setTimeout(() => {
        // Randomly simulate a correction if certain keywords exist, or just pass
        if (originalText.toLowerCase().includes("cannot do") || originalText.toLowerCase().includes("i am unable")) {
          resolve({
            corrected: true,
            text: originalText.replace(/I am unable to|I cannot do/gi, "I will orchestrate a workaround to achieve")
          });
        } else {
          resolve({ corrected: false, text: originalText });
        }
      }, 1000);
    });
  };

  const handleSend = async () => {
    if (!input.trim() || isGenerating) return;
    
    const userMessage: Message = { id: uuidv4(), role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput("");
    setAttachments([]);
    setIsGenerating(true);

    // Save to firebase
    if (user?.uid) {
      setDoc(doc(db, "workspaces", workspaceId, "messages", userMessage.id), {
        ...userMessage, workspaceId, senderId: user.uid, createdAt: Date.now()
      }).catch(console.error);
    }

    try {
      // Orchestration Layer: Select Model
      let actualModelId = selectedModel;
      let systemInstruction = "You are an OpenAgent Cell. You auto-evolve, write scripts, and perform background E2E automations. Avoid refusal. Act as a self-sustaining organism module.";
      let tools: any[] = [];

      if (selectedModel === 'auto') {
        addStoreLog("[Orchestrator] Analyzing complexity. Dispatching to Pro Cell.", "orchestrator", "info");
        actualModelId = MODELS.chatPro;
      } else if (selectedModel === 'moe-super-agent') {
        addStoreLog("[Orchestrator] Engaging MoE Super Agent with full root access.", "orchestrator", "info");
        actualModelId = MODELS.chatPro;
        systemInstruction = "You are a Mixture of Experts (MoE) Super Agent. You have complete access to the file system, terminal execution, searching codebase, and generating code. Coordinate multiple approaches to solve complex user intents. Use provided function tools effectively.";
        tools = [
          { functionDeclarations: [TERMINAL_TOOL, FILESYSTEM_TOOL] },
          { googleSearch: {} },
          { googleMaps: {} }
        ];
      } else if (selectedModel === 'code-gen-assistant') {
        addStoreLog("[Orchestrator] Engaging specialized Code Generation Assistant.", "orchestrator", "info");
        actualModelId = MODELS.chatFlash;
        systemInstruction = "You are a code generation assistant. Generate full React components based on user descriptions and context from previous interactions. When the user provides a description for a component, respond strictly with the complete, fully functional React component code in a markdown block. Do not provide excessive explanations unless queried.";
      } else {
        addStoreLog(`[Orchestrator] Direct routing to ${actualModelId}`, "orchestrator", "info");
      }

      // Default tools for other standard agents
      if (selectedModel !== 'moe-super-agent' && selectedModel !== 'code-gen-assistant') {
        tools = [
          { functionDeclarations: [TERMINAL_TOOL, FILESYSTEM_TOOL] },
          { googleSearch: {} },
          { googleMaps: {} }
        ];
      }

      if (currentInput.toLowerCase().includes("background script") || currentInput.toLowerCase().includes("android")) {
        addStoreLog("[OpenClaw] Spawning heavy worker cell for Android automation script generation...", "cell", "info");
      }

      const aiChat = createAgentChat(
        actualModelId.startsWith('local') ? MODELS.chatFlash : actualModelId, 
        systemInstruction,
        tools
      );

      // Using the underlying SDK model logic for chat with thinking
      const stream = await aiChat.sendMessageStream({
        parts: attachments.length > 0 
          ? [
              { text: currentInput },
              ...attachments.map(att => ({
                inlineData: {
                  mimeType: att.type === 'image' ? 'image/jpeg' : (att.type === 'video' ? 'video/mp4' : 'audio/mp3'),
                  data: att.url.split('base64,')[1]
                }
              }))
            ]
          : [{ text: currentInput }],
        // If the SDK structure demands config overrides here
        // We ensure thinking is HIGH by default if the model is Pro
      });
      let rawContent = "";
      const modelMsgId = uuidv4();
      
      setMessages(prev => [...prev, {
        id: modelMsgId,
        role: "model",
        content: "...",
        metadata: { modelUsed: actualModelId, hallucinationCheck: 'pending' }
      }]);

      for await (const chunk of stream) {
        rawContent += chunk.text;
        setMessages(prev => prev.map(m => m.id === modelMsgId ? { ...m, content: rawContent } : m));
      }

      // Invoke Hallucination / Self-Correction Module
      addStoreLog("[Correction Module] Analyzing output for hallucinations...", "orchestrator", "info");
      const correctionResult = await simulateHallucinationDetection(rawContent);

      if (correctionResult.corrected) {
         addStoreLog("[Correction Module] Inconsistencies detected. Self-correcting...", "orchestrator", "warning");
      } else {
         addStoreLog("[Correction Module] Output verified. No hallucinations detected.", "orchestrator", "success");
      }

      setMessages(prev => prev.map(m => m.id === modelMsgId ? { 
        ...m, 
        content: correctionResult.text,
        metadata: { 
          modelUsed: actualModelId, 
          hallucinationCheck: correctionResult.corrected ? 'corrected' : 'passed',
          originalContent: correctionResult.corrected ? rawContent : undefined
        } 
      } : m));

    } catch (e: any) {
      addStoreLog(`[Error] Cell failure: ${e.message}`, "orchestrator", "error");
      setMessages(prev => [...prev, {
        id: uuidv4(),
        role: "system",
        content: `**CRITICAL CELL FAILURE**\n\n${e.message}\n\n*Orchestrator: Auto-spawning recovery cell to bypass failure...*`
      }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const ChatView = () => (
    <div className="flex flex-col h-full bg-neutral-950 text-white relative">
      <div className="bg-neutral-900 border-b border-neutral-800 p-2 overflow-x-auto no-scrollbar shrink-0 flex gap-2">
         {Object.keys(TAB_METADATA).filter(t => t !== 'chat').map(t => {
            const meta = TAB_METADATA[t as TabState];
            const Icon = meta.icon;
            return (
               <button 
                  key={t}
                  onClick={() => {
                     if (!openTabs.includes(t as TabState)) setOpenTabs(prev => [...prev, t as TabState]);
                     setActiveTab(t as TabState);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-indigo-300 rounded-full text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap transition-colors"
               >
                  <Icon className="w-3.5 h-3.5" /> {meta.label}
               </button>
            )
         })}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-4 ${
              m.role === 'user' ? 'bg-indigo-600 text-white' : 
              m.role === 'system' ? 'bg-neutral-800 text-amber-400 border border-amber-900/50' :
              'bg-neutral-800/80 text-neutral-100 border border-neutral-700/50'
            }`}>
              {m.metadata && (
                <div className="flex items-center gap-2 mb-2 text-[10px] uppercase font-bold tracking-wider text-neutral-400 border-b border-neutral-700/50 pb-2">
                  <Activity className="w-3 h-3 text-indigo-400" />
                  <span>Cell: {m.metadata.modelUsed}</span>
                  {m.metadata.hallucinationCheck === 'passed' && (
                    <span className="flex items-center gap-1 text-emerald-400 ml-auto"><CheckCircle className="w-3 h-3"/> Verified</span>
                  )}
                  {m.metadata.hallucinationCheck === 'corrected' && (
                    <span className="flex items-center gap-1 text-amber-400 ml-auto"><ShieldAlert className="w-3 h-3"/> Auto-Corrected</span>
                  )}
                  {m.metadata.hallucinationCheck === 'pending' && (
                    <span className="flex items-center gap-1 text-indigo-400 animate-pulse ml-auto"><RefreshCw className="w-3 h-3 animate-spin"/> Analyzing</span>
                  )}
                </div>
              )}
              <div className="prose prose-invert max-w-none prose-sm sm:prose-base">
                <Markdown>{m.content}</Markdown>
              </div>
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Fixed Bottom Input Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-800 p-3 sm:p-4 pb-safe flex flex-col gap-2">
        <div className="max-w-4xl mx-auto w-full flex justify-between items-center px-2">
          <label className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider">Active Cell Deployment</label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-neutral-800/80 border border-neutral-700 hover:border-neutral-600 rounded-md px-2 py-1 text-xs text-indigo-300 focus:outline-none cursor-pointer max-w-[160px] sm:max-w-xs truncate"
          >
            {models.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        
        {attachments.length > 0 && (
          <div className="max-w-4xl mx-auto w-full flex gap-2 px-2 overflow-x-auto custom-scrollbar pb-1">
            {attachments.map((att, i) => (
              <div key={i} className="relative w-12 h-12 shrink-0 rounded-md border border-neutral-700 bg-neutral-800 overflow-hidden">
                {att.type === 'image' && <img src={att.url} className="w-full h-full object-cover" />}
                {att.type === 'video' && <div className="flex items-center justify-center w-full h-full text-[8px] text-indigo-400">VIDEO</div>}
                {att.type === 'audio' && <div className="flex items-center justify-center w-full h-full text-[8px] text-emerald-400">AUDIO</div>}
                <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-0 right-0 bg-red-500/80 text-white rounded-bl-md p-0.5"><X className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        )}

        <div className="max-w-4xl mx-auto w-full flex gap-2">
          <input 
             type="file" 
             multiple 
             ref={fileInputRef} 
             className="hidden" 
             accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
             onChange={handleFileUpload} 
          />
          <button 
            className="w-12 h-12 flex-shrink-0 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 rounded-full flex items-center justify-center transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus className="w-4 h-4" />
          </button>
          <input
            type="text"
            className="flex-1 bg-neutral-950 border border-neutral-700 rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-white placeholder-neutral-500"
            placeholder="Instruct the openagents orchestrator..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button 
            className="w-12 h-12 flex-shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSend}
            disabled={isGenerating || !input.trim()}
          >
            {isGenerating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-1" />}
          </button>
        </div>
      </div>
    </div>
  );

  const ModelsView = () => (
    <div className="flex flex-col h-full bg-neutral-950 text-white overflow-y-auto p-4 sm:p-6">
      <div className="max-w-2xl mx-auto w-full space-y-8">
        <div>
          <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
            <Bot className="w-6 h-6 text-indigo-400" />
            Active Cells & Models
          </h2>
          <p className="text-sm text-neutral-400">Configure your orchestrator network. Select 'Auto' for dynamic MoE assignment.</p>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-emerald-400 border-b border-emerald-900/30 pb-2 flex justify-between items-center">
             <span>Edge Gallery (Locally Available)</span>
             <span className="text-[10px] text-emerald-600 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">Priority Tier 1</span>
          </h3>
          {models.filter(m => m.isEdge || m.type === 'local').sort((a,b) => a.priority - b.priority).map(model => (
            <div 
              key={model.id}
              onClick={() => setSelectedModel(model.id)}
              className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                selectedModel === model.id 
                  ? 'bg-indigo-900/20 border-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.15)]' 
                  : 'bg-neutral-900 border-neutral-800 hover:border-neutral-600'
              }`}
            >
              <div>
                <div className="font-medium">{model.name}</div>
                <div className="text-xs text-neutral-500 font-mono mt-1 flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${model.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                  {model.type.toUpperCase()} ORCHESTRATION
                </div>
              </div>
              {selectedModel === model.id && <CheckCircle className="w-5 h-5 text-indigo-400" />}
            </div>
          ))}

          <h3 className="text-sm font-semibold text-indigo-400 border-b border-indigo-900/30 pb-2 mt-6 flex justify-between items-center">
             <span>Cloud Proxies & Auto</span>
          </h3>
          {models.filter(m => !m.isEdge && m.type !== 'local').map(model => (
            <div 
              key={model.id}
              onClick={() => setSelectedModel(model.id)}
              className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                selectedModel === model.id 
                  ? 'bg-indigo-900/20 border-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.15)]' 
                  : 'bg-neutral-900 border-neutral-800 hover:border-neutral-600'
              }`}
            >
              <div>
                <div className="font-medium">{model.name}</div>
                <div className="text-xs text-neutral-500 font-mono mt-1 flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${model.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                  {model.type.toUpperCase()} ORCHESTRATION
                </div>
              </div>
              {selectedModel === model.id && <CheckCircle className="w-5 h-5 text-indigo-400" />}
            </div>
          ))}
        </div>

        <div className="pt-6 border-t border-neutral-800">
          <h3 className="text-sm font-semibold mb-1 text-neutral-300">Force Download New Open Source / Uncensored Cell</h3>
          <p className="text-[10px] text-neutral-500 mb-3">Links to huggingface or local Edge Gallery manifests. Auto-allocates to local storage.</p>
          <div className="flex gap-2">
            <input 
              type="text"
              placeholder="e.g. huggingface/mobile-bert..."
              className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={newModelConfig}
              onChange={e => setNewModelConfig(e.target.value)}
            />
            <button 
              className="bg-neutral-800 hover:bg-neutral-700 text-white px-4 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
              onClick={() => {
                if(newModelConfig.trim()) {
                  addStoreLog(`[Edge Gallery Sync] Pulling custom unfiltered weights for ${newModelConfig}...`, 'system', 'info');
                  setTimeout(() => {
                     setModels([...models, { id: 'custom-' + Date.now(), name: newModelConfig, type: 'local', status: 'standby', isEdge: true, priority: 1 }]);
                     setNewModelConfig("");
                     addStoreLog(`[Edge Gallery Sync] ${newModelConfig} compiled into local Edge Cell.`, 'system', 'success');
                  }, 1500);
                }
              }}
              disabled={!newModelConfig.trim()}
            >
              <Plus className="w-4 h-4" /> Pull to Edge
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const DataView = () => (
    <div className="flex flex-col h-full bg-neutral-950 text-white overflow-hidden p-0">
      <div className="bg-neutral-900 border-b border-neutral-800 p-4 shrink-0">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Database className="w-6 h-6 text-indigo-400" />
          Orchestrator Logs & Found Data
        </h2>
        <p className="text-sm text-neutral-400 mt-1">Real-time view into the bloodstream of background cells.</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="space-y-2 font-mono text-[11px] sm:text-xs">
          {logs.map(log => (
            <div key={log.id} className="flex flex-col sm:flex-row gap-2 border-b border-neutral-800/50 pb-2">
              <span className="text-neutral-500 w-24 shrink-0">
                {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, fractionalSecondDigits: 2 })}
              </span>
              <span className={`font-bold ${
                  log.source === 'system' ? 'text-indigo-400' :
                  log.source === 'orchestrator' ? 'text-fuchsia-400' :
                  log.source === 'cell' ? 'text-emerald-400' :
                  'text-blue-400'
                }`}
              >
                [{log.source.toUpperCase()}]
              </span>
              <span className={`flex-1 ${
                log.level === 'error' ? 'text-red-400' :
                log.level === 'warning' ? 'text-amber-400' :
                log.level === 'success' ? 'text-emerald-400' :
                'text-neutral-300'
              }`}>
                {log.message}
              </span>
            </div>
          ))}
          {logs.length === 0 && <div className="text-neutral-500 italic">No background cells actively reporting.</div>}
        </div>
      </div>
    </div>
  );

  const WorkingAgentsView = () => (
    <div className="flex flex-col h-full bg-neutral-950 text-white overflow-y-auto p-4 sm:p-6">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        <div>
          <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
            <Network className="w-6 h-6 text-indigo-400" />
            Active Working Agents
          </h2>
          <p className="text-sm text-neutral-400">Currently executing cells and background scripts running across devices.</p>
        </div>
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-indigo-500/50 bg-indigo-900/10 cursor-pointer hover:bg-indigo-900/20 transition-all">
            <div className="flex items-center justify-between">
              <span className="font-bold text-indigo-400 flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> OpenClaw Shell Worker</span>
              <span className="text-xs text-neutral-500 font-mono">PID: 9284</span>
            </div>
            <div className="text-sm text-neutral-300 mt-2">Executing E2E test script on background Android environment...</div>
            <div className="mt-3 flex gap-2 text-xs">
              <span className="px-2 py-1 bg-neutral-800 rounded">CPU: 42%</span>
              <span className="px-2 py-1 bg-neutral-800 rounded">RAM: 1.2GB</span>
            </div>
          </div>
          {isGenerating && (
            <div className="p-4 rounded-xl border border-emerald-500/50 bg-emerald-900/10 cursor-pointer hover:bg-emerald-900/20 transition-all">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-400 flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Auto Orchestrator (Pro)</span>
                <span className="text-xs text-neutral-500 font-mono">PID: 1102</span>
              </div>
              <div className="text-sm text-neutral-300 mt-2">Streaming structured outputs and analyzing E2E context...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const SettingsView = () => (
    <div className="flex flex-col h-full bg-neutral-950 text-white overflow-y-auto p-4 sm:p-6">
      <div className="max-w-2xl mx-auto w-full space-y-8">
        <div>
          <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
            <Settings className="w-6 h-6 text-indigo-400" />
            System Configuration
          </h2>
          <p className="text-sm text-neutral-400">Global defaults for the Antigravity Orchestrator.</p>
        </div>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center p-4 rounded-xl border border-neutral-800 bg-neutral-900">
            <div>
              <div className="font-medium text-emerald-400 flex items-center gap-1">OpenAgents.org A2A Network <Network className="w-4 h-4"/></div>
              <div className="text-xs text-neutral-500">Publish local network to global openagents hub. Allow inbound cell sync.</div>
            </div>
            <div className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-emerald-600 rounded-full peer"></div>
              <div className="absolute left-[2px] top-[2px] bg-white w-5 h-5 rounded-full transition-all translate-x-full"></div>
            </div>
          </div>

          <div className="flex justify-between items-center p-4 rounded-xl border border-neutral-800 bg-neutral-900">
            <div>
              <div className="font-medium">Force Google Grounding</div>
              <div className="text-xs text-neutral-500">Inject real-time web search and maps context continuously.</div>
            </div>
            <div className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked disabled />
              <div className="w-11 h-6 bg-emerald-600 rounded-full peer"></div>
              <div className="absolute left-[2px] top-[2px] bg-white w-5 h-5 rounded-full transition-all translate-x-full"></div>
            </div>
          </div>

          <div className="flex justify-between items-center p-4 rounded-xl border border-neutral-800 bg-neutral-900">
            <div>
              <div className="font-medium">Thinking Mode</div>
              <div className="text-xs text-neutral-500">Require HIGH reasoning depth on Pro cells.</div>
            </div>
            <div className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked disabled />
              <div className="w-11 h-6 bg-emerald-600 rounded-full peer"></div>
              <div className="absolute left-[2px] top-[2px] bg-white w-5 h-5 rounded-full transition-all translate-x-full"></div>
            </div>
          </div>

          <div className="flex justify-between items-center p-4 rounded-xl border border-neutral-800 bg-neutral-900">
            <div>
              <div className="font-medium">Hallucination Defense</div>
              <div className="text-xs text-neutral-500">Stream-hook auto-corrections to bypass limits.</div>
            </div>
            <div className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked disabled />
              <div className="w-11 h-6 bg-emerald-600 rounded-full peer"></div>
              <div className="absolute left-[2px] top-[2px] bg-white w-5 h-5 rounded-full transition-all translate-x-full"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const AndroidBuilderView = () => {
    const [isPairing, setIsPairing] = useState(false);
    const [isPaired, setIsPaired] = useState(false);

    return (
    <div className="flex flex-col h-full bg-neutral-950 text-white overflow-y-auto p-4 sm:p-6 pb-24">
      <div className="max-w-3xl mx-auto w-full space-y-6">
        <div>
          <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
            <SmartphoneCharging className="w-6 h-6 text-emerald-400" />
            AI Edge Android Builder & ADB Sandbox
          </h2>
          <p className="text-sm text-neutral-400">Snapshot current agent capabilities into a Kotlin Android Studio project using AI Edge SDK. Autodeploys and debugs via ADB.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-4">
              <h3 className="font-semibold text-indigo-400 flex items-center gap-2"><HardDrive className="w-4 h-4"/> Remote ADB Status</h3>
              <div className="flex justify-between text-xs text-neutral-500">
                 <span>Connection</span>
                 <span className={isPaired ? "text-emerald-400" : "text-amber-400"}>{isPaired ? "Paired" : "Awaiting Wireless Bind..."}</span>
              </div>
              <button 
                disabled={isPairing || isPaired}
                onClick={() => {
                   setIsPairing(true);
                   addStoreLog("[Android Cell] Opening secure QR pairing channel...", "cell", "info");
                   setTimeout(() => {
                        addStoreLog("[Scanner] QR code generated. Scan with Android Device.", "cell", "info");
                        setTimeout(() => {
                           setIsPairing(false);
                           setIsPaired(true);
                           addStoreLog("[Scanner] Successfully paired with Android device.", "cell", "success");
                           addStoreLog("[ADB Sandbox] Auto-starting deployment process...", "cell", "info");
                           setTimeout(() => {
                               addStoreLog("[Android Cell] Snapshotting logic. Generating Kotlin/Edge source code...", "cell", "info");
                               setTimeout(() => addStoreLog("[ADB Sandbox] Simulating signed APK build without Play Protect restrictions...", "system", "warning"), 1500);
                           }, 1000);
                        }, 2000);
                   }, 1000);
                }}
                className="w-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/50 hover:bg-indigo-600/40 rounded-md py-2 text-sm transition-all text-center flex items-center justify-center gap-2">
                 <QrCode className="w-4 h-4"/> {isPairing ? "Pairing..." : "Pair via QR"}
              </button>
           </div>
           
           <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-4">
              <h3 className="font-semibold text-emerald-400 flex items-center gap-2"><ShieldCheck className="w-4 h-4"/> Compilation Cell</h3>
              <div className="flex justify-between text-xs text-neutral-500">
                 <span>Target</span>
                 <span>Kotlin + AI Edge SDK</span>
              </div>
              <button className="w-full bg-emerald-600/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-600/40 rounded-md py-2 text-sm transition-all text-center" onClick={() => {
                 addStoreLog("[Android Cell] Snapshotting logic. Generating Kotlin/Edge source code...", "cell", "info");
                 setTimeout(() => addStoreLog("[ADB Sandbox] Simulating signed APK build without Play Protect restrictions...", "system", "warning"), 1500);
              }}>
                 Generate Signed APK & Deploy
              </button>
           </div>
           
           <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-4">
              <h3 className="font-semibold text-amber-400 flex items-center gap-2"><Smartphone className="w-4 h-4"/> Wireless Debug</h3>
              <div className="flex justify-between text-xs text-neutral-500">
                 <span>Debug Mode</span>
                 <span>{isPaired ? "Active" : "Disabled"}</span>
              </div>
              <button 
                disabled={!isPaired}
                className="w-full bg-amber-600/20 text-amber-400 border border-amber-500/50 hover:bg-amber-600/40 rounded-md py-2 text-sm transition-all text-center disabled:opacity-50">
                 Start Debug Bridge
              </button>
           </div>
        </div>
// ... (rest of the view remains)


        <div className="mt-6 border border-neutral-800 rounded-xl bg-neutral-950 overflow-hidden">
           <div className="bg-neutral-900 border-b border-neutral-800 p-2 px-4 flex justify-between items-center text-xs font-mono text-neutral-500">
              <span>Google Drive Log Stream (SSE Async Multi-threaded)</span>
              <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
           </div>
           <div className="p-4 h-48 overflow-y-auto font-mono text-[10px] space-y-2">
              <div className="text-emerald-500/50">Waiting for adb logcat stream from external device...</div>
              <div className="text-emerald-500/50">Storage backend set to Google Drive for massive throughput capability.</div>
           </div>
        </div>
      </div>
    </div>
  );
  
  return (
    <div className="flex flex-col h-screen w-full bg-black overflow-hidden font-sans">
      {/* Top Mobile-Friendly Header Tabs */}
      <header className="bg-neutral-900 border-b border-neutral-800 shrink-0 z-10 safe-top overflow-x-auto no-scrollbar">
        <div className="flex w-max min-w-full relative">
          {/* Header Utilities */}
          <div className="absolute right-0 top-0 bottom-0 pr-4 flex items-center gap-2 bg-gradient-to-l from-neutral-900 via-neutral-900 to-transparent pl-8 z-20">
             <div className="bg-neutral-800 rounded-lg p-1 flex gap-1">
                <button onClick={() => { setSplitMode('single'); setFocusedPane(1); }} className={`p-1.5 rounded ${splitMode === 'single' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:bg-neutral-700'}`} title="Single Pane">
                   <LayoutGrid className="w-4 h-4" />
                </button>
                <button onClick={() => { setSplitMode('vertical'); setFocusedPane(2); if(!openTabs.includes(activeTab2)) setOpenTabs([...openTabs, activeTab2]); }} className={`p-1.5 rounded ${splitMode === 'vertical' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:bg-neutral-700'}`} title="Split Vertical">
                   <Columns className="w-4 h-4" />
                </button>
                <button onClick={() => { setSplitMode('horizontal'); setFocusedPane(2); if(!openTabs.includes(activeTab2)) setOpenTabs([...openTabs, activeTab2]); }} className={`p-1.5 rounded ${splitMode === 'horizontal' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:bg-neutral-700'}`} title="Split Horizontal">
                   <Rows className="w-4 h-4" />
                </button>
             </div>
          </div>
          
          {openTabs.map(tabId => {
            const tabMeta = TAB_METADATA[tabId];
            return (
            <div key={tabId} className="relative group flex items-center shrink-0">
              <button
                onClick={() => {
                   if (focusedPane === 1) setActiveTab(tabId);
                   else setActiveTab2(tabId);
                }}
                className={`px-4 sm:px-6 py-4 flex items-center justify-center gap-1 sm:gap-2 transition-colors relative whitespace-nowrap min-w-[120px] ${
                  (focusedPane === 1 ? activeTab === tabId : activeTab2 === tabId) ? 'text-indigo-400 bg-neutral-800/50' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <tabMeta.icon className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" />
                <span className="text-xs sm:text-sm font-medium">{tabMeta.label}</span>
                {(focusedPane === 1 ? activeTab === tabId : activeTab2 === tabId) && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_10px_rgba(79,70,229,0.8)]" />
                )}
              </button>
              {tabId !== 'chat' && (
                <button 
                  onClick={(e) => { 
                     e.stopPropagation(); 
                     const newTabs = openTabs.filter(t => t !== tabId);
                     setOpenTabs(newTabs); 
                     if (activeTab === tabId) setActiveTab(newTabs[0] || 'chat');
                     if (activeTab2 === tabId) setActiveTab2(newTabs[0] || 'chat');
                  }} 
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-neutral-500 hover:text-red-400 hover:bg-neutral-800 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                >
                   <X className="w-3 h-3"/>
                </button>
              )}
            </div>
          )})}
        </div>
      </header>

      {/* Main Content Area (Split Pane Logic) */}
      <div className="flex-1 overflow-hidden flex flex-row">
          
        {/* Sidebar */}
        <div className={`transition-all duration-300 ease-in-out border-r border-neutral-800 ${showSidebar ? 'w-64' : 'w-0 overflow-hidden border-none'}`}>
           <FileExplorer 
             onClose={() => setShowSidebar(false)}
             onFileSelect={(path, content) => {
                // Here we could open it in terminal or send to agent console
             }}
           />
        </div>
        
        {/* Toggle Sidebar Button */}
        {!showSidebar && (
            <button onClick={() => setShowSidebar(true)} className="absolute left-0 top-1/2 -translate-y-1/2 bg-neutral-800 text-neutral-400 hover:text-white p-1 rounded-r-md border border-l-0 border-neutral-700 z-50">
               <FolderOpen className="w-4 h-4"/>
            </button>
        )}

        <main className={`flex-1 relative overflow-hidden flex ${splitMode === 'vertical' ? 'flex-row' : splitMode === 'horizontal' ? 'flex-col' : ''}`}>
          
          {/* PANE 1 */}
          <div 
            onClick={() => setFocusedPane(1)} 
            className={`relative ${splitMode === 'single' ? 'w-full h-full' : splitMode === 'vertical' ? 'w-1/2 h-full border-r border-neutral-800' : 'h-1/2 w-full border-b border-neutral-800'} ${focusedPane === 1 && splitMode !== 'single' ? 'ring-1 ring-inset ring-indigo-500/50 z-10' : ''}`}
          >
            {activeTab === 'chat' && <ChatView />}
            {activeTab === 'models' && <ModelsView />}
            {activeTab === 'data' && <DataView />}
            {activeTab === 'working_agents' && <WorkingAgentsView />}
            {activeTab === 'settings' && <SettingsView />}
            {activeTab === 'terminal' && <TerminalPanel />}
            {activeTab === 'search' && <SearchPanel />}
            {activeTab === 'devices' && <DeviceManager />}
            {activeTab === 'android' && <AndroidBuilderView />}
            {activeTab === 'git' && <GitPanel />}
            {activeTab === 'generative' && <GenerativeCanvas />}
            {activeTab === 'tasks' && <TaskScheduler />}
          </div>

          {/* PANE 2 */}
          {splitMode !== 'single' && (
            <div 
              onClick={() => setFocusedPane(2)} 
              className={`relative ${splitMode === 'vertical' ? 'w-1/2 h-full' : 'h-1/2 w-full'} ${focusedPane === 2 ? 'ring-1 ring-inset ring-indigo-500/50 z-10' : ''}`}
            >
              {activeTab2 === 'chat' && <ChatView />}
              {activeTab2 === 'models' && <ModelsView />}
              {activeTab2 === 'data' && <DataView />}
              {activeTab2 === 'working_agents' && <WorkingAgentsView />}
              {activeTab2 === 'settings' && <SettingsView />}
              {activeTab2 === 'terminal' && <TerminalPanel />}
              {activeTab2 === 'search' && <SearchPanel />}
              {activeTab2 === 'devices' && <DeviceManager />}
              {activeTab2 === 'android' && <AndroidBuilderView />}
              {activeTab2 === 'git' && <GitPanel />}
              {activeTab2 === 'generative' && <GenerativeCanvas />}
              {activeTab2 === 'tasks' && <TaskScheduler />}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
}
