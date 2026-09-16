"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Map,
  Polyline,
  APIProvider,
  AdvancedMarker,
  Pin,
  useMap,
  useMapsLibrary,
  MapControl,
  ControlPosition,
} from '@vis.gl/react-google-maps';

interface LatLng {
  lat: number;
  lng: number;
}

// Map bounds controller with programmatic fit trigger
function AdminMapController({
  points,
  fitTrigger,
}: {
  points: LatLng[];
  fitTrigger: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || points.length === 0) return;
    
    if (points.length === 1) {
      map.setCenter(points[0]);
      map.setZoom(16);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
  }, [map, fitTrigger, points.length]);

  return null;
}

function getPolylinePaths(geom: any): LatLng[] {
  if (!geom || !geom.coordinates) return [];
  
  if (geom.type === 'LineString') {
    const coords: LatLng[] = [];
    for (const c of geom.coordinates) {
      if (Array.isArray(c) && c.length >= 2) {
        const lng = Number(c[0]);
        const lat = Number(c[1]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          coords.push({ lat, lng });
        }
      }
    }
    return coords;
  }

  if (geom.type === 'MultiLineString') {
    const coords: LatLng[] = [];
    for (const line of geom.coordinates) {
      if (Array.isArray(line)) {
        for (const c of line) {
          if (Array.isArray(c) && c.length >= 2) {
            const lng = Number(c[0]);
            const lat = Number(c[1]);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
              coords.push({ lat, lng });
            }
          }
        }
      }
    }
    return coords;
  }

  return [];
}

// Downsample waypoints to avoid Google Maps MAX_WAYPOINTS_EXCEEDED error (limit is 25)
function sampleWaypoints(intermediatePoints: LatLng[], maxCount = 12): LatLng[] {
  if (intermediatePoints.length <= maxCount) return intermediatePoints;
  const step = intermediatePoints.length / (maxCount + 1);
  const sampled: LatLng[] = [];
  for (let i = 1; i <= maxCount; i++) {
    sampled.push(intermediatePoints[Math.floor(i * step)]);
  }
  return sampled;
}

