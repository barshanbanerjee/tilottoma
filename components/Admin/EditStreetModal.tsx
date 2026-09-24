"use client";

import React, { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  Tag,
  History,
  Plus,
  Trash2,
  AlertCircle,
  Save,
  BookOpen,
  Milestone,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface HistoricalNameItem {
  id?: string;
  name: string;
  validFrom: string;
  validUntil: string;
  explanation: string;
  source: string;
}

interface SourceItem {
  id?: string;
  title: string;
  author: string;
  url: string;
}

interface EditStreetModalProps {
  isOpen: boolean;
  onClose: () => void;
  street: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    tags?: string[] | null;
    status?: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
    historicalNames?: any[] | null;
    sources?: any[] | null;
  } | null;
  onSuccess?: (updated: any) => void;
}

export default function EditStreetModal({
  isOpen,
  onClose,
  street,
  onSuccess,
}: EditStreetModalProps) {
  const { user, canModerate } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('APPROVED');
  
  // Tags state
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Historical / Former names
  const [historicalNames, setHistoricalNames] = useState<HistoricalNameItem[]>([]);

  // Citations / Sources
  const [sources, setSources] = useState<SourceItem[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync street data when opened
  useEffect(() => {
    if (street) {
      setName(street.name || '');
      setDescription(street.description || '');
      setStatus((street.status as any) || 'APPROVED');
      setTags(Array.isArray(street.tags) ? street.tags : []);
      setTagInput('');

      setHistoricalNames(
        Array.isArray(street.historicalNames)
          ? street.historicalNames.map((h: any) => ({
              id: h.id,
              name: h.name || '',
              validFrom: h.validFrom || '',
              validUntil: h.validUntil || '',
              explanation: h.explanation || '',
              source: h.source || '',
            }))
          : []
      );

      setSources(
        Array.isArray(street.sources)
          ? street.sources.map((s: any) => ({
              id: s.id,
              title: s.title || '',
              author: s.author || '',
              url: s.url || '',
            }))
          : []
      );

      setError(null);
      setSuccessMsg(null);
    }
  }, [street, isOpen]);

  // Tag helper functions
  const handleAddTag = () => {
    const trimmed = tagInput.trim().replace(/^#+/, '');
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Historical Name helper functions
  const handleAddHistoricalName = () => {
    setHistoricalNames([
      ...historicalNames,
      {
        name: '',
        validFrom: '',
        validUntil: '',
        explanation: '',
        source: '',
      },
    ]);
  };

  const handleUpdateHistoricalName = (index: number, field: keyof HistoricalNameItem, value: string) => {
    const updated = [...historicalNames];
    updated[index] = { ...updated[index], [field]: value };
    setHistoricalNames(updated);
  };

  const handleRemoveHistoricalName = (index: number) => {
    setHistoricalNames(historicalNames.filter((_, i) => i !== index));
  };

  // Sources helper functions
  const handleAddSource = () => {
    setSources([
      ...sources,
      {
        title: '',
        author: '',
        url: '',
      },
    ]);
  };

  const handleUpdateSource = (index: number, field: keyof SourceItem, value: string) => {
    const updated = [...sources];
    updated[index] = { ...updated[index], [field]: value };
    setSources(updated);
  };

  const handleRemoveSource = (index: number) => {
    setSources(sources.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!street) return;

    if (!name.trim()) {
      setError('Street name is required.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: any = {
        name: name.trim(),
        description: description.trim(),
        tags,
        historicalNames: historicalNames.filter((h) => h.name.trim().length > 0),
        sources: sources.filter((s) => s.title.trim().length > 0),
      };

      if (canModerate) {
        payload.status = status;
      } else {
        payload.status = 'PENDING';
      }

      const res = await fetch(`/api/admin/contributions/${street.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update street.');
        return;
      }

      const updatedStreet = data.street || { ...street, ...payload };
      window.dispatchEvent(new CustomEvent('street:updated', { detail: updatedStreet }));
      if (onSuccess) onSuccess(updatedStreet);

      if (!canModerate) {
        setSuccessMsg('Street edits submitted for Admin approval! Review status: PENDING.');
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Network error updating street.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !street) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl max-w-3xl w-full overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Milestone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>Edit Historical Street / Corridor</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  {street.slug}
                </span>
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Update street nomenclature, historical former names, area tags, and archival monograph
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-5 font-sans text-xs">
          {/* Contributor Approval Flow Banner */}
          {!canModerate && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-xs">Contributor Submission Workflow</p>
                <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5 leading-relaxed">
                  As a Contributor, your proposed edits will be submitted to the Admin approval queue. This corridor will be marked <strong>PENDING</strong> until reviewed and approved by an administrator.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Street Name & Status Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                Official Current Street Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Netaji Subhash Road"
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                {canModerate ? 'Publication Status' : 'Review Status'}
              </label>
              {canModerate ? (
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="APPROVED">🟢 APPROVED (Live)</option>
                  <option value="PENDING">🟡 PENDING (Review)</option>
                  <option value="REJECTED">🔴 REJECTED</option>
                </select>
              ) : (
                <div className="w-full px-3 py-2 border border-amber-200 dark:border-amber-800/80 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 font-medium text-xs flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                  <span>Admin Approval (PENDING)</span>
                </div>
              )}
            </div>
          </div>

          {/* Area & Thematic Tags */}
          <div className="space-y-2 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-600" />
                <span>Area & Thematic Tags</span>
              </label>
              <span className="text-[10px] text-zinc-400">e.g. Colonial, Heritage, Tramway, NorthKolkata</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-lg text-xs font-mono border border-zinc-200 dark:border-zinc-700 shadow-2xs"
                >
                  <span>#{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {tags.length === 0 && (
                <span className="text-zinc-400 text-xs italic">No tags added yet.</span>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Type tag name and click Add Tag..."
                className="flex-1 px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-medium text-xs hover:bg-zinc-800 dark:hover:bg-white transition-colors cursor-pointer shrink-0"
              >
                ＋ Add Tag
              </button>
            </div>
          </div>

          {/* Historical / Old Names Timeline */}
          <div className="space-y-3 p-3.5 rounded-xl bg-amber-50/30 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-amber-600" />
                  <span>Historical Former Names & Chronology</span>
                </label>
                <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80">
                  Document previous colonial or colloquial names to build the interactive chronology
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddHistoricalName}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-[11px] transition-colors cursor-pointer shadow-2xs flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add Former Name</span>
              </button>
            </div>

            {historicalNames.length === 0 ? (
              <div className="text-center py-4 text-zinc-400 bg-white/60 dark:bg-zinc-900/40 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800">
                <p className="text-xs">No historical former names recorded yet.</p>
                <button
                  type="button"
                  onClick={handleAddHistoricalName}
                  className="text-amber-600 dark:text-amber-400 font-semibold text-xs mt-1 hover:underline cursor-pointer"
                >
                  ＋ Click here to add the street&apos;s colonial or original name
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {historicalNames.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400">
                        Historical Period #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveHistoricalName(idx)}
                        className="text-zinc-400 hover:text-red-500 p-1 transition-colors cursor-pointer"
                        title="Delete former name"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-zinc-500 mb-0.5">Former Name *</label>
                        <input
                          type="text"
                          required
                          value={item.name}
                          onChange={(e) => handleUpdateHistoricalName(idx, 'name', e.target.value)}
                          placeholder="e.g. Clive Street"
                          className="w-full px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs bg-zinc-50 dark:bg-zinc-950 font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-500 mb-0.5">Valid From</label>
                        <input
                          type="text"
                          value={item.validFrom}
                          onChange={(e) => handleUpdateHistoricalName(idx, 'validFrom', e.target.value)}
                          placeholder="e.g. 1757"
                          className="w-full px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs bg-zinc-50 dark:bg-zinc-950 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-500 mb-0.5">Valid Until</label>
                        <input
                          type="text"
                          value={item.validUntil}
                          onChange={(e) => handleUpdateHistoricalName(idx, 'validUntil', e.target.value)}
                          placeholder="e.g. 1947"
                          className="w-full px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs bg-zinc-50 dark:bg-zinc-950 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-zinc-500 mb-0.5">Explanation & Context</label>
                        <input
                          type="text"
                          value={item.explanation}
                          onChange={(e) => handleUpdateHistoricalName(idx, 'explanation', e.target.value)}
                          placeholder="e.g. Named in commemoration of Robert Clive after Plassey"
                          className="w-full px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs bg-zinc-50 dark:bg-zinc-950"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-500 mb-0.5">Archival Source / Gazette</label>
                        <input
                          type="text"
                          value={item.source}
                          onChange={(e) => handleUpdateHistoricalName(idx, 'source', e.target.value)}
                          placeholder="e.g. Calcutta Municipal Corporation Gazette 1948"
                          className="w-full px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs bg-zinc-50 dark:bg-zinc-950"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Historical Monograph Description */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
              Historical Archival Brief & Monograph *
            </label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Comprehensive architectural narrative, street origin, colonial merchants, freedom movement events, famous adda centers, and literary landmarks..."
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y leading-relaxed font-sans"
            />
          </div>

          {/* Citations & Bibliography Sources */}
          <div className="space-y-3 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                  <span>Citations, Books & Bibliography</span>
                </label>
                <p className="text-[10px] text-zinc-400">
                  Ground assertions with historical books, academic monographs, or archival links
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddSource}
                className="px-2.5 py-1 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg font-medium text-[11px] transition-colors cursor-pointer shadow-2xs flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add Citation</span>
              </button>
            </div>

            {sources.length === 0 ? (
              <div className="text-center py-3 text-zinc-400 text-xs italic">
                No citations added yet.
              </div>
            ) : (
              <div className="space-y-2">
                {sources.map((src, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center gap-2"
                  >
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        required
                        value={src.title}
                        onChange={(e) => handleUpdateSource(idx, 'title', e.target.value)}
                        placeholder="Book / Article Title *"
                        className="px-2.5 py-1 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs bg-zinc-50 dark:bg-zinc-950 font-medium"
                      />
                      <input
                        type="text"
                        value={src.author}
                        onChange={(e) => handleUpdateSource(idx, 'author', e.target.value)}
                        placeholder="Author / Historian"
                        className="px-2.5 py-1 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs bg-zinc-50 dark:bg-zinc-950"
                      />
                      <input
                        type="text"
                        value={src.url}
                        onChange={(e) => handleUpdateSource(idx, 'url', e.target.value)}
                        placeholder="URL / Catalog link (optional)"
                        className="px-2.5 py-1 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs bg-zinc-50 dark:bg-zinc-950 font-mono text-[11px]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveSource(idx)}
                      className="text-zinc-400 hover:text-red-500 p-1 cursor-pointer shrink-0"
                      title="Remove citation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{submitting ? 'Saving Changes...' : canModerate ? 'Save Street Changes' : 'Submit Edits for Approval'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
