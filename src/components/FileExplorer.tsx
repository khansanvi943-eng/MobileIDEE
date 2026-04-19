import React, { useState, useEffect } from 'react';
import { Folder, File, ChevronRight, ChevronDown, Plus, Trash2, Edit2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FileItem {
    name: string;
    isDirectory: boolean;
    path: string;
}

export const FileExplorer: React.FC = () => {
    const [items, setItems] = useState<FileItem[]>([]);
    const [currentPath, setCurrentPath] = useState('.');
    const [loading, setLoading] = useState(false);

    const fetchItems = async (path: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/fs/ls?path=${encodeURIComponent(path)}`);
            const data = await res.json();
            if (data.items) {
                setItems(data.items);
                setCurrentPath(path);
            }
        } catch (err) {
            console.error('Failed to fetch files:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems('.');
    }, []);

    const handleCreate = async (type: 'file' | 'dir') => {
        const name = prompt(`Enter ${type} name:`);
        if (!name) return;
        const filePath = `${currentPath === '.' ? '' : currentPath + '/'}${name}`;
        
        try {
            if (type === 'file') {
                await fetch('/api/fs/write', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filePath, content: '' })
                });
            } else {
                // Directories created via write with trailing slash in some systems, 
                // but our API handles mkdirp. Let's just write a dummy file or add a mkdir endpoint.
                // For now, let's assume write handles directory creation.
                await fetch('/api/fs/write', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filePath: `${filePath}/.gitkeep`, content: '' })
                });
            }
            fetchItems(currentPath);
        } catch (err) {
            alert('Failed to create item');
        }
    };

    const handleDelete = async (item: FileItem) => {
        if (!confirm(`Delete ${item.name}?`)) return;
        try {
            await fetch('/api/fs/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: item.path, isDirectory: item.isDirectory })
            });
            fetchItems(currentPath);
        } catch (err) {
            alert('Delete failed');
        }
    };

    const handleRename = async (item: FileItem) => {
        const newName = prompt(`Rename ${item.name} to:`, item.name);
        if (!newName || newName === item.name) return;
        
        const oldPath = item.path;
        const newPath = `${currentPath === '.' ? '' : currentPath + '/'}${newName}`;
        
        try {
            await fetch('/api/fs/rename', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldPath, newPath })
            });
            fetchItems(currentPath);
        } catch (err) {
            alert('Rename failed');
        }
    };

    return (
        <div className="flex flex-col h-full bg-neutral-950/50 text-neutral-300 border-r border-neutral-800">
            <div className="p-3 border-b border-neutral-800 flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-500">Explorer</span>
                <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleCreate('file')} title="New File">
                        <File className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleCreate('dir')} title="New Folder">
                        <Folder className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => fetchItems(currentPath)} title="Refresh">
                        <RefreshCw className="w-3 h-3" />
                    </Button>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
                <div className="flex items-center text-[10px] text-neutral-500 mb-2 truncate px-1">
                    {currentPath === '.' ? 'ROOT' : currentPath}
                </div>
                
                {loading ? (
                    <div className="flex justify-center p-4">
                        <RefreshCw className="w-4 h-4 animate-spin text-neutral-600" />
                    </div>
                ) : (
                    <div className="space-y-0.5">
                        {currentPath !== '.' && (
                            <div 
                                onClick={() => fetchItems(currentPath.split('/').slice(0, -1).join('/') || '.')}
                                className="flex items-center gap-2 p-1 hover:bg-neutral-800/50 rounded cursor-pointer text-xs text-neutral-500"
                            >
                                <ChevronRight className="w-3 h-3 rotate-180" /> ..
                            </div>
                        )}
                        {items.map((item) => (
                            <div 
                                key={item.path}
                                className="group flex items-center justify-between p-1 hover:bg-neutral-800 rounded cursor-pointer transition-colors"
                            >
                                <div 
                                    className="flex items-center gap-2 flex-1"
                                    onClick={() => item.isDirectory ? fetchItems(item.path) : null}
                                >
                                    {item.isDirectory ? (
                                        <Folder className="w-3 h-3 text-indigo-400 fill-indigo-400/20" />
                                    ) : (
                                        <File className="w-3 h-3 text-neutral-500" />
                                    )}
                                    <span className={`text-xs truncate ${item.isDirectory ? 'font-medium' : ''}`}>
                                        {item.name}
                                    </span>
                                </div>
                                
                                <div className="hidden group-hover:flex gap-1 items-center">
                                    <Button variant="ghost" size="icon" className="h-4 w-4 text-neutral-600 hover:text-white" onClick={() => handleRename(item)} title="Rename">
                                        <Edit2 className="w-2.5 h-2.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-4 w-4 text-neutral-600 hover:text-red-400" onClick={() => handleDelete(item)} title="Delete">
                                        <Trash2 className="w-2.5 h-2.5" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
