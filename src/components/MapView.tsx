'use client';

import React, { useState, useEffect } from 'react';
import { SavedItem, LocationItem } from '../types';
import { MapPin, Navigation, Sparkles, ExternalLink, Edit3, X, Trash2, Plus, Search } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet's default icon path issues in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Create a custom active icon
const activeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const defaultIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const dummyIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface MapViewProps {
  items: SavedItem[];
  targetLocation?: { lat: number; lng: number } | null;
  onItemUpdate?: (updatedItem: SavedItem) => void;
}

// Helper component to recenter map when selected pin changes
const MapRecenter = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 14, { animate: true });
  }, [center, map]);
  return null;
};

const CurrentLocationControl = () => {
  const map = useMap();
  const [locating, setLocating] = useState(false);

  const handleLocate = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        map.flyTo([latitude, longitude], 14, { animate: true });
        
        // Add a temporary pulsing circle for current location
        const radius = pos.coords.accuracy || 100;
        L.circle([latitude, longitude], {
          radius: radius > 1000 ? 500 : radius,
          color: '#6366f1',
          fillColor: '#818cf8',
          fillOpacity: 0.2,
          weight: 2
        }).addTo(map);

        setLocating(false);
      },
      (err) => {
        alert('ไม่สามารถดึงตำแหน่งปัจจุบันได้ กรุณาเปิดสิทธิ์ Location');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  return (
    <div className="absolute bottom-6 right-4 z-[400]">
      <button 
        onClick={handleLocate}
        disabled={locating}
        className="bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/30 p-3 rounded-full shadow-[0_0_15px_rgba(79,70,229,0.3)] transition-colors group flex items-center justify-center backdrop-blur-md"
        title="ไปที่ตำแหน่งปัจจุบันของฉัน"
      >
        <Navigation className={`w-5 h-5 text-white ${locating ? 'animate-pulse' : 'group-hover:scale-110 transition-transform'}`} />
      </button>
    </div>
  );
};

