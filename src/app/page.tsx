'use client';

import React, { useState, useEffect } from 'react';
import { Navigation } from '../components/Navigation';
import { FeedView } from '../components/FeedView';
import dynamic from 'next/dynamic';
const MapView = dynamic(() => import('../components/MapView').then(mod => mod.MapView), { ssr: false });
import { DevSandbox } from '../components/DevSandbox';
import { ExtensionGuide } from '../components/ExtensionGuide';
import { INITIAL_MOCK_ITEMS } from '../lib/mockData';
import { SavedItem } from '../types';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'feed' | 'map' | 'sandbox' | 'extension'>('feed');
  const [targetMapLocation, setTargetMapLocation] = useState<{lat: number, lng: number} | null>(null);
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingBackground, setIsFetchingBackground] = useState(false);

  const PAGE_SIZE = 500;
  const [hasMore, setHasMore] = useState(true);

  // Fetch processed items from Supabase via /api/search
  const fetchPersistedItems = async (offset = 0) => {
    try {
      if (offset === 0) setIsLoading(true);
      else setIsFetchingBackground(true);
      
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_count: PAGE_SIZE, offset })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.results) {
          if (offset === 0) {
            setSavedItems(data.results);
          } else {
            setSavedItems(prev => [...prev, ...data.results]);
          }
          if (data.results.length < PAGE_SIZE) {
            setHasMore(false);
          }
        }
      } else {
        // Prevent infinite loop on API error
        setHasMore(false);
      }
    } catch (e) {
      console.error('Failed to load synced items:', e);
      setHasMore(false);
    } finally {
      if (offset === 0) setIsLoading(false);
      else setIsFetchingBackground(false);
    }
  };

  const handleLoadMore = () => {
    fetchPersistedItems(savedItems.length);
  };

  // Auto-fetch remaining items in the background to ensure client-side filtering has all data
  useEffect(() => {
    if (savedItems.length > 0 && hasMore && !isLoading && !isFetchingBackground) {
      fetchPersistedItems(savedItems.length);
    }
  }, [savedItems.length, hasMore, isLoading, isFetchingBackground]);

  useEffect(() => {
    fetchPersistedItems();

    // Check if there is a URL parameter for map location
    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view');
    const lat = urlParams.get('lat');
    const lng = urlParams.get('lng');
    
    if (view === 'map' && lat && lng) {
      setTargetMapLocation({ lat: parseFloat(lat), lng: parseFloat(lng) });
      setActiveTab('map');
    }
  }, []);

  const handleAddItem = (newItem: SavedItem) => {
    setSavedItems((prev) => [newItem, ...prev]);
  };

  const handleUpdateItem = (updatedItem: SavedItem) => {
    setSavedItems(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0f19]">
      {/* Header Bar */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        totalSavedCount={savedItems.length}
      />

      {/* Main App Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex flex-col justify-center items-center h-64 space-y-4">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 font-medium animate-pulse">กำลังโหลดข้อมูลล่าสุด...</p>
          </div>
        ) : (
          <>
            {activeTab === 'feed' && (
              <div className="space-y-6">
                <FeedView
                  items={savedItems}
                  onOpenMapLocation={(lat, lng) => {
                    setTargetMapLocation({ lat, lng });
                    setActiveTab('map');
                  }}
                  onItemUpdate={handleUpdateItem}
                />
                {hasMore && (
                  <div className="flex justify-center pb-8">
                    <button 
                      onClick={handleLoadMore}
                      disabled={isFetchingBackground}
                      className={`px-6 py-2.5 font-medium rounded-xl transition-colors border shadow-lg ${
                        isFetchingBackground 
                          ? 'bg-slate-800/50 text-slate-500 border-slate-800 cursor-not-allowed'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 hover:border-slate-600 shadow-slate-900/50'
                      }`}
                    >
                      {isFetchingBackground ? 'กำลังโหลดข้อมูลเบื้องหลัง...' : 'โหลดข้อมูลเพิ่มเติม...'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'map' && (
              <MapView items={savedItems} targetLocation={targetMapLocation} onItemUpdate={handleUpdateItem} />
            )}
          </>
        )}

        {activeTab === 'sandbox' && (
          <DevSandbox onAddItem={handleAddItem} />
        )}

        {activeTab === 'extension' && (
          <ExtensionGuide />
        )}
      </main>

      {/* Subtle Footer */}
      <footer className="py-6 border-t border-slate-900 text-center text-xs text-slate-500">
        <p>Focus Favorite — Second Brain for Social Media Saved Content</p>
        <p className="text-[11px] text-slate-600 mt-1">Built with Next.js 14, Supabase pgvector, OpenAI Whisper & Gemini AI</p>
      </footer>
    </div>
  );
}
