"use client";

import { Route, MapPin, X, ChevronRight, Landmark, Compass, History } from "lucide-react";

interface ContributeSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStreet: () => void;
  onSelectPlace: () => void;
}

export default function ContributeSelectModal({
  isOpen,
  onClose,
  onSelectStreet,
  onSelectPlace,
}: ContributeSelectModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-zinc-200/90 dark:border-zinc-800/90 overflow-hidden text-xs font-sans animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800/80 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-900/40">
                ARCHIVAL CONTRIBUTION
              </span>
            </div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Contribute to Tilottoma
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Select the type of heritage element you wish to preserve in Kolkata&apos;s living archive.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options */}
        <div className="p-5 space-y-3">
          {/* Option 1: Historical Street / Corridor */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectStreet();
            }}
            className="w-full text-left p-4 rounded-xl border border-zinc-200/90 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 bg-zinc-50/50 hover:bg-blue-50/40 dark:bg-zinc-900/40 dark:hover:bg-blue-950/20 transition-all group cursor-pointer flex items-center gap-4 shadow-2xs"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20 group-hover:scale-105 transition-transform">
              <Route className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  Historical Street / Corridor
                </h3>
                <span className="text-[9px] font-mono font-medium px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                  CORRIDOR
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed line-clamp-2">
                Trace street geometry with snapping, document colonial/indigenous name evolutions, and link archival monograph citations.
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all shrink-0" />
          </button>

          {/* Option 2: Place / Landmark / Heritage Spot */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectPlace();
            }}
            className="w-full text-left p-4 rounded-xl border border-zinc-200/90 dark:border-zinc-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-zinc-50/50 hover:bg-emerald-50/40 dark:bg-zinc-900/40 dark:hover:bg-emerald-950/20 transition-all group cursor-pointer flex items-center gap-4 shadow-2xs"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-600/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20 group-hover:scale-105 transition-transform">
              <Landmark className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  Place / Landmark / Heritage Spot
                </h3>
                <span className="text-[9px] font-mono font-medium px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                  LANDMARK
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed line-clamp-2">
                Add an iconic adda cafe, historic bookstore, ghat, heritage mansion, cabin, or sweet shop with interactive draggable pin placement.
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-zinc-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all shrink-0" />
          </button>
        </div>

        {/* Footer note */}
        <div className="px-5 py-3.5 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-zinc-400" />
            <span>Contributions undergo review before public indexing</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-600 dark:text-zinc-300 hover:underline font-medium cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
