import { ResearchService } from "./researchService";
import { CellCreator, CellConfig } from "./cellCreator";
import { GoogleGenAI } from "@google/genai";
import { v4 as uuidv4 } from "uuid";

export interface OrchestrationStep {
  id: string;
  type: "research" | "chunking" | "cell_creation" | "network_injection" | "execution" | "synthesis";
  status: "pending" | "running" | "completed" | "failed";
  details: string;
}

export interface CellExecution {
  id: string;
  config: CellConfig;
  task: string;
  status: "queued" | "injecting" | "running" | "completed" | "failed";
  memorySnapshot?: string; // Information inherited from network
  result?: string;
}

export class OrchestratorService {
  private research: ResearchService;
  private creator: CellCreator;
  private ai: GoogleGenAI;
  private centralKnowledge: string = ""; // Accumulator of all cell learnings
  private contextKeeperActive: boolean = false;

  public onUpdate?: (steps: OrchestrationStep[], executions: CellExecution[]) => void;

  constructor(apiKey?: string) {
    this.research = new ResearchService(apiKey);
    this.creator = new CellCreator(apiKey);
    this.ai = new GoogleGenAI({ apiKey: apiKey || (process as any).env.GEMINI_API_KEY });
  }

  async runFullStack(prompt: string, localMode: boolean = false) {
    const steps: OrchestrationStep[] = [
      { id: "1", type: "research", status: localMode ? "completed" : "pending", details: localMode ? "Skipped (Local Mode)" : "Deep web research" },
      { id: "2", type: "chunking", status: "pending", details: "Context splitting" },
      { id: "3", type: "cell_creation", status: "pending", details: "Allocation" },
      { id: "4", type: "network_injection", status: "pending", details: "OpenAgents Network Entry" },
      { id: "5", type: "execution", status: "pending", details: "Parallel processing" },
      { id: "6", type: "synthesis", status: "pending", details: "Final integration" },
    ];
    let executions: CellExecution[] = [];

    const notify = () => this.onUpdate?.([...steps], [...executions]);

    try {
      // 1. Research
      let deepContext = "";
      if (!localMode) {
        steps[0].status = "running";
        notify();
        deepContext = await this.research.gatherDeepContext(prompt);
        steps[0].status = "completed";
        steps[0].details = `Found ${deepContext.length} chars of context.`;
      } else {
        deepContext = "LOCAL CONTEXT ONLY: Web research disabled by user preference.";
      }
      notify();

      // 2. Chunking
      steps[1].status = "running";
      notify();
      const chunks = await this.research.chunkContext(deepContext);
      steps[1].status = "completed";
      steps[1].details = `Split into ${chunks.length} task quantas.`;
      notify();

      // 3. Cell Creation
      steps[2].status = "running";
      notify();
      for (const chunk of chunks) {
        const config = await this.creator.createIntelligentCell(chunk);
        executions.push({
          id: uuidv4(),
          config,
          task: chunk,
          status: "queued"
        });
      }
      steps[2].status = "completed";
      notify();

      // 4. Network Injection & Inherited Knowledge
      steps[3].status = "running";
      notify();
      await this.injectToNetwork(executions, notify);
      steps[3].status = "completed";
      notify();

      // 5. Parallel Execution (Simulated)
      steps[4].status = "running";
      notify();
      // Parallelize up to 3 at a time
      const results = await this.parallelExecute(executions, notify);
      steps[4].status = "completed";
      notify();

      // 6. Synthesis
      steps[5].status = "running";
      notify();
      const finalOutput = await this.synthesize(prompt, results);
      steps[5].status = "completed";
      notify();

      return finalOutput;

    } catch (error: any) {
      console.error("[Orchestrator] Fatal error:", error);
      const isNetworkError = error?.message?.includes('fetch') || error?.message?.includes('network');
      const isQuotaError = error?.message?.includes('429') || error?.message?.includes('Quota');
      const isAuthError = error?.message?.includes('permission') || error?.message?.includes('403');

      let specificError = error?.message || "Unknown system failure.";
      if (isNetworkError) specificError = "Network connection lost. Mesh synchronization failed.";
      if (isQuotaError) specificError = "Resource quota exceeded. Rate limiting active on cloud gateway.";
      if (isAuthError) specificError = "Missing or insufficient permissions. Secure handshake failed.";

      steps.forEach(s => { 
        if (s.status === "running" || s.status === "pending") {
           s.status = s.status === "running" ? "failed" : s.status;
           if (s.status === "failed") s.details = `ERROR: ${specificError}`;
        }
      });
      notify();
      throw new Error(specificError);
    }
  }

  private async injectToNetwork(executions: CellExecution[], notify: () => void) {
    console.log("[OpenAgents] Publishing current cell mesh to distributed network hub...");
    
    for (const exec of executions) {
      exec.status = "injecting";
      notify();
      
      // If knowledge base is large (simulated), trigger Context Keeper
      if (this.centralKnowledge.length > 5000) {
        this.contextKeeperActive = true;
      }

      // Distill context for the incoming cell
      exec.memorySnapshot = await this.distillContext(this.centralKnowledge, exec.task);
      
      // Simulation of injection latency
      await new Promise(r => setTimeout(r, 500));
      exec.status = "queued";
      notify();
    }
  }

  private async distillContext(knowledge: string, task: string): Promise<string> {
    if (!knowledge) return "Network Fresh: No prior context.";
    
    // Call AI to act as Context Keeper
    const response = await this.ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are the Network Context Keeper. 
      The central knowledge base contains: ${knowledge}
      A new cell is entering to perform: ${task}
      Synthesize only the required technical details and previous findings this cell needs to avoid redundant work.`,
      config: {
        systemInstruction: "You are a context distiller for an AI multi-agent network. Be ultra-concise."
      }
    });

    return response.text || "Distillation failed.";
  }

  private async parallelExecute(executions: CellExecution[], notify: () => void): Promise<string[]> {
    const results: string[] = [];
    
    const batchSize = 3;
    for (let i = 0; i < executions.length; i += batchSize) {
      const batch = executions.slice(i, i + batchSize);
      await Promise.all(batch.map(async exec => {
        exec.status = "running";
        notify();
        
        await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));
        
        exec.status = "completed";
        exec.result = `[${exec.config.framework}] Task: ${exec.task.slice(0, 30)} | Knowledge Absorbed: ${exec.memorySnapshot?.slice(0, 30)}...`;
        
        // Accumulate learning back to central knowledge
        this.centralKnowledge += `\n- Learned from ${exec.config.framework}: ${exec.result}`;
        
        // Persist successful configuration in knowledge base
        await this.creator.rememberSuccessfulCell(exec.task, exec.config);
        
        results.push(exec.result);
        notify();
      }));
    }
    
    return results;
  }

  private async synthesize(originalPrompt: string, cellOutputs: string[]): Promise<string> {
    const prompt = `Synthesize the following outputs from multiple specialized AI cells into a final response. 
    Original Task: ${originalPrompt}
    
    Cell Outputs:
    ${cellOutputs.map((o, i) => `[Cell ${i+1}] ${o}`).join('\n')}
    
    Provide:
    1. A series of actions taken.
    2. Artifacts successfully generated.
    3. Code created and executed (include Python or React snippets if applicable).
    4. A concise text explanation of the collective outcome.`;

    const response = await this.ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt
    });

    return response.text || "Synthesis failed.";
  }
}
