'use client';

import React from 'react';
import { BookmarkCheck, MapPin, Sparkles, Terminal, Puzzle } from 'lucide-react';

interface NavigationProps {
  activeTab: 'feed' | 'map' | 'sandbox' | 'extension';
  setActiveTab: (tab: 'feed' | 'map' | 'sandbox' | 'extension') => void;
  totalSavedCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab, totalSavedCount }) => {
  return (
    <header className="sticky top-0 z-40 glass-panel border-b border-surface-border/50">
      <div className="max-w-4xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('feed')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <BookmarkCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
              Focus Favorite
            </h1>
            <p className="text-xs text-slate-400 flex items-center space-x-1">
              <span>Second Brain</span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[10px] text-emerald-400 font-mono">({totalSavedCount} Saved)</span>
            </p>
          </div>
        </div>

        {/* Tab Buttons (Scrollable on mobile) */}
        <nav className="flex items-center space-x-1.5 bg-surface-dark/60 p-1.5 rounded-xl border border-white/5 overflow-x-auto scrollbar-none w-full sm:w-auto mt-3 sm:mt-0">
          <button
            onClick={() => setActiveTab('feed')}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium shrink-0 transition-all ${
              activeTab === 'feed'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="inline">Feed</span>
          </button>

          <button
            onClick={() => setActiveTab('map')}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium shrink-0 transition-all ${
              activeTab === 'map'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span className="inline">Map View</span>
          </button>

          <button
            onClick={() => setActiveTab('sandbox')}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium shrink-0 transition-all ${
              activeTab === 'sandbox'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-purple-300" />
            <span className="inline">Sandbox</span>
          </button>

          <button
            onClick={() => setActiveTab('extension')}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium shrink-0 transition-all ${
              activeTab === 'extension'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Puzzle className="w-3.5 h-3.5 text-emerald-300" />
            <span className="inline">Extension</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
