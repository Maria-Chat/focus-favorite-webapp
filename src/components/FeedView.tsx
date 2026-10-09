'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { SavedItem, Platform, LocationItem } from '../types';
import { Search, MapPin, ExternalLink, Sparkles, Filter, Play, Tag, ChevronDown, X, Trash2, ArrowUp, MoreVertical, Edit3, Plus, Star } from 'lucide-react';

interface FeedViewProps {
  items: SavedItem[];
  onOpenMapLocation?: (lat: number, lng: number) => void;
  onItemUpdate?: (updatedItem: SavedItem) => void;
}

const TikTokEmbed = ({ url, title }: { url: string; title?: string }) => {
  const [directUrl, setDirectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVideo = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/video-url?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        if (data.directUrl) {
          setDirectUrl(data.directUrl);
        } else {
          setError(data.error || 'Failed to fetch video URL');
        }
      } catch (err: any) {
        setError(err.message || 'Network error');
      } finally {
        setLoading(false);
      }
    };
    fetchVideo();
  }, [url]);

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-black text-slate-400 space-y-4">
        <div className="w-8 h-8 border-2 border-t-transparent border-indigo-500 rounded-full animate-spin"></div>
        <p className="text-sm font-medium animate-pulse">กำลังสกัดวิดีโอจาก TikTok...</p>
      </div>
    );
  }

  if (error || !directUrl) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-black text-rose-400 p-4 text-center">
        <p className="font-semibold mb-2">ไม่สามารถโหลดวิดีโอได้</p>
        <p className="text-xs opacity-80 mb-4">{error}</p>
        <a href={url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-rose-500/20 rounded-lg text-rose-300 text-sm hover:bg-rose-500/30 transition-colors">
          เปิดดูบน TikTok
        </a>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex justify-center bg-black overflow-hidden relative group">
      <video
        src={directUrl}
        title={title || 'TikTok Video'}
        controls
        autoPlay
        playsInline
        className="w-full h-full object-contain"
        onError={() => setError('วิดีโอหมดอายุหรือไม่สามารถเล่นได้ โปรดเปิดดูต้นฉบับ')}
      />
    </div>
  );
};

