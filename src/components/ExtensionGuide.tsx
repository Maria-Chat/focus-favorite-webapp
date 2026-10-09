'use client';

import React, { useState } from 'react';
import { Puzzle, Download, CheckCircle2, ShieldCheck, ArrowRight, ExternalLink, Code } from 'lucide-react';

export const ExtensionGuide: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const manifestSnippet = `{
  "manifest_version": 3,
  "name": "Focus Favorite - Social Media Saved Content Collector",
  "version": "1.0.0",
  "description": "Auto collect and sync saved posts from TikTok, YouTube, and Facebook.",
  "permissions": ["storage", "activeTab"],
  "host_permissions": [
    "https://www.youtube.com/*",
    "https://www.tiktok.com/*",
    "https://www.facebook.com/*"
  ],
  "content_scripts": [
    {
      "matches": [
        "https://www.youtube.com/*",
        "https://www.tiktok.com/*",
        "https://www.facebook.com/*"
      ],
      "js": ["content.js"]
    }
  ]
}`;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="glass-panel p-6 rounded-2xl border border-emerald-500/20 space-y-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto">
          <Puzzle className="w-7 h-7 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-100">Chrome Extension (Manifest V3)</h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
            ส่วนขยาย Chrome สำหรับดูดคอนเทนต์ในหน้า Saved / Watch Later ของ YouTube, TikTok และ Facebook แล้วยิงเข้า API โดยอัตโนมัติ
          </p>
        </div>
      </div>

      {/* Step by Step Guide */}
      <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-5">
        <h3 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>วิธีการใช้งาน Chrome Extension:</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2">
            <span className="w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-400 font-bold flex items-center justify-center">1</span>
            <h4 className="font-bold text-slate-200">เข้าหน้า Saved บน Desktop</h4>
            <p className="text-slate-400">เปิดหน้า Saved/Favorites ของ TikTok, YouTube Playlist หรือ Facebook บน Chrome</p>
          </div>

          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2">
            <span className="w-6 h-6 rounded-full bg-purple-600/30 text-purple-400 font-bold flex items-center justify-center">2</span>
            <h4 className="font-bold text-slate-200">Extension ทำ DOM Scraping</h4>
            <p className="text-slate-400">Extension ดึง URL, Title, และ Full Caption พร้อมเช็ก History ป้องกันรายการซ้ำ</p>
          </div>

          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2">
            <span className="w-6 h-6 rounded-full bg-emerald-600/30 text-emerald-400 font-bold flex items-center justify-center">3</span>
            <h4 className="font-bold text-slate-200">ส่ง Batch ไปยัง Web App</h4>
            <p className="text-slate-400">ข้อมูลถูกส่งเข้า Backend Route Handler เพื่อรัน Inngest AI Pipeline ในภูมิหลัง</p>
          </div>
        </div>

        {/* Code Preview */}
        <div className="pt-2">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="flex items-center space-x-1 font-mono">
              <Code className="w-3.5 h-3.5" />
              <span>chrome-extension/manifest.json</span>
            </span>
          </div>
          <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
            {manifestSnippet}
          </pre>
        </div>
      </div>
    </div>
  );
};
