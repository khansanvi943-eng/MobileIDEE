import React, { useState } from 'react';
import { Search, FileText, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SearchResult {
    filePath: string;
    lineNum: string;
    content: string;
}

export const SearchPanel: React.FC = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!query.trim() || loading) return;

        setLoading(true);
        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            setResults(data.results || []);
        } catch (err) {
            console.error('Search failed:', err);
        } finally {
            setLoading(false);
        }
    };

    const highlightSearch = (text: string, q: string) => {
        if (!q) return text;
        const parts = text.split(new RegExp(`(${q})`, 'gi'));
        return (
            <span>
                {parts.map((part, i) => 
                    part.toLowerCase() === q.toLowerCase() ? 
                    <mark key={i} className="bg-yellow-500/30 text-yellow-200 px-0.5 rounded">{part}</mark> : 
                    part
                )}
            </span>
        );
    };

    return (
        <div className="flex flex-col h-full bg-neutral-950/80 text-neutral-300">
            <div className="p-3 border-b border-neutral-800 bg-neutral-900/30">
                <form onSubmit={handleSearch} className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-500" />
                    <input 
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search codebase..."
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-md pl-9 pr-3 h-9 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                    <div className="absolute right-2 top-2">
                        {loading && <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />}
                    </div>
                </form>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
                {results.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center h-48 text-neutral-600 gap-2">
                        <Search className="w-8 h-8 opacity-20" />
                        <span className="text-xs italic">No results found or search not started</span>
                    </div>
                )}
                
                <div className="space-y-4">
                    {/* Unique files with their hits */}
                    {Object.entries(
                        results.reduce((acc, res) => {
                            if (!acc[res.filePath]) acc[res.filePath] = [];
                            acc[res.filePath].push(res);
                            return acc;
                        }, {} as Record<string, SearchResult[]>)
                    ).map(([file, hits]) => (
                        <div key={file} className="space-y-1">
                            <div className="flex items-center gap-2 text-xs font-bold text-neutral-400 bg-neutral-900/50 p-1.5 rounded border border-neutral-800/50 sticky top-0">
                                <FileText className="w-3 h-3 text-indigo-400" />
                                <span>{file}</span>
                                <span className="ml-auto text-[10px] bg-neutral-800 px-1.5 rounded-full text-neutral-500">{hits.length} matches</span>
                            </div>
                            <div className="space-y-0.5 divide-y divide-neutral-900">
                                {hits.map((hit, i) => (
                                    <div key={i} className="group flex items-start gap-3 p-1.5 hover:bg-white/5 rounded transition-colors cursor-pointer">
                                        <span className="text-[10px] text-neutral-600 font-mono w-8 text-right shrink-0 mt-0.5">{hit.lineNum}</span>
                                        <code className="text-[11px] text-neutral-400 font-mono break-all line-clamp-2">
                                            {highlightSearch(hit.content, query)}
                                        </code>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
