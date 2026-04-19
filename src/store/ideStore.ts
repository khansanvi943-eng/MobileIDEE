import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export type LogEntry = {
    id: string;
    timestamp: number;
    message: string;
    level: 'info' | 'error' | 'warning' | 'success';
    source: 'system' | 'orchestrator' | 'cloud' | 'cell' | 'bloodstream';
};

export type ScheduledTask = {
    id: string;
    prompt: string;
    priority: 'low' | 'medium' | 'high';
    deadline?: number;
    isRecurring: boolean;
    cron?: string;
    status: 'pending' | 'working' | 'completed' | 'failed';
    assignedTo?: string; // Cell ID
    context?: string; // Shared context between cells
    intermediateSteps?: string[];
    createdAt: number;
};

export type RuntimeFix = {
    id: string;
    timestamp: number;
    description: string;
    resolution: string;
};

export type CodeSnippet = {
    id: string;
    name: string;
    content: string;
    category: string;
    usageCount: number;
    lastUsed?: number;
};

export type AutoSaveSettings = {
    enabled: boolean;
    interval: number; // in milliseconds
    strategy: 'onFocusLoss' | 'interval';
};

export type DownloadedModel = {
    id: string;
    name: string;
    version: string;
    size: string;
    path: string;
    type: 'tflite' | 'lite-rt' | 'onnx';
    isLoaded: boolean;
};

interface IdeState {
    logs: LogEntry[];
    activeModes: string[];
    systemLoad: number;
    thinkingLevel: 'low' | 'medium' | 'high';
    preferences: {
        preferLocal: boolean;
        costSaving: boolean;
        maxCloudLoad: number;
    };
    tasks: ScheduledTask[];
    runtimeFixes: RuntimeFix[];
    snippets: CodeSnippet[];
    autoSave: AutoSaveSettings;
    downloadedModels: DownloadedModel[];
    selectedModelId: string | 'auto';
    
    // Actions
    addLog: (message: string, source?: LogEntry['source'], level?: LogEntry['level']) => void;
    toggleMode: (mode: string) => void;
    setActiveModes: (modes: string[]) => void;
    setSystemLoad: (load: number | ((prev: number) => number)) => void;
    setThinkingLevel: (level: 'low' | 'medium' | 'high') => void;
    updatePreferences: (prefs: Partial<IdeState['preferences']>) => void;
    
    // Task scheduler
    addTask: (task: Omit<ScheduledTask, 'id' | 'createdAt' | 'status'>) => void;
    updateTask: (id: string, updates: Partial<ScheduledTask>) => void;
    shareContext: (taskId: string, newContext: string, step?: string) => void;
    
    addRuntimeFix: (fix: Omit<RuntimeFix, 'id' | 'timestamp'>) => void;
    
    // Snippets
    addSnippet: (snippet: Omit<CodeSnippet, 'id' | 'usageCount'>) => void;
    useSnippet: (id: string) => void;
    deleteSnippet: (id: string) => void;
    
    // AutoSave
    updateAutoSave: (settings: Partial<AutoSaveSettings>) => void;

    // Models
    addDownloadedModel: (model: DownloadedModel) => void;
    setSelectedModel: (id: string | 'auto') => void;
    toggleModelLoad: (id: string) => void;
}