function AdminDashboardContent() {
  const [allStreets, setAllStreets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Navigation & Selection state
  // When selectedStreet is null and isCreatingNew is false, we show the Dashboard Landing Overview!
  const [selectedStreet, setSelectedStreet] = useState<any | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  
  // Collapsible sidebar state (used when in editor mode)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Map display controls
  const [mapTypeId, setMapTypeId] = useState<'roadmap' | 'satellite'>('roadmap');
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [fitTrigger, setFitTrigger] = useState(0);

  // Filter & Search states
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Editable form fields
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [newStreetSources, setNewStreetSources] = useState('');
  
  // Editable geometry pins (Start, Middle Waypoints, End)
  const [editablePoints, setEditablePoints] = useState<LatLng[]>([]);
  const [originalPoints, setOriginalPoints] = useState<LatLng[]>([]);
  
  // Road Snapping vs Manual Mode
  const [alignmentMode, setAlignmentMode] = useState<'auto' | 'manual'>('auto');
  const [autoTravelMode, setAutoTravelMode] = useState<'walking' | 'driving'>('walking');
  const [snappedPath, setSnappedPath] = useState<LatLng[]>([]);
  const [autoStatus, setAutoStatus] = useState<'idle' | 'detecting' | 'found' | 'not_found'>('idle');
  const [autoRoadName, setAutoRoadName] = useState('');

  // Explicit Pin Tool: 'none' | 'start' | 'middle' | 'end'
  const [activePinTool, setActivePinTool] = useState<'none' | 'start' | 'middle' | 'end'>('none');
  const [isProcessing, setIsProcessing] = useState(false);

  const router = useRouter();

  // Load Directions Service (runs reliably inside APIProvider)
  const routesLib = useMapsLibrary('routes');
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);

  useEffect(() => {
    if (routesLib && !directionsServiceRef.current) {
      directionsServiceRef.current = new routesLib.DirectionsService();
    }
  }, [routesLib]);

  useEffect(() => {
    fetchStreets();
  }, []);

  const fetchStreets = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/contributions', { cache: 'no-store' });
      if (res.status === 401) {
        router.push('/admin/login');
        return;
      }
      const data = await res.json();
      if (data.contributions) {
        setAllStreets(data.contributions);
        // Sync selectedStreet with latest updated status from server
        setSelectedStreet((prev: any) => {
          if (!prev) return null;
          const fresh = data.contributions.find((s: any) => s.id === prev.id);
          return fresh || prev;
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Explicitly select a street to edit
  const selectStreet = (street: any) => {
    setIsCreatingNew(false);
    setSelectedStreet(street);
    setEditName(street.name || '');
    setEditDescription(street.description || '');
    const points = getPolylinePaths(street.geom);
    setEditablePoints(points);
    setOriginalPoints(points);
    setSnappedPath(points);
    setActivePinTool('none');
    setAutoStatus('idle');
    setAutoRoadName('');
    setFitTrigger(prev => prev + 1);
  };

  // Start "Add New Street" flow
  const startCreateNew = () => {
    setSelectedStreet(null);
    setIsCreatingNew(true);
    setEditName('');
    setEditDescription('');
    setNewStreetSources('');
    setEditablePoints([]);
    setOriginalPoints([]);
    setSnappedPath([]);
    setActivePinTool('start');
    setAutoStatus('idle');
    setAutoRoadName('');
    setAlignmentMode('auto');
  };

  // Exit back to safe Dashboard Landing
  const backToDashboard = () => {
    setSelectedStreet(null);
    setIsCreatingNew(false);
    setActivePinTool('none');
    setEditablePoints([]);
    setSnappedPath([]);
  };

  // Run road snapping using Google DirectionsService passing origin, middle waypoints, and destination
  const runAutoRoadDetection = useCallback((points: LatLng[]) => {
    if (points.length < 2) {
      setSnappedPath([]);
      setAutoStatus('idle');
      setAutoRoadName('');
      return;
    }

    if (!directionsServiceRef.current) {
      setTimeout(() => {
        if (directionsServiceRef.current) {
          runAutoRoadDetection(points);
        }
      }, 200);
      return;
    }

    setAutoStatus('detecting');

    const origin = points[0];
    const destination = points[points.length - 1];
    
    // Intermediate waypoints (middle pins) in order
    const rawMiddle = points.slice(1, -1);
    const sampledMiddle = sampleWaypoints(rawMiddle, 12);
    const waypoints = sampledMiddle.map(pt => ({
      location: pt,
      stopover: false,
    }));

    const fetchRoute = (mode: google.maps.TravelMode): Promise<google.maps.DirectionsResult> => {
      return new Promise((resolve, reject) => {
        directionsServiceRef.current!.route(
          { origin, destination, waypoints, travelMode: mode },
          (res, status) => {
            if (status === google.maps.DirectionsStatus.OK && res) {
              resolve(res);
            } else {
              reject(status);
            }
          }
        );
      });
    };

    const primaryMode = autoTravelMode === 'walking' ? google.maps.TravelMode.WALKING : google.maps.TravelMode.DRIVING;
    const fallbackMode = autoTravelMode === 'walking' ? google.maps.TravelMode.DRIVING : google.maps.TravelMode.WALKING;

    fetchRoute(primaryMode)
      .catch(() => fetchRoute(fallbackMode))
      .then((result) => {
        const route = result.routes[0];
        if (route?.overview_path?.length) {
          const snapped = route.overview_path.map(p => ({ lat: p.lat(), lng: p.lng() }));
          setSnappedPath(snapped);
          setAutoStatus('found');
          setAutoRoadName(route.summary || '');
        }
      })
      .catch((err) => {
        console.warn('Road snapping failed with status:', err);
        setSnappedPath(points);
        setAutoStatus('not_found');
        setAutoRoadName('');
      });
  }, [autoTravelMode]);

  // When alignmentMode is Auto and editablePoints or autoTravelMode change, automatically snap through all pins
  useEffect(() => {
    if (alignmentMode === 'auto' && editablePoints.length >= 2) {
      runAutoRoadDetection(editablePoints);
    }
  }, [alignmentMode, editablePoints, autoTravelMode, runAutoRoadDetection]);

  // Switch between Auto and Manual mode without collapsing road to a straight line
  const handleSwitchAlignmentMode = (newMode: 'auto' | 'manual') => {
    if (newMode === 'manual' && alignmentMode === 'auto') {
      // When switching from Auto to Manual:
      // Preserve the curved road path by sampling waypoints from snappedPath as draggable middle pins
      if (snappedPath.length > 2 && editablePoints.length <= 2) {
        const start = editablePoints[0] || snappedPath[0];
        const end = editablePoints[editablePoints.length - 1] || snappedPath[snappedPath.length - 1];
        const sampledMiddle = sampleWaypoints(snappedPath.slice(1, -1), 6);
        setEditablePoints([start, ...sampledMiddle, end]);
      }
    } else if (newMode === 'auto' && alignmentMode === 'manual') {
      if (editablePoints.length >= 2) {
        runAutoRoadDetection(editablePoints);
      }
    }
    setAlignmentMode(newMode);
  };

  const handlePopulateMiddlePins = () => {
    if (snappedPath.length <= 2) {
      alert("No snapped road coordinates available yet. Ensure Start and End pins are placed.");
      return;
    }
    const start = editablePoints[0] || snappedPath[0];
    const end = editablePoints[editablePoints.length - 1] || snappedPath[snappedPath.length - 1];
    const sampledMiddle = sampleWaypoints(snappedPath.slice(1, -1), 6);
    setEditablePoints([start, ...sampledMiddle, end]);
  };

  // Filtered streets list
  const filteredStreets = useMemo(() => {
    return allStreets.filter((s) => {
      const matchesTab =
        activeTab === 'ALL' ||
        (activeTab === 'PENDING' && s.status === 'PENDING') ||
        (activeTab === 'APPROVED' && s.status === 'APPROVED') ||
        (activeTab === 'REJECTED' && s.status === 'REJECTED');
      
      const matchesSearch =
        !searchQuery.trim() ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesTab && matchesSearch;
    });
  }, [allStreets, activeTab, searchQuery]);

  const pendingCount = useMemo(() => allStreets.filter(s => s.status === 'PENDING').length, [allStreets]);
  const approvedCount = useMemo(() => allStreets.filter(s => s.status === 'APPROVED').length, [allStreets]);
  const rejectedCount = useMemo(() => allStreets.filter(s => s.status === 'REJECTED').length, [allStreets]);

  // Pin Modification Handlers
  const handleDragPoint = (index: number, newPos: LatLng) => {
    setEditablePoints(prev => {
      const updated = [...prev];
      updated[index] = newPos;
      return updated;
    });
  };

  // Selected pin state & click tracker for reliable pin deletion
  const [selectedPinIndex, setSelectedPinIndex] = useState<number | null>(null);
  const lastPinClickRef = useRef<{ id: number; time: number }>({ id: -1, time: 0 });
  const markerInteractedRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);

  // Map Click Handler respecting activePinTool
  const handleMapClick = (clickPos: LatLng) => {
    // If a marker was just clicked, tapped, or dragged, suppress map click
    if (Date.now() - markerInteractedRef.current < 450) {
      return;
    }
    setSelectedPinIndex(null);

    if (activePinTool === 'start') {
      setEditablePoints(prev => {
        if (prev.length === 0) return [clickPos];
        const updated = [...prev];
        updated[0] = clickPos;
        return updated;
      });
      setActivePinTool('none');
    } else if (activePinTool === 'end') {
      setEditablePoints(prev => {
        if (prev.length === 0) return [clickPos];
        if (prev.length === 1) return [prev[0], clickPos];
        const updated = [...prev];
        updated[updated.length - 1] = clickPos;
        return updated;
      });
      setActivePinTool('none');
    } else if (activePinTool === 'middle') {
      setEditablePoints(prev => {
        if (prev.length === 0) return [clickPos];
        if (prev.length === 1) return [prev[0], clickPos];
        const start = prev.slice(0, -1);
        const end = prev[prev.length - 1];
        return [...start, clickPos, end];
      });
    } else {
      if (editablePoints.length === 0) {
        setEditablePoints([clickPos]);
      } else if (editablePoints.length === 1) {
        setEditablePoints(prev => [...prev, clickPos]);
      }
    }
  };

  const handleDeletePoint = (index: number) => {
    setEditablePoints(prev => {
      const updated = prev.filter((_, i) => i !== index);
      if (updated.length < 2) {
        setSnappedPath([]);
        setAutoStatus('idle');
      }
      return updated;
    });
    setSelectedPinIndex(null);
  };

  // Double tap / double click detection on map markers to delete pin
  const handlePinInteraction = (index: number, e?: any) => {
    if (e) {
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (e.nativeEvent?.stopPropagation) e.nativeEvent.stopPropagation();
      if (e.nativeEvent?.stopImmediatePropagation) e.nativeEvent.stopImmediatePropagation();
      if (typeof e.stop === 'function') e.stop();
    }

    if (isDraggingRef.current) return;

    const now = Date.now();
    markerInteractedRef.current = now;

    const last = lastPinClickRef.current;
    const timeDiff = now - last.time;
    const samePin = last.id === index;

    if (samePin && timeDiff > 40 && timeDiff < 650) {
      // Real double tap / double click detected!
      handleDeletePoint(index);
      lastPinClickRef.current = { id: -1, time: 0 };
      setSelectedPinIndex(null);
    } else {
      // Discard duplicate synthetic events within 40ms, otherwise toggle pin selection
      if (timeDiff > 40) {
        lastPinClickRef.current = { id: index, time: now };
        setSelectedPinIndex(prev => (prev === index ? null : index));
      }
    }
  };

  // Reorder waypoints (move up/down)
  const handleMoveWaypoint = (index: number, direction: 'up' | 'down') => {
    if (index <= 0 || index >= editablePoints.length - 1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex <= 0 || targetIndex >= editablePoints.length - 1) return;

    setEditablePoints(prev => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      return updated;
    });
  };

  // Clear Middle Pins
  const handleClearMiddlePins = () => {
    if (editablePoints.length <= 2) {
      alert("Only start and end pins exist. No middle pins to clear.");
      return;
    }
    const startPin = editablePoints[0];
    const endPin = editablePoints[editablePoints.length - 1];
    setEditablePoints([startPin, endPin]);
    setActivePinTool('none');
  };

  // Clear All Pins
  const handleClearAllPins = () => {
    if (confirm("Are you sure you want to clear all pins? You will be able to set a new Start, Middle, and End pin.")) {
      setEditablePoints([]);
      setSnappedPath([]);
      setAutoStatus('idle');
      setAutoRoadName('');
      setActivePinTool('start');
    }
  };

  // Reset to original submission
  const handleResetPoints = () => {
    setEditablePoints([...originalPoints]);
    setSnappedPath([...originalPoints]);
    setAutoStatus('idle');
    setActivePinTool('none');
    setFitTrigger(prev => prev + 1);
  };

  // Save changes to existing street
  const handleSave = async (newStatus?: 'APPROVED' | 'PENDING') => {
    if (!selectedStreet) return;

    const pointsToSave = alignmentMode === 'auto' && snappedPath.length >= 2 ? snappedPath : editablePoints;

    if (pointsToSave.length < 2) {
      alert("A street must have at least 2 points (Start and End) before publishing.");
      return;
    }

    const targetStatus = newStatus || selectedStreet.status;

    setIsProcessing(true);
    try {
      const res = await fetch(`/api/admin/contributions/${selectedStreet.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: targetStatus,
          name: editName,
          description: editDescription,
          points: pointsToSave,
        }),
      });

      if (res.ok) {
        // Immediately update selectedStreet and allStreets state
        setSelectedStreet((prev: any) => prev ? ({
          ...prev,
          status: targetStatus,
          name: editName,
          description: editDescription,
        }) : null);

        setAllStreets((prev: any[]) => prev.map(s => s.id === selectedStreet.id ? {
          ...s,
          status: targetStatus,
          name: editName,
          description: editDescription,
        } : s));

        alert(targetStatus === 'APPROVED' ? 'Street approved & published to map!' : 'Street changes saved successfully!');
        await fetchStreets();
        router.refresh();
      } else {
        alert('Failed to update street.');
      }
    } catch (error) {
      console.error(error);
      alert('Error updating street.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Create brand new street handler
  const handleCreateNewStreet = async (status: 'APPROVED' | 'PENDING') => {
    if (!editName.trim()) {
      alert("Please provide a street name.");
      return;
    }

    const pointsToSave = alignmentMode === 'auto' && snappedPath.length >= 2 ? snappedPath : editablePoints;
    if (pointsToSave.length < 2) {
      alert("Please place at least a Start Pin (🟢) and End Pin (🔴) on the map.");
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch('/api/admin/contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim(),
          sources: newStreetSources,
          points: pointsToSave,
          status,
        }),
      });

      if (res.ok) {
        alert(status === 'APPROVED' ? 'New street created and published live!' : 'New street saved as Pending review!');
        await fetchStreets();
        backToDashboard();
        router.refresh();
      } else {
        alert('Failed to create new street.');
      }
    } catch (error) {
      console.error(error);
      alert('Error creating street.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Rejection handler
  const handleReject = async () => {
    if (!selectedStreet) return;
    if (!confirm(`Are you sure you want to reject "${selectedStreet.name}"?`)) return;

    setIsProcessing(true);
    try {
      const res = await fetch(`/api/admin/contributions/${selectedStreet.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'REJECTED',
          name: editName,
          description: editDescription,
        }),
      });

      if (res.ok) {
        setSelectedStreet((prev: any) => prev ? ({
          ...prev,
          status: 'REJECTED',
          name: editName,
          description: editDescription,
        }) : null);

        setAllStreets((prev: any[]) => prev.map(s => s.id === selectedStreet.id ? {
          ...s,
          status: 'REJECTED',
          name: editName,
          description: editDescription,
        } : s));

        alert('Contribution marked as Rejected.');
        await fetchStreets();
        setActiveTab('REJECTED');
        router.refresh();
      } else {
        alert('Failed to reject contribution.');
      }
    } catch (error) {
      console.error(error);
      alert('Error rejecting contribution.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Permanent Delete handler
  const handleDeletePermanently = async (streetToDelete = selectedStreet) => {
    if (!streetToDelete) return;
    if (!confirm(`Are you sure you want to PERMANENTLY delete "${streetToDelete.name}" from the database? This cannot be undone.`)) return;

    setIsProcessing(true);
    try {
      const res = await fetch(`/api/admin/contributions/${streetToDelete.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        alert('Street deleted permanently.');
        await fetchStreets();
        if (selectedStreet?.id === streetToDelete.id) {
          backToDashboard();
        }
        router.refresh();
      } else {
        alert('Failed to delete street.');
      }
    } catch (error) {
      console.error(error);
      alert('Error deleting street.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    router.push('/admin/login');
    router.refresh();
  };

  const centerPoint = editablePoints[0] || { lat: 22.5726, lng: 88.3639 };
  const currentPath = alignmentMode === 'auto' && snappedPath.length >= 2 ? snappedPath : editablePoints;
  const middlePins = editablePoints.slice(1, -1);

  const isEditingOrCreating = selectedStreet !== null || isCreatingNew;

  return (
    <div className="min-h-screen bg-zinc-100 flex flex-col font-sans pb-12">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-zinc-200 px-4 md:px-6 py-3.5 flex items-center justify-between shadow-xs sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-serif text-2xl font-bold tracking-tight text-zinc-900 hover:text-blue-600 transition-colors">
            Tilottoma
          </Link>
          <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            Admin Console
          </span>

          {isEditingOrCreating ? (
            <button
              onClick={backToDashboard}
              className="ml-3 flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-800 transition-all cursor-pointer shadow-2xs"
            >
              <span>← Back to Dashboard</span>
            </button>
          ) : (
            <button
              onClick={startCreateNew}
              className="ml-3 flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all cursor-pointer shadow-xs"
            >
              <span>＋ Add New Street</span>
            </button>
          )}

          {isEditingOrCreating && (
            <button
              onClick={() => setIsSidebarOpen(prev => !prev)}
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 transition-all cursor-pointer"
              title={isSidebarOpen ? "Collapse street list" : "Expand street list"}
            >
              <span>{isSidebarOpen ? '◀ Hide Sidebar' : '▶ Show Sidebar'}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchStreets}
            className="text-xs text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer"
          >
            ↻ Refresh
          </button>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            <span>←</span> View Public Map
          </Link>
          <button
            onClick={handleLogout}
            className="text-xs text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer"
          >
            Logout 🚪
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full px-4 md:px-6 py-5 flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 py-32 w-full">
            <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm font-medium">Loading streets from database...</p>
          </div>
        ) : !isEditingOrCreating ? (
          /* ========================================================== */
          /* 1. EXECUTIVE DASHBOARD LANDING VIEW (SAFE, NO MISHAPS)     */
          /* ========================================================== */
          <div className="max-w-7xl w-full mx-auto space-y-6">
            {/* Welcome Banner */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-6 md:p-8 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <h1 className="font-serif text-2xl md:text-3xl font-bold text-zinc-900">
                  Street Archive & Alignment Console
                </h1>
                <p className="text-zinc-500 text-sm mt-1.5 max-w-2xl">
                  Review public contributions, manage live map geometries, or create new street entries. Changes take effect on the public interactive map.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={startCreateNew}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>＋</span> Add New Street
                </button>
                <Link
                  href="/"
                  className="px-4 py-2.5 rounded-xl font-semibold text-sm bg-zinc-100 hover:bg-zinc-200 text-zinc-800 transition-colors"
                >
                  View Public Map →
                </Link>
              </div>
            </div>

            {/* Metric Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Pending Card */}
              <div
                onClick={() => setActiveTab('PENDING')}
                className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                  activeTab === 'PENDING'
                    ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-300'
                    : 'bg-white border-zinc-200 hover:border-amber-300 hover:shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                    Pending Review
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                </div>
                <div className="text-3xl font-extrabold text-zinc-900 mt-2 font-mono">
                  {pendingCount}
                </div>
                <p className="text-xs text-zinc-500 mt-1">Awaiting review & road snapping</p>
                <div className="mt-3 text-xs font-semibold text-amber-700 flex items-center gap-1">
                  Filter pending →
                </div>
              </div>

              {/* Published Card */}
              <div
                onClick={() => setActiveTab('APPROVED')}
                className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                  activeTab === 'APPROVED'
                    ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-300'
                    : 'bg-white border-zinc-200 hover:border-emerald-300 hover:shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    Published & Live
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                </div>
                <div className="text-3xl font-extrabold text-zinc-900 mt-2 font-mono">
                  {approvedCount}
                </div>
                <p className="text-xs text-zinc-500 mt-1">Live on public Kolkata map</p>
                <div className="mt-3 text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  Manage published →
                </div>
              </div>

              {/* Rejected Card */}
              <div
                onClick={() => setActiveTab('REJECTED')}
                className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                  activeTab === 'REJECTED'
                    ? 'bg-red-50 border-red-300 ring-2 ring-red-300'
                    : 'bg-white border-zinc-200 hover:border-red-300 hover:shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-red-800">
                    Rejected Archive
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                </div>
                <div className="text-3xl font-extrabold text-zinc-900 mt-2 font-mono">
                  {rejectedCount}
                </div>
                <p className="text-xs text-zinc-500 mt-1">Declined or duplicate entries</p>
                <div className="mt-3 text-xs font-semibold text-red-700 flex items-center gap-1">
                  View archive →
                </div>
              </div>

              {/* Total Card */}
              <div
                onClick={() => setActiveTab('ALL')}
                className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                  activeTab === 'ALL'
                    ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-300'
                    : 'bg-white border-zinc-200 hover:border-blue-300 hover:shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-800">
                    Total Database
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                </div>
                <div className="text-3xl font-extrabold text-zinc-900 mt-2 font-mono">
                  {allStreets.length}
                </div>
                <p className="text-xs text-zinc-500 mt-1">All historical streets on record</p>
                <div className="mt-3 text-xs font-semibold text-blue-700 flex items-center gap-1">
                  View all entries →
                </div>
              </div>
            </div>

            {/* Street Directory Table */}
            <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
              {/* Directory Filter Bar */}
              <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setActiveTab('ALL')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      activeTab === 'ALL' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    All ({allStreets.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('PENDING')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      activeTab === 'PENDING' ? 'bg-amber-600 text-white' : 'bg-white text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    Pending ({pendingCount})
                  </button>
                  <button
                    onClick={() => setActiveTab('APPROVED')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      activeTab === 'APPROVED' ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-800 hover:bg-emerald-100'
                    }`}
                  >
                    Published ({approvedCount})
                  </button>
                  <button
                    onClick={() => setActiveTab('REJECTED')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      activeTab === 'REJECTED' ? 'bg-red-600 text-white' : 'bg-white text-red-800 hover:bg-red-100'
                    }`}
                  >
                    Rejected ({rejectedCount})
                  </button>
                </div>

                <div className="w-full md:w-80">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search street by name or description..."
                    className="w-full px-3.5 py-1.5 text-xs bg-white border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 shadow-2xs"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50/75 text-zinc-500 font-semibold uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">Street Name & Details</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Coordinates</th>
                      <th className="py-3 px-4">Sources</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-zinc-700">
                    {filteredStreets.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-zinc-400">
                          <p className="font-semibold text-zinc-600 text-sm mb-1">No streets found</p>
                          <p className="text-xs">Adjust your search query or tab filter above.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredStreets.map((street) => {
                        const coords = getPolylinePaths(street.geom);
                        const isPending = street.status === 'PENDING';
                        const isRejected = street.status === 'REJECTED';

                        return (
                          <tr key={street.id} className="hover:bg-zinc-50/80 transition-colors group">
                            <td className="py-3.5 px-4 max-w-xs md:max-w-md">
                              <div className="font-bold text-sm text-zinc-900 group-hover:text-blue-600 transition-colors">
                                {street.name}
                              </div>
                              <p className="text-xs text-zinc-500 line-clamp-1 mt-0.5">
                                {street.description || 'No description.'}
                              </p>
                              <div className="text-[10px] font-mono text-zinc-400 mt-1">
                                slug: {street.slug}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${
                                  isPending
                                    ? 'bg-amber-100 text-amber-800'
                                    : isRejected
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {street.status}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap text-zinc-600 font-mono text-[11px]">
                              📍 {coords.length} pts
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap text-zinc-600">
                              {street.sources?.length ? `🔗 ${street.sources.length} sources` : '—'}
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => selectStreet(street)}
                                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer shadow-2xs ${
                                    isPending
                                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                                  }`}
                                >
                                  {isPending ? '🔍 Review' : '✏️ Edit & Rectify'}
                                </button>

                                <button
                                  onClick={() => handleDeletePermanently(street)}
                                  className="px-2.5 py-1.5 text-xs font-semibold text-zinc-400 hover:text-red-700 bg-zinc-100 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete street permanently"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================== */
          /* 2. EDIT / CREATE WORKSPACE WITH MAP & EXPLICIT PIN FLOW   */
          /* ========================================================== */
          <div className="flex-1 flex flex-col lg:flex-row gap-5 w-full items-start">
            {/* Left Column: Optional Street List Sidebar (collapsible) */}
            {isSidebarOpen && (
              <div className="w-full lg:w-87.5 shrink-0 bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden flex flex-col transition-all duration-200">
                <div className="p-3 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    Streets Directory
                  </span>
                  <button
                    onClick={startCreateNew}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    ＋ New Street
                  </button>
                </div>

                {/* Tabs */}
                <div className="grid grid-cols-4 border-b border-zinc-200 text-[10px] font-semibold text-center bg-zinc-50">
                  <button
                    onClick={() => setActiveTab('PENDING')}
                    className={`py-2.5 transition-colors cursor-pointer ${
                      activeTab === 'PENDING' ? 'bg-white text-blue-600 border-b-2 border-blue-600 font-bold' : 'text-zinc-500'
                    }`}
                  >
                    Pending ({pendingCount})
                  </button>
                  <button
                    onClick={() => setActiveTab('APPROVED')}
                    className={`py-2.5 transition-colors cursor-pointer ${
                      activeTab === 'APPROVED' ? 'bg-white text-blue-600 border-b-2 border-blue-600 font-bold' : 'text-zinc-500'
                    }`}
                  >
                    Published ({approvedCount})
                  </button>
                  <button
                    onClick={() => setActiveTab('REJECTED')}
                    className={`py-2.5 transition-colors cursor-pointer ${
                      activeTab === 'REJECTED' ? 'bg-white text-red-600 border-b-2 border-red-600 font-bold' : 'text-zinc-500'
                    }`}
                  >
                    Rejected ({rejectedCount})
                  </button>
                  <button
                    onClick={() => setActiveTab('ALL')}
                    className={`py-2.5 transition-colors cursor-pointer ${
                      activeTab === 'ALL' ? 'bg-white text-blue-600 border-b-2 border-blue-600 font-bold' : 'text-zinc-500'
                    }`}
                  >
                    All ({allStreets.length})
                  </button>
                </div>

                {/* Search Bar */}
                <div className="p-2.5 border-b border-zinc-100 bg-white">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter list..."
                    className="w-full px-2.5 py-1 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800"
                  />
                </div>

                {/* List */}
                <div className="divide-y divide-zinc-100 max-h-[calc(100vh-230px)] overflow-y-auto">
                  {filteredStreets.map((s) => {
                    const isSelected = selectedStreet?.id === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => selectStreet(s)}
                        className={`w-full text-left p-3 hover:bg-zinc-50 transition-all cursor-pointer ${
                          isSelected ? 'bg-blue-50/75 border-l-4 border-blue-600 shadow-xs' : 'border-l-4 border-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <h4 className={`text-xs font-semibold truncate ${isSelected ? 'text-blue-950' : 'text-zinc-900'}`}>
                            {s.name}
                          </h4>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase bg-zinc-100 text-zinc-600 shrink-0">
                            {s.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">
                          {s.description || 'No description.'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Right Column: Active Editor Workspace */}
            <div className="flex-1 w-full min-w-0">
              <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden flex flex-col">
                {/* Header Details with Back to Dashboard Button */}
                <div className="px-6 py-3.5 border-b border-zinc-200 bg-zinc-50/70 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={backToDashboard}
                      className="px-3 py-1.5 text-xs font-bold text-zinc-700 bg-white hover:bg-zinc-100 rounded-lg border border-zinc-200 transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
                    >
                      <span>←</span> Back to Dashboard
                    </button>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                          {isCreatingNew ? 'Create New Street' : 'Editing Street'}
                        </span>
                        {!isCreatingNew && (
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                              selectedStreet.status === 'PENDING'
                                ? 'bg-amber-100 text-amber-800'
                                : selectedStreet.status === 'REJECTED'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {selectedStreet.status}
                          </span>
                        )}
                      </div>
                      {!isCreatingNew && (
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          ID: <span className="font-mono">{selectedStreet.id}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-medium text-zinc-600 bg-zinc-100 px-3 py-1.5 rounded-xl border border-zinc-200">
                    <span>🟢 Start {editablePoints.length > 0 ? '✓' : '—'}</span>
                    <span>•</span>
                    <span>🔵 {middlePins.length} Middle Pins</span>
                    <span>•</span>
                    <span>🔴 End {editablePoints.length > 1 ? '✓' : '—'}</span>
                    <span>•</span>
                    <span className="font-semibold text-blue-700">
                      {alignmentMode === 'auto' ? `🚗 Road Snapped (${currentPath.length} pts)` : `✍️ Manual (${editablePoints.length} pts)`}
                    </span>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Street Name & Sources */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">
                        Street / Place Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3.5 py-2 border border-zinc-300 rounded-xl text-base font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        placeholder="e.g. Park Street"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">
                        Sources & References
                      </label>
                      {isCreatingNew ? (
                        <textarea
                          rows={2}
                          value={newStreetSources}
                          onChange={(e) => setNewStreetSources(e.target.value)}
                          placeholder="References or URLs (one per line)..."
                          className="w-full px-3 py-1.5 text-xs border border-zinc-300 rounded-xl bg-white resize-none"
                        />
                      ) : (
                        <div className="bg-zinc-50 rounded-xl border border-zinc-200 p-2.5 max-h-24 overflow-y-auto">
                          {selectedStreet?.sources && selectedStreet.sources.length > 0 ? (
                            selectedStreet.sources.map((s: any, idx: number) => (
                              <div key={s.id || idx} className="text-xs flex items-start gap-1.5 text-zinc-700">
                                <span className="text-zinc-400">•</span>
                                {s.url ? (
                                  <a href={s.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate">
                                    {s.title}
                                  </a>
                                ) : (
                                  <span className="truncate">{s.title}</span>
                                )}
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-zinc-400 italic">No references or sources on record.</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">
                      Historical Description
                    </label>
                    <textarea
                      rows={3}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-3.5 py-2 border border-zinc-300 rounded-xl text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-y"
                      placeholder="Add or refine historical context, colonial names, notable architecture..."
                    />
                  </div>

                  {/* Interactive Street Geometry & Pin Control Section */}
                  <div>
                    {/* Control Top Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-800">
                          Geometry Alignment & Pin Flow
                        </label>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Auto mode routes through your Start (🟢), Middle Waypoints (🔵), and End (🔴) pins.
                        </p>
                      </div>

                      {/* Mode Toggle: Auto vs Manual & Snapping Engine */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200">
                          <button
                            type="button"
                            onClick={() => handleSwitchAlignmentMode('auto')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                              alignmentMode === 'auto'
                                ? 'bg-white text-blue-700 shadow-xs'
                                : 'text-zinc-500 hover:text-zinc-900'
                            }`}
                          >
                            🚗 Auto (Road Snapping)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSwitchAlignmentMode('manual')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                              alignmentMode === 'manual'
                                ? 'bg-white text-blue-700 shadow-xs'
                                : 'text-zinc-500 hover:text-zinc-900'
                            }`}
                          >
                            ✍️ Manual (Custom Pins)
                          </button>
                        </div>

                        {alignmentMode === 'auto' && (
                          <div className="flex items-center bg-zinc-100 p-0.5 rounded-xl border border-zinc-200">
                            <button
                              type="button"
                              onClick={() => setAutoTravelMode('walking')}
                              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                                autoTravelMode === 'walking'
                                  ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                                  : 'text-zinc-500 hover:text-zinc-800'
                              }`}
                              title="Bi-directional street path: ignores one-way car traffic to prevent detour loops"
                            >
                              🚶 Bi-directional (No Loops)
                            </button>
                            <button
                              type="button"
                              onClick={() => setAutoTravelMode('driving')}
                              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                                autoTravelMode === 'driving'
                                  ? 'bg-white text-blue-800 shadow-2xs font-bold'
                                  : 'text-zinc-500 hover:text-zinc-800'
                              }`}
                              title="Vehicular traffic rules: respects one-way car laws"
                            >
                              🚗 Car Traffic
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Pin Placement Tools & Pin Operations Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 bg-zinc-50 rounded-xl border border-zinc-200 mb-2.5">
                      {/* Pin Placement Tools */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-zinc-600 mr-1">Pin Tool:</span>
                        
                        <button
                          type="button"
                          onClick={() => setActivePinTool(prev => prev === 'start' ? 'none' : 'start')}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                            activePinTool === 'start'
                              ? 'bg-green-600 text-white border-green-700 shadow-xs ring-2 ring-green-300'
                              : 'bg-white hover:bg-green-50 text-green-800 border-green-200'
                          }`}
                          title="Click on map to position the Start Pin (Origin)"
                        >
                          🟢 {activePinTool === 'start' ? 'Click Map for Start' : 'Set Start Pin'}
                        </button>

                        <button
                          type="button"
                          onClick={() => setActivePinTool(prev => prev === 'middle' ? 'none' : 'middle')}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                            activePinTool === 'middle'
                              ? 'bg-blue-600 text-white border-blue-700 shadow-xs ring-2 ring-blue-300'
                              : 'bg-white hover:bg-blue-50 text-blue-800 border-blue-200'
                          }`}
                          title="Click anywhere along the road to place guide waypoints between start and end"
                        >
                          🔵 {activePinTool === 'middle' ? 'Click Map for Waypoint' : '＋ Add Middle Pin'}
                        </button>

                        <button
                          type="button"
                          onClick={() => setActivePinTool(prev => prev === 'end' ? 'none' : 'end')}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                            activePinTool === 'end'
                              ? 'bg-red-600 text-white border-red-700 shadow-xs ring-2 ring-red-300'
                              : 'bg-white hover:bg-red-50 text-red-800 border-red-200'
                          }`}
                          title="Click on map to position the End Pin (Destination)"
                        >
                          🔴 {activePinTool === 'end' ? 'Click Map for End' : 'Set End Pin'}
                        </button>

                        {snappedPath.length > 2 && middlePins.length === 0 && (
                          <button
                            type="button"
                            onClick={handlePopulateMiddlePins}
                            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer"
                            title="Automatically place draggable waypoints along the current snapped road"
                          >
                            📍 Distribute Middle Pins
                          </button>
                        )}

                        {activePinTool !== 'none' && (
                          <button
                            type="button"
                            onClick={() => setActivePinTool('none')}
                            className="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-800 underline cursor-pointer"
                          >
                            Cancel Tool
                          </button>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={handleClearMiddlePins}
                          className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 transition-colors cursor-pointer shadow-2xs"
                          title="Keep start and end pins, remove all intermediate middle waypoints"
                        >
                          🧹 Clear Middle Pins
                        </button>

                        <button
                          type="button"
                          onClick={handleClearAllPins}
                          className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors cursor-pointer"
                          title="Clear all pins and place fresh ones"
                        >
                          🗑️ Clear All Pins
                        </button>

                        {alignmentMode === 'auto' && (
                          <button
                            type="button"
                            onClick={() => runAutoRoadDetection(editablePoints)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors cursor-pointer"
                            title="Re-run road snapping using all current pins"
                          >
                            ⚡ Snap to Road
                          </button>
                        )}

                        {!isCreatingNew && (
                          <button
                            type="button"
                            onClick={handleResetPoints}
                            className="px-2.5 py-1.5 text-xs font-medium rounded-lg text-zinc-500 hover:text-zinc-800 transition-colors cursor-pointer"
                            title="Revert to database original submission"
                          >
                            ↺ Reset
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Status Guidance */}
                    <div className="text-xs px-3.5 py-2.5 rounded-xl mb-2.5 flex items-center justify-between border bg-white shadow-2xs">
                      <div className="flex items-center gap-2">
                        {alignmentMode === 'auto' ? (
                          autoStatus === 'detecting' ? (
                            <span className="text-amber-700 flex items-center gap-2 font-semibold">
                              <span className="inline-block w-3.5 h-3.5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                              Snapping through Start, Middle, and End pins...
                            </span>
                          ) : autoStatus === 'found' ? (
                            <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                              <span className="font-bold">✓ Road snapped:</span> {autoRoadName || 'Road Network'} ({currentPath.length} coordinates).
                              {middlePins.length > 0 && <span className="text-zinc-500 font-normal">Routed via {middlePins.length} middle waypoint(s).</span>}
                            </span>
                          ) : autoStatus === 'not_found' ? (
                            <span className="text-red-700 font-medium">
                              ⚠️ No road route found between pins. Drop a middle pin along the street, or switch to <strong>Manual</strong> mode.
                            </span>
                          ) : (
                            <span className="text-blue-800 font-medium">
                              🚗 <strong>Auto Mode:</strong> Drag Start (🟢), Middle (🔵), or End (🔴) pins to align. Street curves snap automatically.
                            </span>
                          )
                        ) : (
                          <span className="text-zinc-700 font-medium">
                            ✍️ <strong>Manual Mode:</strong> The polyline directly follows your custom pins without road snapping.
                          </span>
                        )}
                      </div>

                      {activePinTool !== 'none' && (
                        <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 animate-pulse">
                          Click map to drop {activePinTool} pin
                        </span>
                      )}
                    </div>

                    {/* Interactive Admin Map Viewport */}
                    <div className={`w-full rounded-2xl overflow-hidden border border-zinc-300 bg-zinc-100 shadow-inner relative transition-all duration-300 ${
                      isMapExpanded ? 'h-170' : 'h-130'
                    }`}>
                      <Map
                        key={selectedStreet?.id || 'new-street-map'}
                        mapTypeId={mapTypeId}
                        defaultCenter={centerPoint}
                        defaultZoom={15}
                        gestureHandling="greedy"
                        disableDefaultUI={false}
                        disableDoubleClickZoom={true}
                        mapTypeControl={false}
                        mapId="admin-interactive-map"
                        onClick={(e) => {
                          if (e.detail.latLng) {
                            handleMapClick(e.detail.latLng);
                          }
                        }}
                      >
                        <AdminMapController
                          points={editablePoints}
                          fitTrigger={fitTrigger}
                        />

                        {/* Map Overlay Controls */}
                        <MapControl position={ControlPosition.TOP_LEFT}>
                          <div className="flex items-center gap-1.5 m-3.5 bg-white/95 backdrop-blur-md p-1.5 rounded-xl shadow-md border border-zinc-200 pointer-events-auto">
                            <div className="flex bg-zinc-100 rounded-lg p-0.5">
                              <button
                                type="button"
                                onClick={() => setMapTypeId('roadmap')}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                                  mapTypeId === 'roadmap' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-500 hover:text-zinc-900'
                                }`}
                              >
                                Map
                              </button>
                              <button
                                type="button"
                                onClick={() => setMapTypeId('satellite')}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                                  mapTypeId === 'satellite' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-500 hover:text-zinc-900'
                                }`}
                              >
                                Satellite
                              </button>
                            </div>

                            <div className="w-px h-4 bg-zinc-200 mx-0.5" />

                            <button
                              type="button"
                              onClick={() => setFitTrigger(prev => prev + 1)}
                              className="px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:text-zinc-950 bg-zinc-50 hover:bg-zinc-100 rounded-md border border-zinc-200 transition-colors cursor-pointer"
                              title="Center map to fit all pins"
                            >
                              🎯 Fit Route
                            </button>

                            <button
                              type="button"
                              onClick={() => setIsMapExpanded(prev => !prev)}
                              className="px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:text-zinc-950 bg-zinc-50 hover:bg-zinc-100 rounded-md border border-zinc-200 transition-colors cursor-pointer"
                              title="Toggle bigger map view"
                            >
                              {isMapExpanded ? '⤡ Compact Map' : '⤢ Expand Map'}
                            </button>
                          </div>
                        </MapControl>

                        {/* Connected Polyline */}
                        {currentPath.length >= 2 && (
                          <Polyline
                            path={currentPath}
                            strokeColor="#2563eb"
                            strokeWeight={4}
                            strokeOpacity={0.9}
                          />
                        )}

                        {/* Draggable Markers for every pin */}
                        {editablePoints.map((pt, i) => {
                          const isStart = i === 0;
                          const isEnd = i === editablePoints.length - 1 && editablePoints.length > 1;
                          const waypointNum = i;
                          const isSelected = selectedPinIndex === i;

                          return (
                            <AdvancedMarker
                              key={`admin-pin-${i}`}
                              position={pt}
                              draggable={true}
                              clickable={true}
                              title={`${isStart ? 'Start Point (🟢)' : isEnd ? 'End Point (🔴)' : `Middle Waypoint #${waypointNum} (🔵)`} - Double-click / Double-tap to delete, or drag to move`}
                              onClick={(e: any) => handlePinInteraction(i, e)}
                              onDragStart={() => {
                                isDraggingRef.current = true;
                                markerInteractedRef.current = Date.now();
                              }}
                              onDragEnd={(e: any) => {
                                markerInteractedRef.current = Date.now();
                                setTimeout(() => {
                                  isDraggingRef.current = false;
                                }, 120);
                                if (e.latLng) {
                                  handleDragPoint(i, {
                                    lat: e.latLng.lat(),
                                    lng: e.latLng.lng(),
                                  });
                                }
                              }}
                            >
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.nativeEvent?.stopPropagation?.();
                                  e.nativeEvent?.stopImmediatePropagation?.();
                                  handlePinInteraction(i, e);
                                }}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  e.nativeEvent?.stopPropagation?.();
                                  e.nativeEvent?.stopImmediatePropagation?.();
                                  markerInteractedRef.current = Date.now();
                                  handleDeletePoint(i);
                                }}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  e.nativeEvent?.stopPropagation?.();
                                  e.nativeEvent?.stopImmediatePropagation?.();
                                  markerInteractedRef.current = Date.now();
                                  handleDeletePoint(i);
                                }}
                                className="relative cursor-pointer select-none group"
                              >
                                {isSelected && (
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.nativeEvent?.stopPropagation?.();
                                      e.nativeEvent?.stopImmediatePropagation?.();
                                      markerInteractedRef.current = Date.now();
                                      handleDeletePoint(i);
                                    }}
                                    className="absolute -top-10 left-1/2 -translate-x-1/2 z-50 bg-zinc-900/95 text-white px-2.5 py-1 rounded-lg shadow-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap border border-zinc-700 pointer-events-auto animate-in fade-in zoom-in-95 duration-150"
                                  >
                                    <span>{isStart ? '🟢 Start' : isEnd ? '🔴 End' : `🔵 Pin #${i}`}</span>
                                    <span className="text-red-400 hover:text-red-300 font-bold bg-red-950/80 px-1.5 py-0.5 rounded border border-red-800/60 cursor-pointer">
                                      🗑️ Delete
                                    </span>
                                  </div>
                                )}

                                {isStart ? (
                                  <Pin background="#16a34a" borderColor="#15803d" glyphColor="#ffffff" scale={1.05} />
                                ) : isEnd ? (
                                  <Pin background="#dc2626" borderColor="#b91c1c" glyphColor="#ffffff" scale={1.05} />
                                ) : (
                                  <Pin background="#2563eb" borderColor="#1d4ed8" glyphColor="#ffffff" scale={0.85} />
                                )}
                              </div>
                            </AdvancedMarker>
                          );
                        })}
                      </Map>
                    </div>

                    {/* Pin Breakdown & Waypoint Management Bar */}
                    <div className="mt-3 p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-zinc-700">
                        <span>Route Sequence ({editablePoints.length} total pins)</span>
                        <span className="text-[11px] font-normal text-zinc-500">
                          Drag markers on map, or use buttons below to modify
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {editablePoints.map((p, idx) => {
                          const isStart = idx === 0;
                          const isEnd = idx === editablePoints.length - 1 && editablePoints.length > 1;
                          const isWaypoint = !isStart && !isEnd;

                          return (
                            <div
                              key={idx}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border shadow-2xs ${
                                isStart
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                                  : isEnd
                                  ? 'bg-red-50 border-red-300 text-red-900'
                                  : 'bg-blue-50 border-blue-300 text-blue-900'
                              }`}
                            >
                              <span className={`w-2.5 h-2.5 rounded-full ${
                                isStart ? 'bg-emerald-600' : isEnd ? 'bg-red-600' : 'bg-blue-600'
                              }`} />
                              
                              <span>{isStart ? 'Start (🟢)' : isEnd ? 'End (🔴)' : `Middle #${idx} (🔵)`}</span>
                              
                              <span className="font-mono text-[10px] text-zinc-500 font-normal">
                                {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                              </span>

                              {isWaypoint && (
                                <div className="flex items-center gap-0.5 ml-1">
                                  {idx > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleMoveWaypoint(idx, 'up')}
                                      className="text-zinc-400 hover:text-zinc-800 px-0.5 cursor-pointer"
                                      title="Move waypoint earlier"
                                    >
                                      ↑
                                    </button>
                                  )}
                                  {idx < editablePoints.length - 2 && (
                                    <button
                                      type="button"
                                      onClick={() => handleMoveWaypoint(idx, 'down')}
                                      className="text-zinc-400 hover:text-zinc-800 px-0.5 cursor-pointer"
                                      title="Move waypoint later"
                                    >
                                      ↓
                                    </button>
                                  )}
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={() => handleDeletePoint(idx)}
                                className="text-zinc-400 hover:text-red-700 font-bold ml-1.5 text-sm cursor-pointer"
                                title="Delete this pin"
                              >
                                ×
                              </button>
                            </div>
                          );
                        })}

                        {editablePoints.length === 0 && (
                          <p className="text-xs text-zinc-400 italic">No pins placed yet. Use the buttons above or click on the map to start.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons Footer */}
                <div className="p-5 bg-zinc-50 border-t border-zinc-200 flex flex-wrap items-center justify-between gap-3">
                  {isCreatingNew ? (
                    <>
                      <button
                        type="button"
                        onClick={backToDashboard}
                        className="px-4 py-2 rounded-xl font-semibold text-xs text-zinc-600 hover:text-zinc-900 bg-white hover:bg-zinc-100 border border-zinc-200 transition-colors cursor-pointer"
                      >
                        Cancel & Return
                      </button>

                      <div className="flex items-center gap-2.5">
                        <button
                          disabled={isProcessing || editablePoints.length < 2}
                          onClick={() => handleCreateNewStreet('PENDING')}
                          className="px-4 py-2.5 rounded-xl font-semibold text-xs text-amber-800 bg-amber-100 hover:bg-amber-200 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          Save as Pending Review
                        </button>

                        <button
                          disabled={isProcessing || editablePoints.length < 2}
                          onClick={() => handleCreateNewStreet('APPROVED')}
                          className="px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-sm hover:shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                        >
                          {isProcessing ? 'Publishing...' : `🚀 Create & Publish to Map (${currentPath.length} pts)`}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={isProcessing}
                          onClick={() => handleDeletePermanently(selectedStreet)}
                          className="px-4 py-2 rounded-xl font-semibold text-xs text-red-600 hover:text-red-800 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          🗑️ Delete Street
                        </button>

                        {selectedStreet.status !== 'REJECTED' && (
                          <button
                            disabled={isProcessing}
                            onClick={handleReject}
                            className="px-4 py-2 rounded-xl font-semibold text-xs text-red-700 bg-red-100 hover:bg-red-200 transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            Reject
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5">
                        {selectedStreet.status === 'APPROVED' ? (
                          <>
                            <button
                              disabled={isProcessing}
                              onClick={() => handleSave('PENDING')}
                              className="px-4 py-2 rounded-xl font-semibold text-xs text-amber-800 bg-amber-100 hover:bg-amber-200 transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              Set to Pending
                            </button>

                            <button
                              disabled={isProcessing || editablePoints.length < 2}
                              onClick={() => handleSave('APPROVED')}
                              className="px-6 py-2.5 rounded-xl font-semibold text-sm text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-sm hover:shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                            >
                              {isProcessing ? 'Saving...' : `💾 Save Changes (${currentPath.length} pts)`}
                            </button>
                          </>
                        ) : (
                          <button
                            disabled={isProcessing || editablePoints.length < 2}
                            onClick={() => handleSave('APPROVED')}
                            className="px-6 py-2.5 rounded-xl font-semibold text-sm text-white bg-green-600 hover:bg-green-700 transition-all shadow-sm hover:shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                          >
                            {isProcessing ? 'Publishing...' : `✓ Approve & Publish to Map (${currentPath.length} pts)`}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
      <AdminDashboardContent />
    </APIProvider>
  );
}
