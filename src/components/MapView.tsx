'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { SavedItem, LocationItem } from '../types';
import { MapPin, Navigation, Sparkles, ExternalLink, Edit3, X, Trash2, Plus, Search, Maximize2 } from 'lucide-react';
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

// Custom marker icons
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

export type LocationClusterEntry = {
  key: string;
  location: LocationItem;
  items: SavedItem[];
};


// Controller component to smoothly handle map viewport adjustments
const MapController: React.FC<{
  fitBoundsRequest: { bounds: L.LatLngBounds; id: number } | null;
  flyToTarget: { lat: number; lng: number; id: number } | null;
}> = ({ fitBoundsRequest, flyToTarget }) => {
  const map = useMap();
  const lastFitBoundsId = useRef<number | null>(null);
  const lastFlyToId = useRef<number | null>(null);

  useEffect(() => {
    if (fitBoundsRequest && fitBoundsRequest.id !== lastFitBoundsId.current) {
      lastFitBoundsId.current = fitBoundsRequest.id;
      map.fitBounds(fitBoundsRequest.bounds, { padding: [50, 50], maxZoom: 15, animate: true });
    }
  }, [fitBoundsRequest, map]);

  useEffect(() => {
    if (flyToTarget && flyToTarget.id !== lastFlyToId.current) {
      lastFlyToId.current = flyToTarget.id;
      map.flyTo([flyToTarget.lat, flyToTarget.lng], 14, { animate: true });
    }
  }, [flyToTarget, map]);

  return null;
};

// Helper to read cached user location from sessionStorage
const getCachedLocation = (): [number, number] | null => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = sessionStorage.getItem('focus_user_last_location');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
        return [parsed.lat, parsed.lng];
      }
    }
  } catch (_) {}
  return null;
};