export const useIdeStore = create<IdeState>((set) => ({
    logs: [
        { id: uuidv4(), timestamp: Date.now(), message: '[System] Antigravity IDE Initialized.', source: 'system', level: 'info' },
        { id: uuidv4(), timestamp: Date.now(), message: '[Orchestrator] Ready to orchestrate cells & cloud resources.', source: 'orchestrator', level: 'success' }
    ],
    activeModes: ['text'],
    systemLoad: 15,
    thinkingLevel: 'high',
    preferences: {
        preferLocal: false,
        costSaving: false,
        maxCloudLoad: 80,
    },
    tasks: [],
    runtimeFixes: [],
    snippets: [
        { id: '1', name: 'React Typed Memo', content: 'const Component = React.memo(({ children }: Props) => {\n  return <div>{children}</div>;\n});', category: 'React', usageCount: 0 },
        { id: '2', name: 'Zustand Selector', content: 'const value = useStore((s) => s.value);', category: 'State', usageCount: 0 }
    ],
    autoSave: {
        enabled: true,
        interval: 300000, // 5 mins
        strategy: 'interval'
    },
    downloadedModels: [
        { id: 'edge-watcher-100m', name: 'Watcher Cell (Edge Gallery 100M)', version: '1.0', size: '120MB', path: '/models/watcher-100m.tflite', type: 'tflite', isLoaded: true },
        { id: 'edge-fixer-7b', name: 'Autonomous Fixer (Open Source 7B)', version: 'latest', size: '4.2GB', path: '/models/fixer-uncensored-7b.gguf', type: 'lite-rt', isLoaded: false },
        { id: 'edge-1', name: 'LiteRT-Gemma-2b', version: '1.2.0', size: '1.4GB', path: '/models/gemma2b.tflite', type: 'tflite', isLoaded: true },
        { id: 'edge-2', name: 'LiteRT-Phi-3', version: '2.0.0', size: '2.1GB', path: '/models/phi3.tflite', type: 'tflite', isLoaded: false }
    ],
    selectedModelId: 'auto',

    addLog: (message, source = 'system', level = 'info') => set((state) => ({
        logs: [...state.logs, { id: uuidv4(), timestamp: Date.now(), message, source, level }]
    })),
    
    toggleMode: (mode) => set((state) => {
        if (state.activeModes.includes(mode)) {
            return { activeModes: state.activeModes.length > 1 ? state.activeModes.filter(m => m !== mode) : state.activeModes };
        }
        return { activeModes: [...state.activeModes, mode] };
    }),

    setActiveModes: (modes) => set({ activeModes: modes }),

    setSystemLoad: (load) => set((state) => ({
        systemLoad: typeof load === 'function' ? load(state.systemLoad) : load
    })),

    setThinkingLevel: (level) => set({ thinkingLevel: level }),

    updatePreferences: (prefs) => set((state) => ({
        preferences: { ...state.preferences, ...prefs }
    })),

    addTask: (taskInfo) => set((state) => ({
        tasks: [...state.tasks, { ...taskInfo, id: uuidv4(), status: 'pending', createdAt: Date.now() }]
    })),

    updateTask: (id, updates) => set((state) => ({
        tasks: state.tasks.map(t => t.id === id ? { ...t, ...updates } : t)
    })),
    
    shareContext: (taskId, newContext, step) => set((state) => ({
        tasks: state.tasks.map(t => {
            if (t.id === taskId) {
                const intermediateSteps = step ? [...(t.intermediateSteps || []), step] : t.intermediateSteps;
                const context = newContext ? (t.context ? t.context + '\n' + newContext : newContext) : t.context;
                return { ...t, context, intermediateSteps };
            }
            return t;
        })
    })),
    
    addRuntimeFix: (fix) => set((state) => ({
        runtimeFixes: [...state.runtimeFixes, { ...fix, id: uuidv4(), timestamp: Date.now() }]
    })),

    addSnippet: (snippet) => set((state) => ({
        snippets: [...state.snippets, { ...snippet, id: uuidv4(), usageCount: 0 }]
    })),

    useSnippet: (id) => set((state) => ({
        snippets: state.snippets.map(s => s.id === id ? { ...s, usageCount: s.usageCount + 1, lastUsed: Date.now() } : s)
    })),

    deleteSnippet: (id) => set((state) => ({
        snippets: state.snippets.filter(s => s.id !== id)
    })),

    updateAutoSave: (settings) => set((state) => ({
        autoSave: { ...state.autoSave, ...settings }
    })),

    addDownloadedModel: (model) => set((state) => ({
        downloadedModels: [...state.downloadedModels, model]
    })),

    setSelectedModel: (id) => set({ selectedModelId: id }),

    toggleModelLoad: (id) => set((state) => ({
        downloadedModels: state.downloadedModels.map(m => m.id === id ? { ...m, isLoaded: !m.isLoaded } : m)
    }))
}));
