"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  X,
  Compass,
  FileText,
  MapPin,
  Search,
  Sparkles,
  ShieldCheck,
  User as UserIcon,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Layers,
  Map as MapIcon,
  Satellite,
  ArrowUpRight,
  Activity,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useMap } from '@vis.gl/react-google-maps';

export interface IndexedStreetItem {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  status: string;
  contributorName?: string | null;
  historicalNamesCount?: number;
}

const HISTORICAL_ZONES = [
  {
    id: 'SEC-01',
    name: 'Park Street & Chowringhee',
    bengali: 'পার্ক স্ট্রিট ও চৌরঙ্গী',
    desc: 'Colonial administrative core, historic jazz clubs, South Park Street Cemetery, and international cuisine corridors.',
    lat: 22.5515,
    lng: 88.3524,
    zoom: 16,
    badge: 'Colonial Core',
  },
  {
    id: 'SEC-02',
    name: 'North Kolkata & Sovabazar',
    bengali: 'উত্তর কলকাতা ও শোভাবাজার',
    desc: 'Aristocratic rajbaris, 19th-century zamindar estates, century-old artisanal sweet makers, and historical galis.',
    lat: 22.5985,
    lng: 88.3668,
    zoom: 15,
    badge: 'Aristocratic Heritage',
  },
  {
    id: 'SEC-03',
    name: 'College Street & Boi Para',
    bengali: 'কলেজ স্ট্রিট বইপাড়া',
    desc: 'World’s largest second-hand book publishing district, Bengal Renaissance universities, and the historic Coffee House.',
    lat: 22.5744,
    lng: 88.3639,
    zoom: 16,
    badge: 'Intellectual District',
  },
  {
    id: 'SEC-04',
    name: 'B.B.D. Bagh / Dalhousie Sq',
    bengali: 'বিবাদী বাগ / লালদিঘী',
    desc: 'Imperial British East India Company headquarters, Writers’ Building, General Post Office, and St. John’s Church.',
    lat: 22.5726,
    lng: 88.3476,
    zoom: 16,
    badge: 'Administrative Seat',
  },
  {
    id: 'SEC-05',
    name: 'Kalighat & Adi Ganga',
    bengali: 'কালীঘাট ও আদি গঙ্গা',
    desc: 'Ancient Shakti Peetha pilgrimage precinct, historic river canal corridors, and heritage tram networks.',
    lat: 22.5208,
    lng: 88.3473,
    zoom: 15,
    badge: 'Sacred Geography',
  },
];

interface LeftDrawerProps {
  indexedStreets?: IndexedStreetItem[];
  isOpen?: boolean;
  onClose?: () => void;
  showFloatingToggle?: boolean;
  mapTypeId?: string;
  onMapTypeChange?: (type: 'roadmap' | 'satellite') => void;
}

