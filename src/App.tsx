import React from 'react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { Workspace } from './Workspace';
import { Button } from '@/components/ui/button';
import { Code } from 'lucide-react';

function AuthScreen() {
  const { signIn } = useAuth();
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(79,70,229,0.5)]">
            <Code className="w-10 h-10 text-white" />
          </div>
        </div>
        <div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight">Antigravity IDE</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Unrestricted Context. Unbound Agents.
          </p>
        </div>
        <div className="pt-8">
          <Button onClick={signIn} className="w-full group relative flex justify-center py-6 px-4 border border-transparent text-sm font-medium rounded-xl text-black bg-white hover:bg-neutral-200">
            Sign in to initialize
          </Button>
        </div>
      </div>
    </div>
  );
}

function MainLayout() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white font-mono animate-pulse">BOOTING...</div>;
  if (!user) return <AuthScreen />;
  return <Workspace />;
}

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}