export const FeedView: React.FC<FeedViewProps> = ({ items, onOpenMapLocation, onItemUpdate }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showOnlyReference, setShowOnlyReference] = useState(false);
  const [searchMode, setSearchMode] = useState<'hybrid' | 'semantic'>('hybrid');
  const [activeEmbedId, setActiveEmbedId] = useState<string | null>(null);
  
  // Client-side pagination state
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    setVisibleCount(20);
  }, [searchQuery, selectedPlatform, selectedCategory, showOnlyReference, searchMode, items]);

  const observerTarget = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => prev + 20);
        }
      },
      { rootMargin: '200px' }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    const currentTarget = observerTarget.current;
    return () => {
      if (currentTarget) observer.unobserve(currentTarget);
    };
  }, [observerTarget.current, visibleCount]);

  // Helper to extract YouTube embed URL
  const getYouTubeEmbedUrl = (url: string) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
    return match ? `https://www.youtube-nocookie.com/embed/${match[1]}?autoplay=1&rel=0` : null;
  };

  const getFacebookEmbedUrl = (url: string) => {
    if (!url) return null;
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&width=auto`;
  };

  const getTikTokEmbedUrl = (url: string) => {
    if (!url) return null;
    const match = url.match(/\/video\/(\d+)/);
    return match ? `https://www.tiktok.com/embed/v2/${match[1]}` : null;
  };

  // Extract unique categories
  // --- Manual Geocoding State ---
  const [fixingLocationItem, setFixingLocationItem] = useState<{ item: SavedItem, loc: LocationItem } | null>(null);
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [manualSearchResults, setManualSearchResults] = useState<any[]>([]);
  const [isSearchingManual, setIsSearchingManual] = useState(false);

  // Semantic Search State
  const [semanticItemIds, setSemanticItemIds] = useState<string[] | null>(null);
  const [isSearchingSemantic, setIsSearchingSemantic] = useState(false);

  // Card Menu & Edit State
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<SavedItem | null>(null);
  const [editTags, setEditTags] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    setIsSavingEdit(true);
    try {
      const newTags = editTags.split(',').map(t => t.trim()).filter(Boolean);
      const res = await fetch('/api/update-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          itemId: editingItem.id, 
          tags: newTags,
          extracted_locations: editingItem.extracted_locations,
          normalized_category: editCategory
        })
      });
      if (res.ok) {
        const updatedItem = {
          ...editingItem,
          tags: newTags,
          extracted_locations: editingItem.extracted_locations,
          normalized_category: editCategory
        };
        if (onItemUpdate) {
          onItemUpdate(updatedItem);
        }
        setEditingItem(null);
      }
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
    setIsSavingEdit(false);
  };

  const toggleReference = async (item: SavedItem) => {
    const newValue = !item.is_reference;
    // Optimistic update
    if (onItemUpdate) {
      onItemUpdate({ ...item, is_reference: newValue });
    }
    try {
      await fetch('/api/update-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, is_reference: newValue })
      });
    } catch (e) {
      // Revert on error
      if (onItemUpdate) {
        onItemUpdate({ ...item, is_reference: !newValue });
      }
      alert('เกิดข้อผิดพลาดในการบันทึก Reference');
    }
  };

  const handleManualSearch = async () => {
    if (!manualSearchQuery.trim()) return;
    setIsSearchingManual(true);

    // Check if it's a Google Maps link
    if (manualSearchQuery.includes('maps.app.goo.gl') || manualSearchQuery.includes('google.com/maps') || manualSearchQuery.includes('goo.gl/maps')) {
      try {
        const res = await fetch('/api/parse-maps-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: manualSearchQuery })
        });
        const data = await res.json();
        if (data.lat && data.lng) {
          setManualSearchResults([{
            place_id: data.place_id,
            display_name: data.name,
            name: data.name,
            lat: data.lat.toString(),
            lon: data.lng.toString()
          }]);
          setIsSearchingManual(false);
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }

    // Fallback to Google Places API
    try {
      const res = await fetch('/api/places-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: manualSearchQuery })
      });
      const data = await res.json();
      setManualSearchResults(data || []);
    } catch(e) {}
    setIsSearchingManual(false);
  };

  const handleSaveManualLocation = async (result: any) => {
    if (!fixingLocationItem) return;
    try {
      await fetch('/api/update-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: fixingLocationItem.item.id,
          placeName: fixingLocationItem.loc.name,
          newLat: parseFloat(result.lat),
          newLng: parseFloat(result.lon),
          newFormattedAddress: result.display_name,
          newPlaceId: result.place_id.toString(),
          newPlaceName: result.name || result.display_name.split(',')[0]
        })
      });
      
      // Update local state so UI reflects it immediately
      let found = false;
      const updatedLocs = fixingLocationItem.item.extracted_locations.map(l => {
        if (l.name === fixingLocationItem.loc.name) {
          found = true;
          return { ...l, name: result.name || result.display_name.split(',')[0], lat: parseFloat(result.lat), lng: parseFloat(result.lon), place_id: result.place_id.toString() };
        }
        return l;
      });
      if (!found) {
        updatedLocs.push({
          name: result.name || result.display_name.split(',')[0],
          type: 'User Added',
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          place_id: result.place_id.toString()
        });
      }
      
      const updatedItem = {
        ...fixingLocationItem.item,
        extracted_locations: updatedLocs
      };

      if (onItemUpdate) {
        onItemUpdate(updatedItem);
      } else {
        fixingLocationItem.item.extracted_locations = updatedLocs; // Fallback
      }
      
      alert('อัปเดตพิกัดสำเร็จ!');
      setFixingLocationItem(null);
      setManualSearchQuery('');
      setManualSearchResults([]);
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการบันทึกพิกัด');
    }
  };

  useEffect(() => {
    if (searchMode !== 'semantic' || !searchQuery.trim()) {
      setSemanticItemIds(null);
      setIsSearchingSemantic(false);
      return;
    }
    
    const timeout = setTimeout(async () => {
      setIsSearchingSemantic(true);
      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: searchQuery, mode: 'semantic', platform: selectedPlatform, category: selectedCategory })
        });
        const data = await res.json();
        if (data.results) {
          setSemanticItemIds(data.results.map((r: any) => r.id));
        }
      } catch (e) {}
      setIsSearchingSemantic(false);
    }, 500); // 500ms debounce

    return () => clearTimeout(timeout);
  }, [searchQuery, searchMode, selectedPlatform, selectedCategory]);

  const categories = ['all', ...Array.from(new Set(items.map((i) => i.normalized_category)))];

  const topTags = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach(item => {
      item.tags?.forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1));
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(entry => entry[0]);
  }, [items]);

  // Filter items based on query & selected filters
  const filteredItems = items.filter((item) => {
    // If semantic search is active and we have results
    if (searchMode === 'semantic' && searchQuery.trim()) {
      if (!semanticItemIds) return false; // Still loading or no results
      return semanticItemIds.includes(item.id);
    }

    const matchesPlatform = selectedPlatform === 'all' || item.platform === selectedPlatform;
    const matchesCategory = selectedCategory === 'all' || item.normalized_category === selectedCategory;
    const matchesRef = !showOnlyReference || item.is_reference;

    if (!searchQuery.trim()) return matchesPlatform && matchesCategory && matchesRef;

    const q = searchQuery.toLowerCase();
    const cleanQ = q.startsWith('#') ? q.slice(1) : q;
    
    const matchesTitle = item.original_title?.toLowerCase().includes(q) || false;
    const matchesCaption = item.original_caption?.toLowerCase().includes(q) || false;
    const matchesTags = item.tags?.some((t) => t?.toLowerCase().includes(cleanQ)) || false;
    const matchesLocation = item.extracted_locations?.some((l) => l.name?.toLowerCase().includes(q)) || false;

    return matchesPlatform && matchesCategory && matchesRef && (matchesTitle || matchesCaption || matchesTags || matchesLocation);
  });

  const getPlatformBadge = (platform: Platform) => {
    switch (platform) {
      case 'youtube':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold badge-youtube">YouTube</span>;
      case 'tiktok':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold badge-tiktok">TikTok</span>;
      case 'facebook':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold badge-facebook">Facebook</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Controls */}
      <div className="glass-panel p-4 rounded-2xl border border-white/10 space-y-3 shadow-xl">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาคอนเทนต์, ร้านอาหาร, คีย์เวิร์ด หรือความหมาย เช่น 'ร้านราเมงยามดึก'..."
            className="w-full pl-10 pr-24 py-2.5 bg-surface-dark/80 rounded-xl text-sm text-slate-100 placeholder-slate-400 border border-slate-700/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
          <div className="absolute right-2 top-2 flex items-center space-x-1">
            <button
              onClick={() => setSearchMode(searchMode === 'hybrid' ? 'semantic' : 'hybrid')}
              className={`px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center space-x-1 transition-all ${
                searchMode === 'semantic'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              title="สลับโหมด Vector Semantic Search"
            >
              <Sparkles className="w-3 h-3" />
              <span>{searchMode === 'semantic' ? 'Vector AI' : 'Hybrid'}</span>
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            
            {/* Platform Filter */}
            {(['all', 'youtube', 'tiktok', 'facebook'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPlatform(p)}
                className={`px-3 py-1 rounded-full text-xs font-medium capitalize shrink-0 transition-all ${
                  selectedPlatform === p
                    ? 'bg-slate-100 text-slate-900 font-semibold'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
              >
                {p === 'all' ? 'ทุกแพลตฟอร์ม' : p}
              </button>
            ))}
            
            {/* Reference Toggle Pill */}
            <div className="w-px h-4 bg-slate-700/50 mx-1"></div>
            <button
              onClick={() => setShowOnlyReference(!showOnlyReference)}
              className={`px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1.5 transition-all shrink-0 ${
                showOnlyReference
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : 'bg-slate-800/80 text-amber-400/80 hover:text-amber-400 hover:bg-slate-700/50 border border-amber-500/20'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${showOnlyReference ? 'fill-current' : ''}`} />
              <span>References</span>
            </button>
          </div>


        </div>

        {/* Quick Tag Filters */}
        {topTags.length > 0 && (
          <div className="flex items-center space-x-2 overflow-x-auto pt-2 border-t border-slate-800/80 scrollbar-none">
            <span className="text-[10px] text-slate-500 font-medium shrink-0 uppercase tracking-wider">Top Tags:</span>
            {topTags.map((tag) => {
              const isSelected = searchQuery === `#${tag}` || searchQuery === tag;
              return (
                <button
                  key={tag}
                  onClick={() => setSearchQuery(isSelected ? '' : `#${tag}`)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors shrink-0 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'bg-slate-800/60 text-slate-300 hover:bg-slate-700/80 border border-slate-700/50'
                  }`}
                >
                  #{tag}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Feed List */}
      {isSearchingSemantic ? (
        <div className="text-center py-16 glass-card rounded-2xl p-8 flex flex-col items-center justify-center">
          <Sparkles className="w-12 h-12 text-indigo-400 mx-auto mb-3 animate-pulse" />
          <p className="text-indigo-200 font-medium animate-pulse">กำลังใช้ AI ค้นหาความหมาย...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-16 glass-card rounded-2xl p-8">
          <Search className="w-12 h-12 text-slate-500 mx-auto mb-3 opacity-60" />
          <p className="text-slate-300 font-medium">ไม่พบคอนเทนต์ที่ค้นหา</p>
          <p className="text-xs text-slate-500 mt-1">ลองเปลี่ยนคำค้นหา หรือใช้ AI Dev Sandbox เพื่อลองเซฟคอนเทนต์ใหม่</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredItems.slice(0, visibleCount).map((item) => {
            const isPlaying = activeEmbedId === item.id;
            const ytEmbed = getYouTubeEmbedUrl(item.url);

            return (
              <div key={item.id} className="glass-card rounded-2xl p-4 flex flex-col justify-between space-y-4 relative overflow-hidden group">
                {/* Menu Buttons Group */}
                <div className="absolute top-2 right-2 z-30 flex items-center space-x-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleReference(item); }}
                    className={`p-1.5 rounded-lg border shadow-lg transition-colors ${
                      item.is_reference 
                        ? 'bg-amber-500/90 text-white border-amber-400' 
                        : 'bg-slate-950/80 hover:bg-slate-800 text-slate-400 hover:text-amber-400 border-slate-700/50'
                    }`}
                    title={item.is_reference ? "ลบออกจาก Reference" : "บันทึกเป็น Reference"}
                  >
                    <Star className={`w-4 h-4 ${item.is_reference ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === item.id ? null : item.id); }}
                    className="p-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/50 shadow-lg"
                    title="ตัวเลือกเพิ่มเติม"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>

                {openMenuId === item.id && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); }} />
                    <div className="absolute top-10 right-2 z-30 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden w-36">
                      <button onClick={(e) => { e.stopPropagation(); setEditingItem(item); setEditTags(item.tags?.join(', ') || ''); setEditCategory(item.normalized_category || 'General Content'); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center space-x-2">
                        <Edit3 className="w-4 h-4" /><span>แก้ไข (Edit)</span>
                      </button>
                      <button onClick={async (e) => {
                        e.stopPropagation();
                        setOpenMenuId(null);
                        if (confirm('คุณต้องการลบรายการนี้ใช่หรือไม่?')) {
                          try {
                            const res = await fetch('/api/delete-item', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId: item.id }) });
                            if (res.ok) window.location.reload();
                          } catch (err) {}
                        }
                      }} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-700 flex items-center space-x-2">
                        <Trash2 className="w-4 h-4" /><span>ลบรายการ</span>
                      </button>
                    </div>
                  </>
                )}

                {/* Media Container: Dynamically set aspect ratio */}
                <div className={`relative w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800 ${
                  item.platform === 'tiktok' || item.url.includes('/shorts/') || item.url.includes('/reel')
                    ? 'aspect-[9/16] max-h-[80vh] sm:max-h-[600px] object-contain'
                    : 'aspect-video'
                }`}>
                  {isPlaying ? (
                    <div className="w-full h-full relative bg-black">
                      {item.platform === 'youtube' && getYouTubeEmbedUrl(item.url) ? (
                        <iframe
                          src={getYouTubeEmbedUrl(item.url)!}
                          title={item.original_title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="w-full h-full border-0"
                        ></iframe>
                      ) : item.platform === 'facebook' && getFacebookEmbedUrl(item.url) ? (
                        <iframe
                          src={getFacebookEmbedUrl(item.url)!}
                          title={item.original_title}
                          allow="encrypted-media; picture-in-picture"
                          allowFullScreen
                          className="w-full h-full border-0 bg-black"
                        ></iframe>
                      ) : item.platform === 'tiktok' ? (
                        <TikTokEmbed url={item.url} title={item.original_title} />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-b from-slate-900 to-black space-y-2">
                          <div className="w-12 h-12 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                            <Play className="w-6 h-6 fill-current" />
                          </div>
                          <p className="text-xs font-semibold text-slate-200 line-clamp-1">{item.original_title}</p>
                          <p className="text-[10px] text-slate-400">เล่นวิดีโอผ่าน {item.platform.toUpperCase()} Player</p>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1 px-3 py-1 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-medium transition-colors"
                          >
                            <span>เปิดดูบนแอป {item.platform.toUpperCase()}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                      {/* Close Player Button */}
                      <button
                        onClick={() => setActiveEmbedId(null)}
                        className="absolute top-2 right-2 z-20 w-7 h-7 rounded-full bg-slate-950/80 backdrop-blur-md text-white border border-slate-700 flex items-center justify-center hover:bg-slate-800 transition-colors"
                        title="ปิดวิดีโอ"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    /* Thumbnail View Mode */
                    <div
                      className={`relative w-full h-full group/thumb ${item.content_type === 'video' ? 'cursor-pointer' : ''}`}
                      onClick={() => item.content_type === 'video' ? setActiveEmbedId(item.id) : null}
                    >
                      {item.thumbnail_url ? (
                        <img
                          src={item.thumbnail_url}
                          alt={item.original_title}
                          className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-tr from-slate-900 to-indigo-950 flex items-center justify-center p-4 text-center">
                           <p className="text-slate-400 text-sm font-medium line-clamp-3">{item.original_caption}</p>
                        </div>
                      )}

                      {/* Play Button Overlay (Only for videos) */}
                      {item.content_type === 'video' && (
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/30 flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-lg shadow-indigo-600/50 transform group-hover/thumb:scale-110 transition-transform">
                            <Play className="w-5 h-5 fill-current ml-0.5" />
                          </div>
                        </div>
                      )}

                      {/* Top Badges over Thumbnail */}
                      <div className="absolute top-2.5 left-2.5 flex items-center space-x-2 z-10">
                        {getPlatformBadge(item.platform)}
                        <span className="text-[10px] font-semibold text-indigo-200 bg-slate-950/80 backdrop-blur-md border border-indigo-500/30 px-2.5 py-0.5 rounded-full">
                          {item.normalized_category}
                        </span>
                      </div>

                      <span suppressHydrationWarning className="absolute bottom-2.5 right-2.5 text-[10px] text-slate-300 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded-md font-mono">
                        {new Date(item.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Title & Caption */}
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold text-slate-100 line-clamp-2 leading-snug group-hover:text-indigo-300 transition-colors">
                    {item.original_title}
                  </h3>
                  <p className="text-xs text-slate-300/80 line-clamp-2 leading-relaxed">
                    {item.original_caption}
                  </p>
                </div>

                {/* Extracted Locations (if available) */}
                {item.extracted_locations.length > 0 && (
                  <div className="bg-slate-900/60 border border-emerald-500/20 rounded-xl p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-emerald-400 font-medium">
                      <span className="flex items-center space-x-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                        <span>พิกัดสถานที่จาก AI ({item.extracted_locations.length})</span>
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {item.extracted_locations.map((loc, idx) => {
                        const isMissingCoords = loc.place_id && (loc.place_id.startsWith('dummy_') || loc.place_id === 'failed_geocoding' || loc.place_id === 'no_api_key');
                        return (
                          <span
                            key={idx}
                            onClick={() => {
                              if (isMissingCoords) {
                                setFixingLocationItem({ item, loc });
                                setManualSearchQuery(loc.name);
                                setManualSearchResults([]);
                              } else if (onOpenMapLocation && loc.lat !== undefined && loc.lng !== undefined) {
                                onOpenMapLocation(loc.lat, loc.lng);
                              }
                            }}
                            className={`text-[11px] border px-2 py-1 rounded-md cursor-pointer flex items-center space-x-1.5 transition-colors ${
                              isMissingCoords
                                ? 'bg-orange-950/70 hover:bg-orange-900 text-orange-300 border-orange-500/50 shadow-[0_0_10px_rgba(249,115,22,0.15)]'
                                : 'bg-emerald-950/50 hover:bg-emerald-900/80 text-emerald-200 border-emerald-700/40'
                            }`}
                            title={isMissingCoords ? 'หาพิกัดไม่พบ คลิกเพื่อแก้ไขพิกัด' : ''}
                          >
                            <span>{isMissingCoords ? '⚠️ หาพิกัดไม่พบ:' : '📍'}</span>
                            <span className={isMissingCoords ? 'font-semibold underline decoration-orange-500/50 underline-offset-2' : ''}>
                              {loc.name}
                            </span>
                            {isMissingCoords && (
                              <span className="ml-1 px-1.5 py-0.5 bg-orange-500/20 rounded text-[9px] font-bold">FIX</span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tags */}
                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.tags.map((tag, idx) => (
                      <span key={idx} className="text-[10px] text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-md flex items-center space-x-1">
                        <Tag className="w-2.5 h-2.5 text-slate-500" />
                        <span>#{tag}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Card Action Footer */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  {item.content_type === 'video' ? (
                    <button
                      onClick={() => setActiveEmbedId(isPlaying ? null : item.id)}
                      className="flex items-center space-x-1.5 text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{isPlaying ? 'ปิดตัวเล่นวิดีโอ' : 'เล่นวิดีโอตรงนี้'}</span>
                    </button>
                  ) : (
                    <span className="text-slate-500 font-medium flex items-center space-x-1.5">
                      <Tag className="w-3.5 h-3.5" />
                      <span>Text / Image Post</span>
                    </span>
                  )}

                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 text-slate-400 hover:text-white transition-colors"
                  >
                    <span>Open Original</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
          
        {/* Infinite Scroll Observer Target */}
        {visibleCount < filteredItems.length && (
          <div ref={observerTarget} className="w-full h-24 flex items-center justify-center col-span-1 md:col-span-2 mt-4">
             <div className="flex items-center space-x-2 text-slate-400">
               <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
               <span className="text-sm font-medium">กำลังโหลดเพิ่ม...</span>
             </div>
          </div>
        )}
      </>
      )}

      {/* Back to Top Button */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-6 right-6 p-3 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-colors z-40 flex items-center justify-center hover:-translate-y-1"
        title="กลับไปบนสุด"
      >
        <ArrowUp className="w-5 h-5" />
      </button>

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-5 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <Edit3 className="w-5 h-5 text-indigo-400" />
                <span>แก้ไขข้อมูลรายการ</span>
              </h3>
              <button onClick={() => setEditingItem(null)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">หมวดหมู่หลัก</label>
                <select
                  value={editCategory}
                  onChange={e => setEditCategory(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  {['Food & Cafe', 'Travel', 'Tech & Knowledge', 'Entertainment', 'Shopping', 'Lifestyle', 'General Content'].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Tags (คั่นด้วยลูกน้ำ)</label>
                <input 
                  type="text" 
                  value={editTags}
                  onChange={e => setEditTags(e.target.value)}
                  placeholder="เช่น Cafe, โคราช, AI, ของกิน"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">พิกัดสถานที่</label>
                <div className="space-y-2">
                  {editingItem.extracted_locations.map((loc, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-800/50 border border-slate-700 rounded-lg p-2.5">
                      <span className="text-sm text-slate-200">{loc.name}</span>
                      <button 
                        onClick={() => {
                          const newLocs = [...editingItem.extracted_locations];
                          newLocs.splice(idx, 1);
                          setEditingItem({ ...editingItem, extracted_locations: newLocs });
                        }}
                        className="text-red-400 hover:text-red-300 p-1"
                        title="ลบพิกัดนี้"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button 
                    onClick={() => {
                      setFixingLocationItem({ 
                        item: editingItem, 
                        loc: { name: 'ค้นหาสถานที่ใหม่', type: 'User Added', place_id: 'dummy', lat: 0, lng: 0 } as any 
                      });
                      setEditingItem(null);
                      setManualSearchQuery('');
                      setManualSearchResults([]);
                    }}
                    className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 border-dashed rounded-lg p-2.5 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>ค้นหาและเพิ่มพิกัดใหม่ทันที</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">* เมื่อกดเพิ่มพิกัดใหม่ ระบบจะพาไปหน้าค้นหาสถานที่เพื่อบันทึกลงการ์ดทันที</p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
              <button 
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
              >
                ยกเลิก
              </button>
              <button 
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isSavingEdit ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Geocoding Modal */}
      {fixingLocationItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                  <span>แก้ไขพิกัด:</span>
                  <span className="text-orange-400">{fixingLocationItem.loc.name}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-1">จากโพสต์: {fixingLocationItem.item.original_title}</p>
              </div>
              <button onClick={() => setFixingLocationItem(null)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-3">
              <div className="flex space-x-2">
                <input 
                  type="text" 
                  value={manualSearchQuery}
                  onChange={e => setManualSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleManualSearch()}
                  placeholder="พิมพ์ชื่อร้าน หรือ วางลิงก์ Google Maps ที่นี่"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
                <button 
                  onClick={handleManualSearch}
                  disabled={isSearchingManual}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isSearchingManual ? 'ค้นหา...' : 'ค้นหา'}
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {manualSearchResults.length === 0 && !isSearchingManual ? (
                  <p className="text-center text-sm text-slate-500 py-6">ยังไม่มีผลการค้นหา ลองพิมพ์ชื่อร้านกว้างๆ เช่น "ราเมง บรรทัดทอง"</p>
                ) : (
                  manualSearchResults.map((res: any, idx: number) => (
                    <div key={idx} className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-xl p-3 flex flex-col items-start text-left w-full transition-colors group">
                      <div className="flex justify-between w-full items-start space-x-3">
                        <div className="flex-1 pr-3">
                          <p className="text-sm font-semibold text-indigo-300 line-clamp-1">{res.name || res.display_name.split(',')[0]}</p>
                          <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-snug">{res.display_name}</p>
                        </div>
                        <button 
                          onClick={() => handleSaveManualLocation(res)}
                          className="shrink-0 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                        >
                          บันทึกพิกัดนี้
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
