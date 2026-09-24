"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, FileText, ChevronDown, ChevronUp } from 'lucide-react';

export interface HistoricalNameEntry {
  name: string;
  validFrom?: string | null;
  validUntil?: string | null;
  explanation?: string | null;
  source?: string | null;
}

interface VerticalNameTimelineProps {
  currentName: string;
  historicalNames: HistoricalNameEntry[];
  onOpenChronicleModal?: () => void;
}

export default function VerticalNameTimeline({
  currentName,
  historicalNames = [],
  onOpenChronicleModal,
}: VerticalNameTimelineProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  // Build chronological list in reverse order: Latest (Present Day) -> Oldest historical names
  const sortedHistoricalDesc = [...historicalNames].sort((a, b) => {
    const yearA = parseInt(a.validFrom || '0', 10);
    const yearB = parseInt(b.validFrom || '0', 10);
    return yearB - yearA; // descending (latest -> oldest)
  });

  const timelineItems = [
    {
      name: currentName,
      period: 'Present Day',
      explanation: 'Current official municipal name designated by Kolkata Municipal Corporation (KMC).',
      source: 'KMC Official Gazettes',
      isCurrent: true,
      pointIndex: 1,
    },
    ...sortedHistoricalDesc.map((hn, idx) => ({
      name: hn.name,
      period: hn.validFrom
        ? `${hn.validFrom} — ${hn.validUntil || 'Later'}`
        : 'Historical Era',
      explanation: hn.explanation || 'Historical municipal designation recorded in archival gazettes.',
      source: hn.source,
      isCurrent: false,
      pointIndex: idx + 2,
    })),
  ];

  return (
    <div className="space-y-3.5">
      {/* Timeline Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h4 className="font-sans font-semibold text-xs text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Nomenclature Timeline
          </h4>
          <p className="text-[10px] font-mono text-zinc-400">
            {timelineItems.length} documented eras across municipal registries
          </p>
        </div>

        {onOpenChronicleModal && (
          <button
            type="button"
            onClick={onOpenChronicleModal}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-lg text-[11px] font-medium transition-colors cursor-pointer shadow-2xs"
          >
            <FileText className="w-3 h-3 text-zinc-500" />
            <span>Monograph</span>
          </button>
        )}
      </div>

      {/* Stepper timeline with subtle hairline connector */}
      <div className="relative pl-6 pt-1 pb-1">
        {/* Continuous hairline connector line */}
        <div className="absolute left-2.5 top-3.5 bottom-3.5 w-px bg-zinc-200 dark:bg-zinc-800" />

        <div className="space-y-4">
          {timelineItems.map((item, index) => {
            const isExpanded = expandedIndex === index;

            return (
              <div key={index} className="relative group">
                {/* Node Stepper Badge */}
                <div
                  onClick={() => setExpandedIndex(isExpanded ? null : index)}
                  className={`absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 z-10 ${
                    item.isCurrent
                      ? 'bg-emerald-600 text-white ring-3 ring-emerald-50 dark:ring-emerald-950/60 shadow-2xs'
                      : 'bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 ring-3 ring-zinc-50 dark:ring-zinc-950 group-hover:border-blue-500'
                  }`}
                  title={item.name}
                >
                  {item.isCurrent ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  ) : (
                    <span className="text-[9px] font-mono font-bold leading-none">
                      {index + 1}
                    </span>
                  )}
                </div>

                {/* Node Content Card */}
                <div
                  onClick={() => setExpandedIndex(isExpanded ? null : index)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    item.isCurrent
                      ? 'bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/40 shadow-2xs'
                      : isExpanded
                      ? 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 shadow-2xs'
                      : 'bg-zinc-50/60 dark:bg-zinc-900/30 hover:bg-white dark:hover:bg-zinc-900/60 border-zinc-200/80 dark:border-zinc-800/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h5 className="font-sans font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                          {item.name}
                        </h5>
                        {item.isCurrent && (
                          <span className="text-[9px] font-mono font-medium uppercase px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/50">
                            Current Official
                          </span>
                        )}
                      </div>
                      <span className="inline-block text-[10px] font-mono text-zinc-400 mt-0.5">
                        {item.period}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Expandable Explanation */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed font-sans pt-2 border-t border-zinc-100 dark:border-zinc-800/80 mt-2">
                          {item.explanation}
                        </p>
                        {item.source && (
                          <div className="text-[10px] font-mono text-zinc-400 mt-2 pt-1 border-t border-dashed border-zinc-100 dark:border-zinc-800">
                            Citation: {item.source}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
