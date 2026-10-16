'use client';

import React, { useState, useEffect } from 'react';
import { 
  BookmarkCheck, 
  MapPin, 
  Sparkles, 
  Puzzle, 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  X, 
  Play, 
  ExternalLink 
} from 'lucide-react';

export type QueueStatusData = {
  total: number;
  completed: number;
  pending: number;
  error: number;
  status: 'idle' | 'processing' | 'stalled';
  oldestPendingMinutes: number;
  updatedAt: string;
};

interface NavigationProps {
  activeTab: 'feed' | 'map' | 'extension';
  setActiveTab: (tab: 'feed' | 'map' | 'extension') => void;
  totalSavedCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab, totalSavedCount }) => {
  const [queueStatus, setQueueStatus] = useState<QueueStatusData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryResult, setRetryResult] = useState<string | null>(null);

  const fetchQueueStatus = async () => {
    try {
      const res = await fetch('/api/queue-status');
      if (res.ok) {
        const data = await res.json();
        setQueueStatus(data);
      }
    } catch (e) {
      console.error('Failed to fetch queue status:', e);
    }
  };

  useEffect(() => {
    fetchQueueStatus();

    // Auto refresh status every 8s if there's pending work, otherwise every 45s
    const interval = setInterval(() => {
      fetchQueueStatus();
    }, queueStatus?.pending && queueStatus.pending > 0 ? 8000 : 45000);

    return () => clearInterval(interval);
  }, [queueStatus?.pending]);

  const handleRetryPending = async () => {
    setIsRetrying(true);
    setRetryResult(null);
    try {
      const res = await fetch('/api/retry-pending');
      const data = await res.json();
      if (res.ok) {
        setRetryResult(data.message || 'ส่งคิวเข้าประมวลผลต่อเรียบร้อยแล้ว');
        await fetchQueueStatus();
      } else {
        setRetryResult(`เกิดข้อผิดพลาด: ${data.error || 'ไม่สามารถสั่งรันต่อได้'}`);
      }
    } catch (e: any) {
      setRetryResult(`เกิดข้อผิดพลาดในการเชื่อมต่อ: ${e.message}`);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 glass-panel border-b border-surface-border/50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Brand Logo & Status */}
          <div className="flex items-center space-x-3">
            <div 
              className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 cursor-pointer"
              onClick={() => setActiveTab('feed')}
            >
              <BookmarkCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 
                  className="text-lg font-bold bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent cursor-pointer"
                  onClick={() => setActiveTab('feed')}
                >
                  Focus Favorite
                </h1>

                {/* AI / Queue Status Indicator Pill */}
                {queueStatus && (
                  <button
                    onClick={() => {
                      setRetryResult(null);
                      setIsModalOpen(true);
                    }}
                    title="คลิกเพื่อดูสถานะคิว AI และสุขภาพระบบ"
                    className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-all ${
                      queueStatus.status === 'stalled'
                        ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 hover:bg-rose-500/25'
                        : queueStatus.status === 'processing'
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25 animate-pulse'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                    }`}
                  >
                    {queueStatus.status === 'stalled' ? (
                      <>
                        <AlertTriangle className="w-3 h-3 text-rose-400" />
                        <span>AI ติดขัด ({queueStatus.pending || queueStatus.error})</span>
                      </>
                    ) : queueStatus.status === 'processing' ? (
                      <>
                        <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                        <span>AI กำลังรัน ({queueStatus.pending})</span>
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        <span>AI พร้อม</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <p className="text-xs text-slate-400 flex items-center space-x-1.5">
                <span>Second Brain</span>
                <span className="text-[10px] text-slate-500">•</span>
                <span className="text-[11px] text-slate-300 font-mono">
                  {queueStatus ? queueStatus.completed : totalSavedCount} Saved
                </span>
              </p>
            </div>
          </div>

          {/* Tab Buttons (Feed, Map View, Extension) */}
          <nav className="flex items-center space-x-1.5 bg-surface-dark/60 p-1.5 rounded-xl border border-white/5 overflow-x-auto scrollbar-none w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('feed')}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-medium shrink-0 transition-all ${
                activeTab === 'feed'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Feed</span>
            </button>

            <button
              onClick={() => setActiveTab('map')}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-medium shrink-0 transition-all ${
                activeTab === 'map'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Map View</span>
            </button>

            <button
              onClick={() => setActiveTab('extension')}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-medium shrink-0 transition-all ${
                activeTab === 'extension'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Puzzle className="w-3.5 h-3.5 text-emerald-300" />
              <span>Extension</span>
            </button>
          </nav>
        </div>
      </header>

      {/* AI Queue Status & Health Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 text-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className={`p-2 rounded-xl ${
                  queueStatus?.status === 'stalled'
                    ? 'bg-rose-500/20 text-rose-400'
                    : queueStatus?.status === 'processing'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {queueStatus?.status === 'stalled' ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : queueStatus?.status === 'processing' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">สถานะคิว AI & ระบบ</h3>
                  <p className="text-xs text-slate-400">Background Worker (Inngest + Gemini)</p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status Grid Cards */}
            <div className="grid grid-cols-3 gap-3 my-5">
              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 text-center">
                <span className="block text-xs text-slate-400 mb-1">สำเร็จแล้ว</span>
                <span className="text-lg font-bold text-emerald-400 font-mono">
                  {queueStatus?.completed ?? 0}
                </span>
              </div>

              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 text-center">
                <span className="block text-xs text-slate-400 mb-1">รอประมวลผล</span>
                <span className={`text-lg font-bold font-mono ${
                  (queueStatus?.pending ?? 0) > 0 ? 'text-amber-400' : 'text-slate-400'
                }`}>
                  {queueStatus?.pending ?? 0}
                </span>
              </div>

              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 text-center">
                <span className="block text-xs text-slate-400 mb-1">ผิดพลาด</span>
                <span className={`text-lg font-bold font-mono ${
                  (queueStatus?.error ?? 0) > 0 ? 'text-rose-400' : 'text-slate-400'
                }`}>
                  {queueStatus?.error ?? 0}
                </span>
              </div>
            </div>

            {/* Diagnostic Message */}
            <div className={`p-3.5 rounded-xl border text-xs leading-relaxed mb-5 ${
              queueStatus?.status === 'stalled'
                ? 'bg-rose-950/40 border-rose-800/60 text-rose-200'
                : queueStatus?.status === 'processing'
                ? 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                : 'bg-emerald-950/30 border-emerald-800/50 text-emerald-200'
            }`}>
              {queueStatus?.status === 'stalled' ? (
                <>
                  <p className="font-semibold text-rose-300 mb-1">⚠️ คิวค้างเกิน 15 นาที หรือเกิดข้อผิดพลาด</p>
                  <p>
                    อาจเกิดจากเครดิต Gemini ใน Google AI Studio หมด หรือติด Rate Limit ชั่วคราว เมื่อเติมเครดิตแล้ว คุณสามารถกดปุ่มสั่งรันต่อด้านล่างได้ทันที
                  </p>
                </>
              ) : queueStatus?.status === 'processing' ? (
                <>
                  <p className="font-semibold text-amber-300 mb-1">⚡ กำลังประมวลผลคอนเทนต์อย่างต่อเนื่อง</p>
                  <p>
                    AI กำลังถอดเสียงและสกัดพิกัดสถานที่ทีละชิ้นตามรอบความปลอดภัย (~8–10 วินาที/รายการ)
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-emerald-300 mb-1">🟢 ระบบพร้อมทำงาน 100%</p>
                  <p>ไม่มีรายการค้างในคิว คุณสามารถเปิดหน้า Facebook หรือ TikTok เพื่อกด Sync ข้อมูลเพิ่มได้ทันที</p>
                </>
              )}
            </div>

            {/* Retry Result Alert */}
            {retryResult && (
              <div className="p-3 mb-4 rounded-xl bg-indigo-950/50 border border-indigo-800/60 text-indigo-200 text-xs">
                {retryResult}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center space-x-2 pt-2 border-t border-slate-800">
              <button
                onClick={handleRetryPending}
                disabled={isRetrying || (queueStatus?.pending === 0 && queueStatus?.error === 0)}
                className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isRetrying || (queueStatus?.pending === 0 && queueStatus?.error === 0)
                    ? 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                }`}
              >
                {isRetrying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>กำลังสั่งรัน...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>สั่งรันคิวต่อ (Retry Pending)</span>
                  </>
                )}
              </button>

              <button
                onClick={() => fetchQueueStatus()}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                title="รีเฟรชข้อมูลสถานะ"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