export default function LeftDrawer({
  indexedStreets = [],
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
  showFloatingToggle = false,
  mapTypeId = 'roadmap',
  onMapTypeChange,
}: LeftDrawerProps) {
  const router = useRouter();
  const map = useMap();
  const { user, openAuthModal, logout, canModerate, canContribute } = useAuth();

  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [isDockedCollapsed, setIsDockedCollapsed] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const handleClose = () => {
    setIsDockedCollapsed(false);
    if (controlledOnClose) {
      controlledOnClose();
    } else {
      setInternalIsOpen(false);
    }
  };

  const handleToggle = () => {
    if (controlledIsOpen !== undefined && controlledOnClose) {
      if (controlledIsOpen) controlledOnClose();
    } else {
      setInternalIsOpen((prev) => !prev);
    }
  };

  const [activeTab, setActiveTab] = useState<'overview' | 'sectors' | 'directory'>('overview');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter approved streets
  const approvedStreets = indexedStreets.filter((s) => s.status === 'APPROVED');
  const filteredStreets = approvedStreets.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectZone = (zone: typeof HISTORICAL_ZONES[0]) => {
    if (map) {
      map.panTo({ lat: zone.lat, lng: zone.lng });
      map.setZoom(zone.zoom);
    }
    if (window.innerWidth < 768) {
      handleClose();
    }
  };

  const handleSelectStreet = (slug: string) => {
    router.push(`/street/${slug}`);
    if (window.innerWidth < 768) {
      handleClose();
    }
  };

  return (
    <>
      {/* Floating Toggle Button (if enabled) */}
      {showFloatingToggle && (
        <div className="absolute top-4 left-4 z-20 pointer-events-auto">
          <button
            type="button"
            onClick={handleToggle}
            className="flex items-center gap-2.5 px-3 py-2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-xl shadow-md border border-zinc-200/80 dark:border-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 transition-all cursor-pointer group"
            aria-label="Toggle spatial archive drawer"
          >
            <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform" />
            <span className="font-sans font-semibold text-xs tracking-tight">Spatial Archive</span>
            <span className="hidden sm:inline-block text-[10px] font-mono text-zinc-400 dark:text-zinc-500 pl-1.5 border-l border-zinc-200 dark:border-zinc-700">
              {approvedStreets.length} Indexed
            </span>
          </button>
        </div>
      )}

      {/* Drawer Overlay & Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop (only when full drawer is open) */}
            {!isDockedCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleClose}
                className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 pointer-events-auto md:bg-transparent md:pointer-events-none"
              />
            )}

            {/* DOCKED COLLAPSED RAIL MODE */}
            {isDockedCollapsed ? (
              <motion.aside
                initial={{ x: -60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -60, opacity: 0 }}
                transition={{ type: 'spring', damping: 26, stiffness: 240 }}
                className="fixed top-0 left-0 bottom-0 w-14 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl z-40 border-r border-zinc-200/80 dark:border-zinc-800/80 shadow-xl flex flex-col items-center justify-between py-4 pointer-events-auto"
              >
                {/* Top: Brand & Navigation */}
                <div className="flex flex-col items-center gap-3 w-full">
                  <button
                    type="button"
                    onClick={() => setIsDockedCollapsed(false)}
                    className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shadow-xs cursor-pointer hover:scale-105 transition-transform"
                    title="Expand Spatial Archive"
                  >
                    <Layers className="w-4 h-4" />
                  </button>

                  <div className="w-6 h-px bg-zinc-200 dark:bg-zinc-800 my-1" />

                  {/* Overview tab */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('overview');
                      setIsDockedCollapsed(false);
                    }}
                    className={`p-2 rounded-xl transition-colors cursor-pointer ${
                      activeTab === 'overview'
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                        : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                    }`}
                    title="Archive Overview"
                  >
                    <Activity className="w-4 h-4" />
                  </button>

                  {/* Sectors tab */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('sectors');
                      setIsDockedCollapsed(false);
                    }}
                    className={`p-2 rounded-xl transition-colors cursor-pointer ${
                      activeTab === 'sectors'
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                        : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                    }`}
                    title="Heritage Sectors"
                  >
                    <Compass className="w-4 h-4" />
                  </button>

                  {/* Directory tab */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('directory');
                      setIsDockedCollapsed(false);
                    }}
                    className={`p-2 rounded-xl transition-colors cursor-pointer ${
                      activeTab === 'directory'
                        ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400'
                        : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                    }`}
                    title="Street Directory"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </div>

                {/* Bottom: Map Toggle, Expand & Close */}
                <div className="flex flex-col items-center gap-2.5 w-full">
                  <button
                    type="button"
                    onClick={() => onMapTypeChange?.(mapTypeId === 'roadmap' ? 'satellite' : 'roadmap')}
                    className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                    title={`Switch to ${mapTypeId === 'roadmap' ? 'Satellite' : 'Roadmap'}`}
                  >
                    {mapTypeId === 'roadmap' ? (
                      <Satellite className="w-4 h-4" />
                    ) : (
                      <MapIcon className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsDockedCollapsed(false)}
                    className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors cursor-pointer"
                    title="Expand Archive Sidebar"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleClose}
                    className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                    title="Close Archive"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.aside>
            ) : (
              /* FULL SLIDE-OUT DRAWER */
              <motion.aside
                initial={{ x: '-100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '-100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 260 }}
                className="fixed top-0 left-0 bottom-0 w-full sm:w-96 md:w-104 bg-white/98 dark:bg-zinc-950/98 backdrop-blur-xl z-50 pointer-events-auto shadow-2xl border-r border-zinc-200/80 dark:border-zinc-800/80 flex flex-col overflow-hidden"
              >
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shadow-xs ring-1 ring-zinc-800/10 dark:ring-white/20">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h1 className="font-sans font-bold text-base tracking-tight text-zinc-900 dark:text-zinc-100">
                            Tilottoma
                          </h1>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-900/40 text-[9px] font-mono font-medium text-emerald-700 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            LIVE
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
                          Spatial Cartography & Nomenclature
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setIsDockedCollapsed(true)}
                        className="hidden md:flex p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
                        title="Collapse to dock rail"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleClose}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
                        aria-label="Close drawer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                {/* Map View Segmented Control */}
                <div className="flex items-center justify-between mt-4 px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs">
                  <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Base Map
                  </span>
                  <div className="flex bg-zinc-100 dark:bg-zinc-800/90 rounded-lg p-0.5 border border-zinc-200/60 dark:border-zinc-700/60">
                    <button
                      type="button"
                      onClick={() => onMapTypeChange?.('roadmap')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                        mapTypeId === 'roadmap'
                          ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                      }`}
                    >
                      <MapIcon className="w-3 h-3" />
                      <span>Vector</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onMapTypeChange?.('satellite')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                        mapTypeId === 'satellite'
                          ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                      }`}
                    >
                      <Satellite className="w-3 h-3" />
                      <span>Satellite</span>
                    </button>
                  </div>
                </div>

                {/* Navigation Segmented Tabs */}
                <div className="flex gap-1 mt-3 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs rounded-lg transition-all cursor-pointer ${
                      activeTab === 'overview'
                        ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold shadow-2xs'
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 font-medium'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Overview
                  </button>

                  <button
                    onClick={() => setActiveTab('sectors')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs rounded-lg transition-all cursor-pointer ${
                      activeTab === 'sectors'
                        ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold shadow-2xs'
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 font-medium'
                    }`}
                  >
                    <Compass className="w-3.5 h-3.5" />
                    Sectors
                  </button>

                  <button
                    onClick={() => setActiveTab('directory')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs rounded-lg transition-all cursor-pointer ${
                      activeTab === 'directory'
                        ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold shadow-2xs'
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 font-medium'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Directory
                  </button>
                </div>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
                {/* TAB 1: OVERVIEW */}
                {activeTab === 'overview' && (
                  <div className="space-y-4">
                    {/* Mission Dossier Card */}
                    <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                          Platform Objective
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400">
                          GIS V2.4
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300 font-sans">
                        Tilottoma is a precision cartography platform documenting the historical genealogy of Kolkata's street nomenclature. It preserves chronological records of imperial renamings, post-colonial dedications, and vernacular memory.
                      </p>
                    </div>

                    {/* Technical Architecture */}
                    <div className="space-y-2.5">
                      <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Spatial Engine & Data Sources
                      </h3>

                      <div className="space-y-2 text-xs">
                        <div className="p-3 rounded-lg border border-zinc-200/70 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                              PostGIS Spatial Index
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                              ST_DWithin
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                            Geospatial line geometries with automatic snapping, vector polyline indexing, and proximity clustering.
                          </p>
                        </div>

                        <div className="p-3 rounded-lg border border-zinc-200/70 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                              Municipal Archives & Gazettes
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                              1924–1980
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                            Primary records sourced from the Calcutta Municipal Gazette, P. Thankappan Nair, and Radharaman Mitra.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Contributor Network Callout */}
                    <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 flex items-start gap-3">
                      <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          Verified Research Program
                        </p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                          Historians, cartographers, and urbanists can contribute new road geometries and archival citations subject to peer moderation.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: SECTORS */}
                {activeTab === 'sectors' && (
                  <div className="space-y-2.5">
                    <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                      SELECT SECTOR TO FOCUS SPATIAL EXTENT:
                    </p>

                    {HISTORICAL_ZONES.map((zone) => (
                      <div
                        key={zone.id}
                        onClick={() => handleSelectZone(zone)}
                        className="p-3.5 rounded-xl bg-white dark:bg-zinc-900/40 hover:bg-zinc-50 dark:hover:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 transition-all group cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono font-bold text-zinc-400">
                                {zone.id}
                              </span>
                              <h4 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {zone.name}
                              </h4>
                            </div>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-sans mt-0.5">
                              {zone.bengali}
                            </p>
                          </div>
                          <span className="text-[9px] font-mono font-medium uppercase px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shrink-0">
                            {zone.badge}
                          </span>
                        </div>

                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2 line-clamp-2 leading-relaxed">
                          {zone.desc}
                        </p>

                        <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                          <span>COORDINATES: {zone.lat.toFixed(3)}, {zone.lng.toFixed(3)}</span>
                          <span className="inline-flex items-center gap-0.5 font-semibold">
                            Focus Extent <ArrowUpRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* TAB 3: DIRECTORY */}
                {activeTab === 'directory' && (
                  <div className="space-y-3">
                    {/* Modern Search Input */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Filter catalogued corridors..."
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all font-sans"
                      />
                    </div>

                    <div className="space-y-1.5">
                      {filteredStreets.length > 0 ? (
                        filteredStreets.map((street) => (
                          <button
                            key={street.id}
                            onClick={() => handleSelectStreet(street.slug)}
                            className="w-full text-left p-2.5 rounded-lg bg-white dark:bg-zinc-900/40 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800 transition-all flex items-center justify-between group cursor-pointer"
                          >
                            <div className="pr-2 min-w-0">
                              <h4 className="font-medium text-xs text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
                                {street.name}
                              </h4>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-mono text-zinc-400">
                                  {street.historicalNamesCount || 1} ERAS
                                </span>
                                {street.contributorName && (
                                  <span className="text-[10px] text-zinc-400 truncate">
                                    • {street.contributorName}
                                  </span>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 group-hover:text-blue-500 group-hover:translate-x-0.5 shrink-0 transition-all" />
                          </button>
                        ))
                      ) : (
                        <div className="text-center py-8 text-zinc-400 text-xs font-mono">
                          NO CORRIDORS MATCHING SEARCH
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User Profile & Session Dock */}
              <div className="p-3.5 sm:p-4 border-t border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/80 dark:bg-zinc-900/70">
                {user ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-bold text-xs shrink-0">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {user.name}
                          </p>
                          <span
                            className={`inline-block text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded uppercase tracking-wider ${
                              user.role === 'ADMIN'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                : user.role === 'MODERATOR'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                : user.role === 'CONTRIBUTOR'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                            }`}
                          >
                            {user.role}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={logout}
                        title="Sign Out"
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Role specific CTAs */}
                    {canContribute && (
                      <button
                        type="button"
                        onClick={() => {
                          handleClose();
                          window.dispatchEvent(new CustomEvent('modal:open-add-place'));
                        }}
                        className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Recommend a Heritage Spot</span>
                      </button>
                    )}

                    {user.role === 'USER' && (
                      <button
                        onClick={() => openAuthModal('contributor')}
                        className="w-full py-1.5 px-3 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        Apply for Contributor Access
                      </button>
                    )}

                    {canModerate && (
                      <a
                        href="/admin"
                        className="w-full py-1.5 px-3 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                        Management Console
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        Contributor Portal
                      </p>
                      <p className="text-[10px] font-mono text-zinc-400">
                        Research & peer review
                      </p>
                    </div>
                    <button
                      onClick={() => openAuthModal('login')}
                      className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-semibold rounded-lg transition-all shrink-0 cursor-pointer shadow-2xs"
                    >
                      Sign In
                    </button>
                  </div>
                )}
              </div>
            </motion.aside>
            )}
          </>
        )}
      </AnimatePresence>
    </>
  );
}