const CurrentLocationControl: React.FC<{
  autoLocate?: boolean;
}> = ({ autoLocate = false }) => {
  const map = useMap();
  const [locating, setLocating] = useState(false);
  const userLayersRef = useRef<L.Layer[]>([]);
  const hasAutoLocatedRef = useRef(false);

  const performLocate = useCallback((isManual: boolean) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      if (isManual) alert('เบราว์เซอร์นี้ไม่รองรับ Geolocation');
      return;
    }

    setLocating(true);

    const onSuccess = (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = pos.coords;

      try {
        sessionStorage.setItem('focus_user_last_location', JSON.stringify({ lat: latitude, lng: longitude }));
      } catch (_) {}

      map.flyTo([latitude, longitude], 14, { animate: true });

      // Clean up previous location markers
      userLayersRef.current.forEach(layer => {
        try { map.removeLayer(layer); } catch (_) {}
      });
      userLayersRef.current = [];

      const radius = accuracy || 100;
      const circle = L.circle([latitude, longitude], {
        radius: radius > 1000 ? 500 : radius,
        color: '#6366f1',
        fillColor: '#818cf8',
        fillOpacity: 0.18,
        weight: 1.5
      }).addTo(map);

      // Distinct center dot for current location (Google Maps style)
      const dot = L.circleMarker([latitude, longitude], {
        radius: 7,
        color: '#ffffff',
        fillColor: '#4f46e5',
        fillOpacity: 1,
        weight: 2.5
      }).addTo(map);

      userLayersRef.current = [circle, dot];
      setLocating(false);
    };

    const onFinalError = (err: GeolocationPositionError) => {
      setLocating(false);
      if (!isManual) {
        console.warn('Auto-locate on mount could not determine location:', err.message);
        return;
      }
      let msg = 'ไม่สามารถดึงตำแหน่งปัจจุบันได้';
      if (!window.isSecureContext) {
        msg += ' — เบราว์เซอร์อนุญาต Location เฉพาะเว็บ HTTPS กรุณาเปิดผ่านลิงก์ https://';
      } else if (err.code === err.PERMISSION_DENIED) {
        msg += ' — กรุณาอนุญาตสิทธิ์ Location ให้เว็บนี้ในเบราว์เซอร์';
      } else if (err.code === err.TIMEOUT) {
        msg += ' — หาตำแหน่งไม่ทันเวลา ลองใหม่อีกครั้ง (หรือออกไปที่โล่ง/เปิด WiFi)';
      } else {
        msg += ' — กรุณาเปิด GPS/Location ในเครื่อง';
      }
      alert(msg);
    };

    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) return onFinalError(err);
        navigator.geolocation.getCurrentPosition(onSuccess, onFinalError, {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 5 * 60 * 1000,
        });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60 * 1000 }
    );
  }, [map]);

  // Clean up layers on unmount
  useEffect(() => {
    return () => {
      userLayersRef.current.forEach(layer => {
        try { map.removeLayer(layer); } catch (_) {}
      });
      userLayersRef.current = [];
    };
  }, [map]);

  // Auto-locate on initial mount if requested
  useEffect(() => {
    if (autoLocate && !hasAutoLocatedRef.current) {
      hasAutoLocatedRef.current = true;
      performLocate(false);
    }
  }, [autoLocate, performLocate]);

  const handleLocate = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    performLocate(true);
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
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Map Navigation triggers
  const [fitBoundsRequest, setFitBoundsRequest] = useState<{ bounds: L.LatLngBounds; id: number } | null>(null);
  const [flyToTarget, setFlyToTarget] = useState<{ lat: number; lng: number; id: number } | null>(null);

  // Compute initial center: targetLocation -> cached location -> default (Bangkok)
  const initialCenter = useMemo<[number, number]>(() => {
    if (targetLocation && typeof targetLocation.lat === 'number' && typeof targetLocation.lng === 'number') {
      return [Number(targetLocation.lat), Number(targetLocation.lng)];
    }
    const cached = getCachedLocation();
    if (cached) return cached;
    return [13.7563, 100.5018];
  }, [targetLocation]);

  const initialZoom = targetLocation ? 14 : (getCachedLocation() ? 13 : 11);

  // Progressive rendering for high-result queries
  const [visibleCount, setVisibleCount] = useState(40);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  // Card element refs for two-way scroll synchronization
  const cardDesktopRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const cardMobileRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const isProgrammaticScrollRef = useRef(false);
  const programmaticTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mobileCardObserverRef = useRef<IntersectionObserver | null>(null);

  // Edit & Location State
  const [editingItem, setEditingItem] = useState<SavedItem | null>(null);
  const [editTags, setEditTags] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  
  const [fixingLocationItem, setFixingLocationItem] = useState<{ item: SavedItem, loc: LocationItem } | null>(null);
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [manualSearchResults, setManualSearchResults] = useState<any[]>([]);
  const [isSearchingManual, setIsSearchingManual] = useState(false);

  // Debounce search query input (300ms)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchQuery(mapSearchQuery);
    }, 300);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [mapSearchQuery]);

  const isSearching = Boolean(debouncedSearchQuery.trim());

  const handleClearSearch = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setMapSearchQuery('');
    setDebouncedSearchQuery('');
  }, []);

  const handleSearchSubmit = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setDebouncedSearchQuery(mapSearchQuery);
  }, [mapSearchQuery]);

  // Extract & cluster filtered locations (group multiple items at the same location)
  const allLocations = useMemo<LocationClusterEntry[]>(() => {
    const q = debouncedSearchQuery.trim().toLowerCase();
    const cleanQ = q.startsWith('#') ? q.slice(1) : q;
    
    const filteredItems = items.filter(item => {
      if (!q) return true;
      const matchTitle = item.original_title?.toLowerCase().includes(q) || false;
      const matchCaption = item.original_caption?.toLowerCase().includes(q) || false;
      const matchTags = item.tags?.some(t => t?.toLowerCase().includes(cleanQ)) || false;
      const matchLocs = item.extracted_locations?.some(l => l.name?.toLowerCase().includes(q)) || false;
      return matchTitle || matchCaption || matchTags || matchLocs;
    });

    const clusterMap = new Map<string, LocationClusterEntry>();

    filteredItems.forEach((item) => {
      if (!item.extracted_locations) return;

      item.extracted_locations.forEach((loc) => {
        if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return;

        // Grouping key: place_id if known, otherwise coordinate grid + place name
        let clusterKey: string;
        if (loc.place_id && !loc.place_id.startsWith('dummy_') && loc.place_id !== 'failed_geocoding' && loc.place_id !== 'no_api_key') {
          clusterKey = `place:${loc.place_id}`;
        } else {
          clusterKey = `coord:${loc.lat.toFixed(4)},${loc.lng.toFixed(4)}:${(loc.name || '').trim().toLowerCase()}`;
        }

        const existing = clusterMap.get(clusterKey);
        if (existing) {
          if (!existing.items.some(i => i.id === item.id)) {
            existing.items.push(item);
          }
        } else {
          clusterMap.set(clusterKey, {
            key: clusterKey,
            location: loc,
            items: [item]
          });
        }
      });
    });

    return Array.from(clusterMap.values());
  }, [items, debouncedSearchQuery]);

  const [selectedPin, setSelectedPin] = useState<LocationClusterEntry | null>(null);

  // Set programmatic scroll lock to prevent feedback loop
  const triggerProgrammaticScroll = useCallback(() => {
    isProgrammaticScrollRef.current = true;
    if (programmaticTimerRef.current) clearTimeout(programmaticTimerRef.current);
    programmaticTimerRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 700);
  }, []);

  // Ensure card element is within visible count if selecting beyond page
  const ensurePinVisible = useCallback((entry: LocationClusterEntry) => {
    const index = allLocations.findIndex(l => l.key === entry.key);
    if (index >= visibleCount) {
      setVisibleCount(Math.min(index + 20, allLocations.length));
    }
  }, [allLocations, visibleCount]);

  // Scroll to card in desktop or mobile container
  const scrollToCard = useCallback((key: string) => {
    triggerProgrammaticScroll();
    const desktopEl = cardDesktopRefs.current.get(key);
    if (desktopEl) {
      desktopEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    const mobileEl = cardMobileRefs.current.get(key);
    if (mobileEl) {
      mobileEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [triggerProgrammaticScroll]);

  // Marker click handler: selects pin, centers map, and scrolls card into view
  const handleMarkerClick = useCallback((entry: LocationClusterEntry) => {
    setSelectedPin(entry);
    setFlyToTarget({ lat: entry.location.lat, lng: entry.location.lng, id: Date.now() });
    ensurePinVisible(entry);
    setTimeout(() => {
      scrollToCard(entry.key);
    }, 60);
  }, [ensurePinVisible, scrollToCard]);

  // Card click handler: selects pin and flies map to it
  const handleCardClick = useCallback((entry: LocationClusterEntry) => {
    setSelectedPin(entry);
    setFlyToTarget({ lat: entry.location.lat, lng: entry.location.lng, id: Date.now() });
    scrollToCard(entry.key);
  }, [scrollToCard]);

  // Fit all results handler
  const handleFitAllResults = useCallback(() => {
    if (allLocations.length === 0) return;
    const validCoords = allLocations
      .filter(l => typeof l.location.lat === 'number' && typeof l.location.lng === 'number')
      .map(l => [l.location.lat, l.location.lng] as [number, number]);
    if (validCoords.length > 0) {
      const bounds = L.latLngBounds(validCoords);
      setFitBoundsRequest({ bounds, id: Date.now() });
    }
  }, [allLocations]);

  // Handle search query results change: fitBounds to all found points
  useEffect(() => {
    setVisibleCount(40);
    if (isSearching && allLocations.length > 0) {
      handleFitAllResults();
    }
  }, [isSearching, debouncedSearchQuery, handleFitAllResults]);

  // Initial & Target location handling, maintaining selected pin on search clear
  useEffect(() => {
    if (targetLocation && allLocations.length > 0) {
      const target = allLocations.find(l => 
        Math.abs(Number(l.location.lat) - Number(targetLocation.lat)) < 0.0001 && 
        Math.abs(Number(l.location.lng) - Number(targetLocation.lng)) < 0.0001
      );
      if (target) {
        setSelectedPin(target);
        setFlyToTarget({ lat: target.location.lat, lng: target.location.lng, id: Date.now() });
      }
      return;
    }

    if (allLocations.length > 0) {
      // Keep selected pin if still visible in current filter
      const stillVisible = selectedPin && allLocations.some(l => l.key === selectedPin.key);
      if (!stillVisible) {
        if (isSearching) {
          setSelectedPin(allLocations[0]);
        }
      }
    }
  }, [targetLocation, allLocations, isSearching]);

  // IntersectionObserver for mobile cards carousel swipe sync
  useEffect(() => {
    if (!isSearching) return;

    mobileCardObserverRef.current = new IntersectionObserver(
      (entries) => {
        if (isProgrammaticScrollRef.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const key = entry.target.getAttribute('data-location-key');
            if (key) {
              const match = allLocations.find(l => l.key === key);
              if (match && (!selectedPin || selectedPin.key !== key)) {
                setSelectedPin(match);
                setFlyToTarget({ lat: match.location.lat, lng: match.location.lng, id: Date.now() });
              }
            }
            break;
          }
        }
      },
      { threshold: [0.6] }
    );

    return () => {
      mobileCardObserverRef.current?.disconnect();
    };
  }, [isSearching, allLocations, selectedPin]);

  // Progressive infinite loading sentinel for desktop & mobile card lists
  useEffect(() => {
    if (!loadMoreSentinelRef.current || !isSearching) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < allLocations.length) {
          setVisibleCount(prev => Math.min(prev + 30, allLocations.length));
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(loadMoreSentinelRef.current);
    return () => observer.disconnect();
  }, [visibleCount, allLocations.length, isSearching]);

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

  if (!isMounted) return <div className="h-[520px] w-full bg-slate-900 rounded-2xl animate-pulse"></div>;

  // Render full details card body (Master-Detail for multiple items per location)
  const renderCardDetail = (entry: LocationClusterEntry, isFullStandalone: boolean = false) => {
    const isMissingCoords = entry.location.place_id && (
      entry.location.place_id.startsWith('dummy_') || 
      entry.location.place_id === 'failed_geocoding' || 
      entry.location.place_id === 'no_api_key'
    );

    const itemCount = entry.items.length;

    return (
      <div className={`space-y-4 ${isFullStandalone ? '' : 'p-4'}`}>
        {/* Top Venue Header */}
        <div className="pb-3 border-b border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2.5 py-0.5 rounded-full">
                {entry.location.type || 'Location Detail'}
              </span>
              {itemCount > 1 && (
                <span className="text-xs font-bold text-rose-300 bg-rose-950/70 border border-rose-800/50 px-2.5 py-0.5 rounded-full">
                  {itemCount} คอนเทนต์ที่นี่
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              {entry.location.lat.toFixed(4)}, {entry.location.lng.toFixed(4)}
            </span>
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
              <span>{entry.location.name}</span>
            </h3>
            
            {isMissingCoords ? (
              <div className="mt-1.5 inline-flex items-center space-x-1.5 bg-orange-950/60 border border-orange-500/40 text-orange-400 text-[11px] px-2.5 py-1 rounded-md">
                <span className="font-bold">⚠️ หาพิกัดไม่พบ:</span>
                <span>กรุณาไปที่ Feed เพื่อแก้ไขพิกัด</span>
              </div>
            ) : (
              <p className="text-xs text-slate-400 leading-relaxed mt-0.5">
                {entry.location.formatted_address || 'Bangkok, Thailand'}
              </p>
            )}
          </div>

          {/* Shared Navigation Button */}
          {!isMissingCoords && (
            <div className="pt-1">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(entry.location.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-colors shadow-lg shadow-emerald-600/20"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>เปิดใน Google Maps</span>
              </a>
            </div>
          )}
        </div>

        {/* Vertical Feed List of all saved items for this location */}
        <div className="space-y-3">
          <div className="text-[11px] font-medium text-indigo-400 flex items-center space-x-1 px-0.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>คอนเทนต์ที่คุณเซฟไว้ ({itemCount} คลิป):</span>
          </div>

          {entry.items.map((item, idx) => {
            const url = item.url || '';
            let platformLabel = 'Social Post';
            let platformColor = 'bg-slate-800 text-slate-300 border-slate-700';

            if (url.includes('tiktok.com')) {
              platformLabel = 'TikTok';
              platformColor = 'bg-black text-pink-400 border-pink-500/30';
            } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
              platformLabel = 'YouTube';
              platformColor = 'bg-red-950/80 text-red-400 border-red-500/30';
            } else if (url.includes('facebook.com') || url.includes('fb.watch')) {
              platformLabel = 'Facebook';
              platformColor = 'bg-blue-950/80 text-blue-400 border-blue-500/30';
            }

            return (
              <div 
                key={item.id} 
                className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 hover:border-slate-700 space-y-2 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${platformColor}`}>
                    {platformLabel}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    #{idx + 1}
                  </span>
                </div>

                <h4 className="text-xs font-semibold text-slate-200 line-clamp-2">
                  {item.original_title || 'Untitled Post'}
                </h4>

                {item.original_caption && (
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {item.original_caption}
                  </p>
                )}

                <div className="pt-1 flex space-x-2">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px] rounded-lg flex items-center justify-center space-x-1.5 transition-colors shadow-md shadow-indigo-600/20"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>ดูคลิปต้นฉบับ</span>
                  </a>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingItem(item);
                      setEditTags(item.tags?.join(', ') || '');
                      setEditCategory(item.normalized_category || 'General Content');
                    }}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium rounded-lg flex items-center justify-center space-x-1 transition-colors border border-slate-700"
                    title="แก้ไขข้อมูล / เพิ่มพิกัด"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>แก้ไข</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render a compact item card in search results
  const renderCompactCard = (entry: LocationClusterEntry) => {
    const itemCount = entry.items.length;
    return (
      <div className="p-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] font-semibold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700/60">
              {entry.location.type || 'Location'}
            </span>
            {itemCount > 1 && (
              <span className="text-[10px] font-bold text-rose-300 bg-rose-950/70 border border-rose-800/40 px-2 py-0.5 rounded-full">
                {itemCount} คลิป
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {entry.location.lat.toFixed(2)}, {entry.location.lng.toFixed(2)}
          </span>
        </div>
        <h4 className="text-sm font-bold text-slate-200 line-clamp-1 group-hover:text-emerald-300 transition-colors">
          {entry.location.name}
        </h4>
        <p className="text-xs text-slate-400 line-clamp-1">
          {itemCount > 1 
            ? `${entry.location.formatted_address || ''} (${itemCount} โพสต์ที่บันทึกไว้)`
            : (entry.items[0]?.original_title || entry.location.formatted_address || '')}
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Search Bar for Map */}
      <div className="glass-panel p-3 rounded-2xl border border-white/10 shadow-lg">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={mapSearchQuery}
            onChange={(e) => setMapSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearchSubmit();
                (e.target as HTMLInputElement).blur();
              }
            }}
            enterKeyHint="search"
            placeholder="ค้นหาสถานที่ หรือคอนเทนต์เพื่อกรองพิกัดบนแผนที่..."
            className="w-full pl-10 pr-28 py-2.5 bg-surface-dark/80 rounded-xl text-sm text-slate-100 placeholder-slate-400 border border-slate-700/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
          />
          {mapSearchQuery.trim() && (
            <div className="absolute right-2.5 flex items-center space-x-1.5">
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                allLocations.length ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20' : 'bg-rose-500/15 text-rose-300 border border-rose-500/20'
              }`}>
                {allLocations.length ? `${allLocations.length} จุด` : 'ไม่พบ'}
              </span>
              <button
                type="button"
                onClick={handleClearSearch}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-full transition-colors"
                title="ล้างการค้นหา"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Map Split Container */}
      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-5 lg:h-[520px]">
        {/* Real Map Canvas */}
        <div className="h-[340px] sm:h-[420px] lg:h-full lg:col-span-2 rounded-2xl border border-slate-800 relative overflow-hidden bg-slate-900 flex z-0 shrink-0">
          <MapContainer 
            center={initialCenter} 
            zoom={initialZoom} 
            scrollWheelZoom={true} 
            className="w-full h-full z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {allLocations.map((entry) => {
              const isSelected = selectedPin ? selectedPin.key === entry.key : false;
              const isMissingCoords = entry.location.place_id && (
                entry.location.place_id.startsWith('dummy_') || 
                entry.location.place_id === 'failed_geocoding' || 
                entry.location.place_id === 'no_api_key'
              );
              
              if (typeof entry.location.lat !== 'number' || typeof entry.location.lng !== 'number') {
                return null;
              }

              const markerIcon = isSelected 
                ? activeIcon 
                : (isMissingCoords ? dummyIcon : defaultIcon);

              return (
                <Marker
                  key={entry.key}
                  position={[Number(entry.location.lat), Number(entry.location.lng)]}
                  icon={markerIcon}
                  eventHandlers={{
                    click: () => handleMarkerClick(entry),
                  }}
                />
              );
            })}
            
            <MapController 
              fitBoundsRequest={fitBoundsRequest} 
              flyToTarget={flyToTarget} 
            />
            <CurrentLocationControl autoLocate={!targetLocation} />
          </MapContainer>

          {/* Fit all results button in search mode */}
          {isSearching && allLocations.length > 0 && (
            <div className="absolute top-4 right-4 z-[400]">
              <button
                type="button"
                onClick={handleFitAllResults}
                className="bg-slate-900/90 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-lg backdrop-blur-md flex items-center space-x-1.5 transition-all group"
                title="ขยายแผนที่ให้เห็นทุกจุดที่ค้นพบ"
              >
                <Maximize2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                <span>ดูทั้งหมด {allLocations.length} จุด</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Panel / Desktop Details or Result List */}
        <div className="hidden lg:flex flex-col h-full overflow-hidden">
          {isSearching ? (
            <div className="glass-card rounded-2xl border border-slate-800 flex flex-col h-full overflow-hidden">
              {/* Header */}
              <div className="p-3.5 border-b border-slate-800/80 bg-slate-900/70 flex items-center justify-between shrink-0">
                <span className="text-xs font-semibold text-slate-300">
                  {allLocations.length} ผลลัพธ์สำหรับ '{debouncedSearchQuery}'
                </span>
                <span className="text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-full font-mono">
                  {allLocations.length} จุด
                </span>
              </div>

              {/* Cards List */}
              {allLocations.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 border border-slate-700">
                    <Search className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold text-slate-300">
                    ไม่พบสถานที่ที่ตรงกับ '{debouncedSearchQuery}'
                  </p>
                  <button
                    onClick={handleClearSearch}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition-colors flex items-center space-x-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>ล้างการค้นหา</span>
                  </button>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                  {allLocations.slice(0, visibleCount).map((entry) => {
                    const key = entry.key;
                    const isSelected = selectedPin ? selectedPin.key === key : false;

                    return (
                      <div
                        key={key}
                        ref={(el) => {
                          if (el) cardDesktopRefs.current.set(key, el);
                          else cardDesktopRefs.current.delete(key);
                        }}
                        onClick={() => handleCardClick(entry)}
                        className={`rounded-xl transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-slate-800/95 ring-2 ring-emerald-500/80 border border-emerald-500/50 shadow-lg shadow-emerald-950/30'
                            : 'bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {isSelected ? renderCardDetail(entry) : renderCompactCard(entry)}
                      </div>
                    );
                  })}
                  {visibleCount < allLocations.length && (
                    <div ref={loadMoreSentinelRef} className="py-2 text-center text-xs text-slate-500 animate-pulse">
                      กำลังโหลดรายการเพิ่มเติม...
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Normal Mode: Single Card Drawer */
            <div className="glass-card rounded-2xl p-5 border border-slate-800 flex flex-col justify-center space-y-4 h-full relative z-10 overflow-y-auto custom-scrollbar">
              {selectedPin ? (
                renderCardDetail(selectedPin, true)
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <MapPin className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-200">ตำแหน่งของคุณบนแผนที่</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                      แตะหมุดสถานที่รอบตัวบนแผนที่ เพื่อเปิดดูคอนเทนต์และพิกัดที่คุณบันทึกไว้
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile View: Rendered Below Map */}
        <div className="lg:hidden flex flex-col space-y-3">
          {isSearching ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-slate-300">
                  {allLocations.length} ผลลัพธ์สำหรับ '{debouncedSearchQuery}'
                </span>
                <span className="text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-full font-mono">
                  {allLocations.length} จุด
                </span>
              </div>

              {allLocations.length === 0 ? (
                <div className="glass-card rounded-2xl p-6 text-center space-y-3 border border-slate-800">
                  <p className="text-sm font-semibold text-slate-300">
                    ไม่พบสถานที่ที่ตรงกับ '{debouncedSearchQuery}'
                  </p>
                  <button
                    onClick={handleClearSearch}
                    className="mx-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition-colors flex items-center space-x-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>ล้างการค้นหา</span>
                  </button>
                </div>
              ) : (
                <div className="flex overflow-x-auto snap-x snap-mandatory space-x-3 pb-3 custom-scrollbar -mx-4 px-4">
                  {allLocations.slice(0, visibleCount).map((entry) => {
                    const key = entry.key;
                    const isSelected = selectedPin ? selectedPin.key === key : false;

                    return (
                      <div
                        key={key}
                        ref={(el) => {
                          if (el) {
                            cardMobileRefs.current.set(key, el);
                            mobileCardObserverRef.current?.observe(el);
                          } else {
                            cardMobileRefs.current.delete(key);
                          }
                        }}
                        data-location-key={key}
                        onClick={() => handleCardClick(entry)}
                        className={`w-[85vw] max-w-sm shrink-0 snap-center rounded-2xl transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-slate-800/95 ring-2 ring-emerald-500/80 border border-emerald-500/50 shadow-xl shadow-emerald-950/30'
                            : 'bg-slate-900/80 border border-slate-800'
                        }`}
                      >
                        {isSelected ? renderCardDetail(entry) : renderCompactCard(entry)}
                      </div>
                    );
                  })}
                  {visibleCount < allLocations.length && (
                    <div ref={loadMoreSentinelRef} className="shrink-0 w-24 flex items-center justify-center text-xs text-slate-500">
                      โหลดเพิ่ม...
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Normal Mode: Single Card Drawer on Mobile */
            <div className="glass-card rounded-2xl p-5 border border-slate-800 flex flex-col justify-between space-y-4">
              {selectedPin ? (
                renderCardDetail(selectedPin, true)
              ) : (
                <div className="py-6 px-4 text-center flex flex-col items-center justify-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <MapPin className="w-5 h-5 animate-pulse" />
                  </div>
                  <h4 className="text-xs font-semibold text-slate-200">ตำแหน่งของคุณบนแผนที่</h4>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    แตะหมุดสถานที่บนแผนที่ เพื่อเปิดดูคอนเทนต์ที่คุณบันทึกไว้
                  </p>
                </div>
              )}
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
