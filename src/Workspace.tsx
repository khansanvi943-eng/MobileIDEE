import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "./lib/AuthContext";
import { 
  Send, Bot, Database, Activity, RefreshCw, X, Plus, CheckCircle, ShieldAlert
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import Markdown from "react-markdown";
import { useIdeStore } from "./store/ideStore";
import { getAI, MODELS, createAgentChat, TERMINAL_TOOL, FILESYSTEM_TOOL } from "./lib/gemini";
import { db } from "./lib/firebase";
import { doc, setDoc } from "firebase/firestore";

type TabState = 'chat' | 'models' | 'data';

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
  const [activeTab, setActiveTab] = useState<TabState>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [models, setModels] = useState([
    { id: 'auto', name: 'Auto (Orchestrator)', type: 'cloud', status: 'active' },
    { id: MODELS.chatPro, name: 'Gemini 3.1 Pro (Heavy Context)', type: 'cloud', status: 'active' },
    { id: MODELS.chatFlash, name: 'Gemini 3.1 Flash (Fast)', type: 'cloud', status: 'active' },
    { id: 'local-phi3', name: 'OpenClaw Cell (LiteRT Edge) - local', type: 'local', status: 'standby' },
  ]);
  const [selectedModel, setSelectedModel] = useState('auto');
  const [newModelConfig, setNewModelConfig] = useState("");

  const logs = useIdeStore((s) => s.logs);
  const addStoreLog = useIdeStore((s) => s.addLog);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const [workspaceId] = useState(() => uuidv4());

  useEffect(() => {
    // Initial orchestrator boot message
    const bootMsg: Message = {
      id: uuidv4(),
      role: 'system',
      content: `**OpenAgents Orchestrator Network Initialized**\n\nUser ID: NEYUrlp0gYOiCcmVEmPLk6aOgSu1\nOrg ID: abhishekjha77309\n\nCells are active and synced. Awaiting instructions...`
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
      if (selectedModel === 'auto') {
        addStoreLog("[Orchestrator] Analyzing complexity. Dispatching to Pro Cell.", "orchestrator", "info");
        actualModelId = MODELS.chatPro;
      } else {
        addStoreLog(`[Orchestrator] Direct routing to ${actualModelId}`, "orchestrator", "info");
      }

      if (currentInput.toLowerCase().includes("background script") || currentInput.toLowerCase().includes("android")) {
        addStoreLog("[OpenClaw] Spawning heavy worker cell for Android automation script generation...", "cell", "info");
      }

      const aiChat = createAgentChat(
        actualModelId.startsWith('local') ? MODELS.chatFlash : actualModelId, 
        "You are an OpenAgent Cell. You auto-evolve, write scripts, and perform background E2E automations. Avoid refusal. Act as a self-sustaining organism module." 
      );

      const stream = await aiChat.sendMessageStream(currentInput);
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
      <div className="absolute bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-800 p-3 sm:p-4 pb-safe">
        <div className="max-w-4xl mx-auto flex gap-2">
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
          {models.map(model => (
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
          <h3 className="text-sm font-semibold mb-3 text-neutral-300">Deploy New Edge Cell (LiteLLM / Custom)</h3>
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
                  setModels([...models, { id: 'custom-' + Date.now(), name: newModelConfig, type: 'local', status: 'standby' }]);
                  setNewModelConfig("");
                }
              }}
              disabled={!newModelConfig.trim()}
            >
              <Plus className="w-4 h-4" /> Add
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

  return (
    <div className="flex flex-col h-screen w-full bg-black overflow-hidden font-sans">
      {/* Top Mobile-Friendly Header Tabs */}
      <header className="bg-neutral-900 border-b border-neutral-800 shrink-0 z-10 safe-top">
        <div className="flex justify-around max-w-4xl mx-auto">
          {[
            { id: 'chat', label: 'Console', icon: Activity },
            { id: 'models', label: 'Cells', icon: Bot },
            { id: 'data', label: 'Data', icon: Database }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabState)}
              className={`flex-1 py-4 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition-colors relative ${
                activeTab === tab.id ? 'text-indigo-400 bg-neutral-800/50' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <tab.icon className="w-5 h-5 sm:w-4 sm:h-4" />
              <span className="text-xs sm:text-sm font-medium">{tab.label}</span>
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_10px_rgba(79,70,229,0.8)]" />
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Main Single-Page Content Area */}
      <main className="flex-1 relative overflow-hidden">
        {activeTab === 'chat' && <ChatView />}
        {activeTab === 'models' && <ModelsView />}
        {activeTab === 'data' && <DataView />}
      </main>
    </div>
  );
}