export const MapView: React.FC<MapViewProps> = ({ items, targetLocation, onItemUpdate }) => {
  const [isMounted, setIsMounted] = useState(false);
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  
  // Edit & Location State
  const [editingItem, setEditingItem] = useState<SavedItem | null>(null);
  const [editTags, setEditTags] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  
  const [fixingLocationItem, setFixingLocationItem] = useState<{ item: SavedItem, loc: LocationItem } | null>(null);
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [manualSearchResults, setManualSearchResults] = useState<any[]>([]);
  const [isSearchingManual, setIsSearchingManual] = useState(false);

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

  const handleManualSearch = async () => {
    if (!manualSearchQuery.trim()) return;
    setIsSearchingManual(true);

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

    try {
      const res = await fetch('/api/places-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: manualSearchQuery })
      });
      const data = await res.json();
      if (data.results) {
        setManualSearchResults(data.results);
      }
    } catch (e) {
      console.error(e);
    }
    setIsSearchingManual(false);
  };

  const handleSaveManualLocation = async (place: any) => {
    if (!fixingLocationItem) return;
    try {
      const updatedLocations = [...fixingLocationItem.item.extracted_locations];
      const index = updatedLocations.findIndex(l => l.name === fixingLocationItem.loc.name);
      const newLoc: LocationItem = {
        name: place.name || place.display_name.split(',')[0],
        type: 'User Fixed',
        place_id: place.place_id,
        lat: parseFloat(place.lat),
        lng: parseFloat(place.lon)
      };
      
      if (index >= 0) {
        updatedLocations[index] = newLoc;
      } else {
        updatedLocations.push(newLoc);
      }

      const res = await fetch('/api/update-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: fixingLocationItem.item.id,
          extracted_locations: updatedLocations
        })
      });

      if (res.ok) {
        const updatedItem = { ...fixingLocationItem.item, extracted_locations: updatedLocations };
        if (onItemUpdate) {
          onItemUpdate(updatedItem);
        }
        setFixingLocationItem(null);
      }
    } catch (e) {
      alert('บันทึกพิกัดล้มเหลว');
    }
  };
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Extract all locations into flat array paired with item context
  const allLocations = React.useMemo(() => {
    const locs: Array<{ location: LocationItem; item: SavedItem }> = [];
    
    // Filter items first
    const filteredItems = items.filter(item => {
      if (!mapSearchQuery.trim()) return true;
      const q = mapSearchQuery.toLowerCase();
      const cleanQ = q.startsWith('#') ? q.slice(1) : q;
      
      const matchTitle = item.original_title?.toLowerCase().includes(q) || false;
      const matchCaption = item.original_caption?.toLowerCase().includes(q) || false;
      const matchTags = item.tags?.some(t => t?.toLowerCase().includes(cleanQ)) || false;
      const matchLocs = item.extracted_locations?.some(l => l.name?.toLowerCase().includes(q)) || false;
      
      return matchTitle || matchCaption || matchTags || matchLocs;
    });

    filteredItems.forEach((item) => {
      if (item.extracted_locations) {
        item.extracted_locations.forEach((loc) => {
          if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
            locs.push({ location: loc, item });
          }
        });
      }
    });
    return locs;
  }, [items, mapSearchQuery]);

  const [selectedPin, setSelectedPin] = useState<{ location: LocationItem; item: SavedItem } | null>(null);

  useEffect(() => {
    if (targetLocation && allLocations.length > 0) {
      // Find the exact pin using a small epsilon to avoid floating point mismatch
      const target = allLocations.find(l => 
        Math.abs(Number(l.location.lat) - Number(targetLocation.lat)) < 0.0001 && 
        Math.abs(Number(l.location.lng) - Number(targetLocation.lng)) < 0.0001
      );
      if (target) {
        setSelectedPin(target);
      } else {
        setSelectedPin(allLocations[0] || null);
      }
    } else if (allLocations.length > 0 && !selectedPin) {
      setSelectedPin(allLocations[0]);
    }
  }, [targetLocation, allLocations]);

  if (!isMounted) return <div className="h-[520px] w-full bg-slate-900 rounded-2xl animate-pulse"></div>;

  return (
    <div className="space-y-4">
      {/* Search Bar for Map */}
      <div className="glass-panel p-3 rounded-2xl border border-white/10 shadow-lg">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={mapSearchQuery}
            onChange={(e) => setMapSearchQuery(e.target.value)}
            placeholder="ค้นหาสถานที่ หรือคอนเทนต์เพื่อกรองพิกัดบนแผนที่..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface-dark/80 rounded-xl text-sm text-slate-100 placeholder-slate-400 border border-slate-700/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>
      </div>

      {/* Main Map Split Container */}
      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-5 lg:h-[520px]">
        {/* Real Map Canvas */}
        <div className="h-[300px] sm:h-[400px] lg:h-full lg:col-span-2 rounded-2xl border border-slate-800 relative overflow-hidden bg-slate-900 flex z-0 shrink-0">
          <MapContainer 
            center={
              selectedPin
                ? [selectedPin.location.lat, selectedPin.location.lng]
                : [13.7563, 100.5018]
            } 
            zoom={12} 
            scrollWheelZoom={true} 
            className="w-full h-full z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {allLocations.map((entry, idx) => {
              const isSelected = selectedPin?.location.name === entry.location.name;
              const isMissingCoords = entry.location.place_id && (entry.location.place_id.startsWith('dummy_') || entry.location.place_id === 'failed_geocoding' || entry.location.place_id === 'no_api_key');
              
              // Only render marker if lat/lng are actual numbers
              if (typeof entry.location.lat !== 'number' || typeof entry.location.lng !== 'number') {
                return null;
              }
              return (
                <Marker
                  key={idx}
                  position={[Number(entry.location.lat), Number(entry.location.lng)]}
                  icon={isSelected ? activeIcon : (isMissingCoords ? dummyIcon : defaultIcon)}
                  eventHandlers={{
                    click: () => setSelectedPin(entry),
                  }}
                />
              );
            })}
            {selectedPin && <MapRecenter center={[selectedPin.location.lat, selectedPin.location.lng]} />}
            <CurrentLocationControl />
          </MapContainer>
        </div>

        {/* Selected Location Detail Info Drawer */}
        <div className="glass-card rounded-2xl p-5 border border-slate-800 flex flex-col justify-between space-y-4 relative z-10">
          {selectedPin ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2.5 py-0.5 rounded-full">
                  {selectedPin.location.type || 'Location Detail'}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {selectedPin.location.lat.toFixed(4)}, {selectedPin.location.lng.toFixed(4)}
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-100 mb-1 flex items-center space-x-2">
                  <span>{selectedPin.location.name}</span>
                </h3>
                
                {selectedPin.location.place_id && (selectedPin.location.place_id.startsWith('dummy_') || selectedPin.location.place_id === 'failed_geocoding' || selectedPin.location.place_id === 'no_api_key') ? (
                  <div className="mt-2 inline-flex items-center space-x-1.5 bg-orange-950/60 border border-orange-500/40 text-orange-400 text-[11px] px-2.5 py-1 rounded-md">
                    <span className="font-bold">⚠️ หาพิกัดไม่พบ:</span>
                    <span>กรุณาไปที่ Feed เพื่อแก้ไขพิกัด</span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {selectedPin.location.formatted_address || 'Bangkok, Thailand'}
                  </p>
                )}
              </div>

              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="text-[11px] text-indigo-400 font-medium flex items-center space-x-1">
                  <Sparkles className="w-3 h-3" />
                  <span>ที่มาจากคอนเทนต์ที่คุณเซฟไว้:</span>
                </div>
                <h4 className="text-xs font-semibold text-slate-200 line-clamp-2">
                  {selectedPin.item.original_title}
                </h4>
                <p className="text-[11px] text-slate-400 line-clamp-3">
                  {selectedPin.item.original_caption}
                </p>
              </div>

              <div className="pt-2 flex flex-col space-y-2">
                <div className="flex space-x-2">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedPin.location.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-xl flex items-center justify-center space-x-2 transition-colors shadow-lg shadow-emerald-600/20"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>เปิดในgoogle map</span>
                  </a>
                  <a
                    href={selectedPin.item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl flex items-center justify-center space-x-2 transition-colors shadow-lg shadow-indigo-600/20"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>ดูคลิปต้นฉบับ</span>
                  </a>
                </div>
                <button
                  onClick={() => {
                    setEditingItem(selectedPin.item);
                    setEditTags(selectedPin.item.tags?.join(', ') || '');
                    setEditCategory(selectedPin.item.normalized_category || 'General Content');
                  }}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-xl flex items-center justify-center space-x-2 transition-colors border border-slate-700"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>แก้ไขข้อมูล / เพิ่มพิกัด</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-slate-500 text-xs">
              เลือกหมุดบนแผนที่เพื่อดูรายละเอียดและโพสต์ต้นทาง
            </div>
          )}
        </div>
      </div>

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
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
                  {editingItem.extracted_locations && editingItem.extracted_locations.map((loc, idx) => (
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
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
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
                          <p className="text-sm font-semibold text-indigo-300 line-clamp-1">{res.name || res.display_name?.split(',')[0]}</p>
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
