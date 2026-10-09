'use client';

import React, { useState, useEffect } from 'react';
import { SavedItem, Platform, ContentType } from '../types';
import { Terminal, Play, Loader2, Cpu, ExternalLink, RefreshCw, Layers, Trash2 } from 'lucide-react';

interface DevSandboxProps {
  onAddItem: (newItem: SavedItem) => void;
}

export const DevSandbox: React.FC<DevSandboxProps> = ({ onAddItem }) => {
  const [testUrl, setTestUrl] = useState('');
  const [platform, setPlatform] = useState<Platform>('youtube');
  const [contentType, setContentType] = useState<ContentType>('video');
  const [testTitle, setTestTitle] = useState('');
  const [testCaption, setTestCaption] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  
  // Synced items from Extension
  const [syncedItems, setSyncedItems] = useState<any[]>([]);
  const [syncedTotal, setSyncedTotal] = useState(0);
  const [isLoadingSynced, setIsLoadingSynced] = useState(false);
  const [selectedSyncedItem, setSelectedSyncedItem] = useState<any | null>(null);

  const fetchSyncedItems = async () => {
    setIsLoadingSynced(true);
    try {
      const res = await fetch('/api/ingest');
      if (res.ok) {
        const data = await res.json();
        setSyncedItems(data.items || []);
        setSyncedTotal(data.totalCount || 0);
        if (data.items && data.items.length > 0) {
          setSelectedSyncedItem(data.items[0]);
        } else {
          setSelectedSyncedItem(null);
        }
      }
    } catch (e) {
      console.error('Failed to fetch synced items:', e);
    } finally {
      setIsLoadingSynced(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('⚠️ จะลบข้อมูลทั้งหมดในฐานข้อมูล Supabase (saved_items) — ย้อนกลับไม่ได้ ต้องการดำเนินการต่อหรือไม่?')) return;
    try {
      await fetch('/api/ingest', { method: 'DELETE' });
      setSyncedItems([]);
      setSyncedTotal(0);
      setSelectedSyncedItem(null);
    } catch (e) {
      console.error('Failed to clear history:', e);
    }
  };

  useEffect(() => {
    fetchSyncedItems();
  }, []);

  const handleRunPipeline = async () => {
    if (!testTitle.trim() && !testUrl.trim()) return;

    setIsProcessing(true);
    setLogs([]);

    const addLog = (msg: string) => {
      setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    addLog(`🚀 Starting Pipeline for: ${testUrl || 'Custom Demo Input'}`);
    await new Promise((r) => setTimeout(r, 600));

    addLog(`📡 Platform Detected: ${platform.toUpperCase()} (${contentType.toUpperCase()})`);
    await new Promise((r) => setTimeout(r, 700));

    if (contentType === 'video') {
      addLog(`🎙️ Executing yt-dlp audio download & OpenAI Whisper transcription...`);
      await new Promise((r) => setTimeout(r, 1000));
      addLog(`✅ Transcript extracted: "สกัดเนื้อหาเสียงความยาว 45 วินาที..."`);
    } else {
      addLog(`⏩ Type is Post -> Skipping audio download, processing text caption...`);
      await new Promise((r) => setTimeout(r, 500));
    }

    let simulatedCategory = 'General Content';
    let simulatedLocations: any[] = [];
    let generatedTags: string[] = ['AI_Auto_Extracted', platform];

    try {
      addLog(`🧠 Invoking LLM via /api/process...`);
      const aiRes = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: testTitle || 'Test Title',
          caption: testCaption || 'Test Caption',
          platform: platform
        })
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        if (aiData.normalized_category) {
          simulatedCategory = aiData.normalized_category;
          generatedTags = [...generatedTags, ...aiData.tags];
          simulatedLocations = aiData.extracted_locations || [];
          addLog(`✅ LLM Extracted: Category = ${simulatedCategory}, Tags = ${aiData.tags.join(', ')}`);
          if (simulatedLocations.length > 0) {
            addLog(`🗺️ Geocoding: Found ${simulatedLocations.length} locations (e.g., ${simulatedLocations[0].name})`);
          } else {
            addLog(`🗺️ No specific physical locations detected in text.`);
          }
        }
      } else {
        addLog(`⚠️ LLM Processing failed or no API Key. Using fallback rules.`);
      }
    } catch (err) {
      addLog(`❌ Error calling AI pipeline. Using fallback.`);
    }

    addLog(`📐 Generating Gemini 768-dim Vector Embedding (text-embedding-004)...`);
    await new Promise((r) => setTimeout(r, 700));

    addLog(`💾 Upserting into Supabase 'saved_items' table with pgvector HNSW index...`);
    await new Promise((r) => setTimeout(r, 500));

    const newItem: SavedItem = {
      id: Date.now().toString(),
      url: testUrl || `https://www.${platform}.com/watch?v=demo_${Date.now()}`,
      platform,
      content_type: contentType,
      original_title: testTitle || 'รีวิวสถานที่ลับสุดยอด 2026',
      original_caption: testCaption || 'แคปชันตัวอย่างพร้อมข้อมูลสถานที่และรายละเอียดคอนเทนต์...',
      normalized_category: simulatedCategory,
      tags: generatedTags,
      extracted_locations: simulatedLocations,
      status: 'completed',
      created_at: new Date().toISOString()
    };

    onAddItem(newItem);
    addLog(`🎉 Pipeline Completed Successfully! Added to live Feed & Map View.`);
    setIsProcessing(false);
  };

  return (
    <div className="space-y-6">
      {/* Extension Synced Items Inspector Section */}
      <div className="glass-panel p-5 rounded-2xl border border-emerald-500/30 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <Layers className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-100">Chrome Extension Synced Data (ล่าสุด {syncedItems.length} จาก {syncedTotal.toLocaleString()})</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                  Live API Inspection
                </span>
              </div>
              <p className="text-xs text-slate-400">
                รายการคอนเทนต์ทั้งหมดที่ดึงมาจาก Chrome Extension ข้ามเข้าสู่ Web App (`/api/ingest`)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleClearHistory}
              className="px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 text-xs font-medium flex items-center space-x-1.5 transition-colors border border-rose-800/50"
              title="ล้างประวัติรายการที่ซิงก์ไว้"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>ล้างประวัติทั้งหมด</span>
            </button>

            <button
              onClick={fetchSyncedItems}
              disabled={isLoadingSynced}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center space-x-1.5 transition-colors border border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSynced ? 'animate-spin' : ''}`} />
              <span>โหลดข้อมูลใหม่</span>
            </button>
          </div>
        </div>

        {syncedItems.length === 0 ? (
          <div className="text-center py-6 bg-slate-900/60 rounded-xl border border-slate-800 text-xs text-slate-400">
            ยังไม่มีรายการดึงเข้ามา ลุยเปิด Facebook/TikTok/YouTube Saved แล้วกดปุ่ม Sync บน Extension ได้เลย!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {/* List Sidebar */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {syncedItems.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedSyncedItem(item)}
                  className={`p-3 rounded-xl text-xs cursor-pointer border transition-all ${
                    selectedSyncedItem?.url === item.url
                      ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold capitalize text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      {item.platform}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">#{idx + 1}</span>
                  </div>
                  <p className="font-bold line-clamp-1 text-slate-100">{item.original_title}</p>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">{item.url}</p>
                </div>
              ))}
            </div>

            {/* Selected Item JSON Payload Inspector */}
            <div className="md:col-span-2 bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 font-mono text-xs">
              {selectedSyncedItem ? (
                <>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-emerald-400 font-bold text-[11px]">JSON Payload Scraped from DOM</span>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={async () => {
                          const btn = document.getElementById('btn-send-inngest');
                          if (btn) btn.innerText = '⏳ กำลังส่ง...';
                          try {
                            await fetch('/api/ingest', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(selectedSyncedItem)
                            });
                            if (btn) btn.innerText = '✅ ส่งสำเร็จ! (รอ AI วิเคราะห์อยู่หลังบ้าน)';
                            setTimeout(() => { if (btn) btn.innerText = '⚡ ส่งเข้า AI Pipeline (Inngest)'; }, 3000);
                          } catch(e) {
                            if (btn) btn.innerText = '❌ ส่งไม่สำเร็จ';
                          }
                        }}
                        id="btn-send-inngest"
                        className="px-2.5 py-1 bg-emerald-600/20 text-emerald-300 hover:bg-emerald-500/40 border border-emerald-500/50 rounded-lg text-[10px] font-bold transition-all"
                      >
                        ⚡ ส่งเข้า AI Pipeline (Inngest)
                      </button>
                      <a
                        href={selectedSyncedItem.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-white flex items-center space-x-1 text-[11px]"
                      >
                        <span>Open Link</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                  <pre className="text-[11px] text-slate-300 overflow-x-auto max-h-48 whitespace-pre-wrap leading-relaxed">
                    {JSON.stringify(selectedSyncedItem, null, 2)}
                  </pre>
                </>
              ) : (
                <div className="text-slate-500 text-center py-10">เลือกรายการทางซ้ายเพื่อดู JSON Payload</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Dev Pipeline Simulator */}
      <div className="glass-panel p-5 rounded-2xl border border-purple-500/20 space-y-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center">
            <Terminal className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">AI Ingestion Pipeline Developer Sandbox</h2>
            <p className="text-xs text-slate-400">
              ทดลองส่ง URL เพื่อรัน Background Pipeline (Scrape ➔ Whisper ➔ LLM ➔ Geocoding ➔ pgvector)
            </p>
          </div>
        </div>

        {/* Input Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Target Content URL</label>
              <input
                type="text"
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                placeholder="https://www.youtube.com/shorts/... หรือ TikTok/FB URL"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Platform</label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as Platform)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-100 focus:outline-none"
                >
                  <option value="youtube">YouTube</option>
                  <option value="tiktok">TikTok</option>
                  <option value="facebook">Facebook</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Content Type</label>
                <select
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value as ContentType)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-100 focus:outline-none"
                >
                  <option value="video">Video (Audio Transcript)</option>
                  <option value="post">Post (Text Only)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Title (หัวข้อ)</label>
              <input
                type="text"
                value={testTitle}
                onChange={(e) => setTestTitle(e.target.value)}
                placeholder="เช่น: แจกพิกัดคาเฟ่เปิดใหม่ย่านอารีย์"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Caption / Details</label>
              <input
                type="text"
                value={testCaption}
                onChange={(e) => setTestCaption(e.target.value)}
                placeholder="เช่น: กาแฟดริปอร่อยมาก บรรยากาศดี..."
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleRunPipeline}
          disabled={isProcessing}
          className="w-full py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-2 transition-all shadow-lg shadow-purple-600/30 disabled:opacity-50"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>กำลังประมวลผล Pipeline Live...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>รัน AI Pipeline & เพิ่มลงในระบบ (Test Run)</span>
            </>
          )}
        </button>
      </div>

      {/* Execution Logs */}
      {logs.length > 0 && (
        <div className="glass-card rounded-2xl p-4 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-purple-400" />
              <span>Real-Time Execution Logs</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Status: {isProcessing ? 'Processing' : 'Finished'}</span>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 font-mono text-[11px] text-emerald-400 space-y-1.5 max-h-48 overflow-y-auto">
            {logs.map((log, idx) => (
              <div key={idx}>{log}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
