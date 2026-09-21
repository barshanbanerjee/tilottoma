"use client";

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Trash2,
  Clock,
  MapPin,
  Tag,
  Utensils,
  Landmark,
  BookOpen,
  ShoppingBag,
  AlertCircle,
  Plus,
  Compass,
  Pencil,
} from 'lucide-react';
import AddPlaceModal from '@/components/Recommendations/AddPlaceModal';
import EditPlaceModal from './EditPlaceModal';

interface RecommendationAdminItem {
  id: string;
  streetId?: string | null;
  streetName?: string | null;
  zone: string;
  title: string;
  category: string;
  description: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  contributorName?: string | null;
  createdAt: string;
}

interface RecommendationsReviewTabProps {
  initialOpenAdd?: boolean;
  onAddModalClosed?: () => void;
  initialStreetId?: string | null;
  initialStreetName?: string | null;
}

export default function RecommendationsReviewTab({
  initialOpenAdd = false,
  onAddModalClosed,
  initialStreetId,
  initialStreetName,
}: RecommendationsReviewTabProps) {
  const [items, setItems] = useState<RecommendationAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Add Place / Recommendation Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(initialOpenAdd);
  const [editingPlace, setEditingPlace] = useState<RecommendationAdminItem | null>(null);

  useEffect(() => {
    if (initialOpenAdd) {
      setIsAddModalOpen(true);
    }
  }, [initialOpenAdd]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/recommendations', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (e) {
      console.error('Failed to load admin recommendations:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleUpdateStatus = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/admin/recommendations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated = await res.json();
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: updated.status } : item)));
      }
    } catch (e) {
      console.error('Status update failed:', e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this recommendation?')) return;
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/admin/recommendations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (e) {
      console.error('Delete failed:', e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const pendingCount = items.filter((i) => i.status === 'PENDING').length;
  const approvedCount = items.filter((i) => i.status === 'APPROVED').length;
  const rejectedCount = items.filter((i) => i.status === 'REJECTED').length;

  const filteredItems = items.filter((i) => (filter === 'ALL' ? true : i.status === filter));

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div
          onClick={() => setFilter('PENDING')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            filter === 'PENDING' ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-300' : 'bg-white border-zinc-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Pending Review</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          </div>
          <div className="text-3xl font-extrabold text-zinc-900 mt-2 font-mono">{pendingCount}</div>
          <p className="text-xs text-zinc-500 mt-1">Community recommendations awaiting moderation</p>
        </div>

        <div
          onClick={() => setFilter('APPROVED')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            filter === 'APPROVED' ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-300' : 'bg-white border-zinc-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Published Spots</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
          <div className="text-3xl font-extrabold text-zinc-900 mt-2 font-mono">{approvedCount}</div>
          <p className="text-xs text-zinc-500 mt-1">Live on public street panels</p>
        </div>

        <div
          onClick={() => setFilter('REJECTED')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            filter === 'REJECTED' ? 'bg-red-50 border-red-300 ring-2 ring-red-300' : 'bg-white border-zinc-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-red-800">Rejected</span>
            <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
          </div>
          <div className="text-3xl font-extrabold text-zinc-900 mt-2 font-mono">{rejectedCount}</div>
          <p className="text-xs text-zinc-500 mt-1">Spam or inaccurate recommendations</p>
        </div>

        <div
          onClick={() => setFilter('ALL')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            filter === 'ALL' ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-300' : 'bg-white border-zinc-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-800">Total Catalog</span>
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          </div>
          <div className="text-3xl font-extrabold text-zinc-900 mt-2 font-mono">{items.length}</div>
          <p className="text-xs text-zinc-500 mt-1">All recommendations submitted</p>
        </div>
      </div>

      {/* Recommendations List Container */}
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setFilter('PENDING')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
                filter === 'PENDING' ? 'bg-amber-600 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setFilter('APPROVED')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
                filter === 'APPROVED' ? 'bg-emerald-600 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              Published ({approvedCount})
            </button>
            <button
              onClick={() => setFilter('REJECTED')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
                filter === 'REJECTED' ? 'bg-red-600 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              Rejected ({rejectedCount})
            </button>
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
                filter === 'ALL' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              All ({items.length})
            </button>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Place / Spot</span>
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center text-zinc-500 text-xs">Loading recommendations...</div>
        ) : filteredItems.length > 0 ? (
          <div className="divide-y divide-zinc-100">
            {filteredItems.map((item) => (
              <div key={item.id} className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-zinc-50/60 transition-colors">
                <div className="space-y-1.5 flex-1 max-w-2xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-serif font-bold text-base text-zinc-900">{item.title}</h4>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      {item.category}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        item.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'REJECTED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-600 leading-relaxed">{item.description}</p>

                  <div className="flex items-center gap-3 text-[11px] text-zinc-400 flex-wrap">
                    {item.address && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-amber-600" />
                        <span>{item.address}</span>
                      </span>
                    )}
                    {item.streetName && (
                      <span className="flex items-center gap-1 font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        Corridor: {item.streetName}
                      </span>
                    )}
                    <span>Zone: {item.zone}</span>
                    {item.lat && item.lng && (
                      <span className="font-mono text-[10px] text-zinc-500">
                        {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
                      </span>
                    )}
                    {item.contributorName && (
                      <span className="text-zinc-500">By {item.contributorName}</span>
                    )}
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Moderation Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {item.status === 'PENDING' && (
                    <>
                      <button
                        disabled={actionLoadingId === item.id}
                        onClick={() => handleUpdateStatus(item.id, 'APPROVED')}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                      <button
                        disabled={actionLoadingId === item.id}
                        onClick={() => handleUpdateStatus(item.id, 'REJECTED')}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </>
                  )}

                  {item.status === 'APPROVED' && (
                    <button
                      disabled={actionLoadingId === item.id}
                      onClick={() => handleUpdateStatus(item.id, 'REJECTED')}
                      className="px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    >
                      Unpublish
                    </button>
                  )}

                  {item.status === 'REJECTED' && (
                    <button
                      disabled={actionLoadingId === item.id}
                      onClick={() => handleUpdateStatus(item.id, 'APPROVED')}
                      className="px-2.5 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                    >
                      Re-approve
                    </button>
                  )}

                  <button
                    disabled={actionLoadingId === item.id}
                    onClick={() => setEditingPlace(item)}
                    className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-blue-200/60"
                    title="Edit place title, coordinates, category, address, or folklore"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>

                  <button
                    disabled={actionLoadingId === item.id}
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="Delete permanently"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-zinc-400 text-xs">
            No recommendations in this status tab.
          </div>
        )}
      </div>

      {/* MODERN ADD PLACE MODAL WITH AUTO (GOOGLE PLACES) & MANUAL PIN MODES */}
      {isAddModalOpen && (
        <AddPlaceModal
          isOpen={isAddModalOpen}
          initialStreetId={initialStreetId}
          initialStreetName={initialStreetName}
          onClose={() => {
            setIsAddModalOpen(false);
            onAddModalClosed?.();
          }}
          onSuccess={() => {
            setIsAddModalOpen(false);
            onAddModalClosed?.();
            fetchItems();
          }}
        />
      )}

      {/* EDIT PLACE MODAL */}
      {editingPlace && (
        <EditPlaceModal
          isOpen={!!editingPlace}
          place={editingPlace}
          onClose={() => setEditingPlace(null)}
          onSuccess={() => {
            setEditingPlace(null);
            fetchItems();
          }}
        />
      )}
    </div>
  );
}
