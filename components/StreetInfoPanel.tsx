"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Calendar, BookOpen, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface StreetHistoryData {
  id: string;
  name: string;
  slug: string;
  description: string;
  historicalNames: {
    name: string;
    validFrom: string;
    validUntil: string;
    explanation: string;
  }[];
  sources: {
    title: string;
    author: string;
    url?: string;
  }[];
}

export default function StreetInfoPanel({ street }: { street: StreetHistoryData }) {
  const router = useRouter();

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        router.push("/");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: "100%", opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="absolute top-0 right-0 bottom-0 w-full sm:w-[400px] md:w-[450px] bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl shadow-2xl z-20 pointer-events-auto border-l border-white/20 dark:border-zinc-800/50 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-900 sticky top-0 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-md z-10">
          <h2 className="text-2xl font-serif font-bold text-zinc-900 dark:text-zinc-50">
            {street.name}
          </h2>
          <button
            onClick={() => router.push("/")}
            className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-500"
            aria-label="Close panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Description */}
          <section>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed text-lg font-serif">
              {street.description}
            </p>
          </section>

          {/* Historical Names */}
          {street.historicalNames.length > 0 && (
            <section className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center">
                <Clock className="w-3.5 h-3.5 mr-2" />
                Historical Names
              </h3>
              <div className="space-y-4">
                {street.historicalNames.map((hn, i) => (
                  <div key={i} className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800/50">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{hn.name}</span>
                      <div className="flex items-center text-xs text-zinc-500 bg-white dark:bg-zinc-950 px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-800">
                        <Calendar className="w-3 h-3 mr-1" />
                        {hn.validFrom} - {hn.validUntil}
                      </div>
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {hn.explanation}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Sources */}
          {street.sources.length > 0 && (
            <section className="space-y-4 pb-8">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center">
                <BookOpen className="w-3.5 h-3.5 mr-2" />
                Sources
              </h3>
              <ul className="space-y-3">
                {street.sources.map((source, i) => (
                  <li key={i} className="text-sm text-zinc-600 dark:text-zinc-400 flex flex-col">
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">{source.title}</span>
                    {source.author && <span>by {source.author}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
