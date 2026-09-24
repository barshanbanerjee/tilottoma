"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Clock, Share2, ExternalLink, Sparkles, UserCheck, ArrowUpRight } from 'lucide-react';

interface HeritageChronicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  street: {
    name: string;
    description?: string | null;
    historicalNames: {
      name: string;
      validFrom?: string | null;
      validUntil?: string | null;
      explanation?: string | null;
      source?: string | null;
    }[];
    sources: {
      title: string;
      author?: string | null;
      publisher?: string | null;
      url?: string | null;
    }[];
    tags?: string[] | null;
    blogLinks?: { title: string; url: string; author?: string }[] | null;
    contributorName?: string | null;
  };
}

export default function HeritageChronicleModal({
  isOpen,
  onClose,
  street,
}: HeritageChronicleModalProps) {
  if (!isOpen) return null;

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: street.name, url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-110 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          className="relative w-full max-w-3xl max-h-[90vh] bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-zinc-200/80 dark:border-zinc-800 flex flex-col overflow-hidden font-sans"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 pb-4 border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-300 text-[10px] font-mono uppercase tracking-wider mb-2">
                <FileText className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                HISTORICAL DOSSIER & GAZETTE ARCHIVE
              </div>
              <h2 className="text-xl sm:text-2xl font-sans font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                {street.name}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Documented municipal evolution and cartographic lineage across three centuries
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleShare}
                className="p-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors"
                title="Share dossier"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scrollable Story Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6 text-zinc-800 dark:text-zinc-200">
            {/* Overview Summary */}
            <section className="space-y-2">
              <h3 className="font-mono font-bold text-[10px] uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Executive Cartographic Summary
              </h3>
              <p className="text-sm sm:text-base leading-relaxed text-zinc-800 dark:text-zinc-200 font-sans">
                {street.description || 'No detailed monograph recorded yet for this street.'}
              </p>
            </section>

            {/* Nomenclature Progression */}
            {street.historicalNames && street.historicalNames.length > 0 && (
              <section className="space-y-3 pt-4 border-t border-zinc-200/80 dark:border-zinc-800">
                <h3 className="font-mono font-bold text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Chronological Designations
                </h3>

                <div className="space-y-2.5">
                  {/* Current Name First */}
                  <div className="p-3.5 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40">
                    <div className="flex justify-between items-baseline gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                        {street.name}
                      </span>
                      <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Present Day (Official)
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed font-sans">
                      Current official municipal designation recognized by Kolkata Municipal Corporation.
                    </p>
                    <p className="text-[10px] font-mono text-zinc-400 mt-2">
                      CITATION: KMC Official Gazettes
                    </p>
                  </div>

                  {/* Historical Names Descending */}
                  {[...street.historicalNames]
                    .sort((a, b) => parseInt(b.validFrom || '0', 10) - parseInt(a.validFrom || '0', 10))
                    .map((hn, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800"
                      >
                        <div className="flex justify-between items-baseline gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                            {hn.name}
                          </span>
                          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-zinc-200/60 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                            {hn.validFrom} — {hn.validUntil || 'Later'}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed font-sans">
                          {hn.explanation}
                        </p>
                        {hn.source && (
                          <p className="text-[10px] font-mono text-zinc-400 mt-2">
                            CITATION: {hn.source}
                          </p>
                        )}
                      </div>
                    ))}
                </div>
              </section>
            )}

            {/* Curated Tags */}
            {street.tags && street.tags.length > 0 && (
              <section className="pt-4 border-t border-zinc-200/80 dark:border-zinc-800">
                <h4 className="font-mono font-bold text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                  Spatial & Thematic Index Tags
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {street.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded text-[11px] font-mono border border-zinc-200/60 dark:border-zinc-700/60"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Articles & Blogs */}
            {street.blogLinks && street.blogLinks.length > 0 && (
              <section className="pt-4 border-t border-zinc-200/80 dark:border-zinc-800 space-y-2.5">
                <h4 className="font-mono font-bold text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Recommended Reading & Essays
                </h4>
                <div className="space-y-2">
                  {street.blogLinks.map((blog, i) => (
                    <a
                      key={i}
                      href={blog.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-800 text-xs transition-colors group"
                    >
                      <div>
                        <span className="font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 block">
                          {blog.title}
                        </span>
                        {blog.author && (
                          <span className="text-zinc-400 text-[10px] font-mono">by {blog.author}</span>
                        )}
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-zinc-400 group-hover:text-blue-600 shrink-0" />
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* Scholarly Gazette Sources */}
            {street.sources && street.sources.length > 0 && (
              <section className="pt-4 border-t border-zinc-200/80 dark:border-zinc-800 space-y-2.5">
                <h4 className="font-mono font-bold text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Primary Gazette References
                </h4>
                <div className="space-y-2 text-xs">
                  {street.sources.map((s, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100 block">
                        {s.title}
                      </span>
                      <div className="text-zinc-500 text-[11px] mt-0.5">
                        {s.author && <span>Author: {s.author} </span>}
                        {s.publisher && <span>• Publisher: {s.publisher}</span>}
                      </div>
                      {s.url && (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-blue-600 dark:text-blue-400 hover:underline mt-1 font-mono text-[11px]"
                        >
                          {s.url}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Footer with Contributor Attribution */}
          <div className="p-4 sm:p-5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/70 flex items-center justify-between gap-4 text-xs">
            {street.contributorName ? (
              <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-xs">
                  Researched by <strong>{street.contributorName}</strong> (Verified Contributor)
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-zinc-500 text-[11px] font-mono">
                <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>TILOTTOMA ARCHIVAL REGISTRY</span>
              </div>
            )}

            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-semibold text-xs transition-colors shrink-0 cursor-pointer shadow-2xs"
            >
              Close Dossier
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
