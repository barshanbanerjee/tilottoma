"use client";

import { useState } from "react";
import { Search, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";

// Placeholder for now, later we'll fetch from API
const DEMO_STREETS = [
  { id: "1", name: "Park Street", slug: "park-street", history: "Formerly Burial Ground Road" },
  { id: "2", name: "Camac Street", slug: "camac-street", history: "Named after William Camac" },
  { id: "3", name: "College Street", slug: "college-street", history: "Famous for bookstores" }
];

export default function StreetSearch() {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const router = useRouter();

  const results = DEMO_STREETS.filter((s) => 
    s.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="relative w-full max-w-md mx-auto z-10 pointer-events-auto">
      <div 
        className={`flex items-center bg-white dark:bg-zinc-900 rounded-2xl px-4 py-3 shadow-lg transition-shadow duration-300 ${
          isFocused ? "shadow-xl ring-2 ring-blue-500/50" : "shadow-md"
        }`}
      >
        <Search className="w-5 h-5 text-zinc-400 mr-3" />
        <input
          type="text"
          className="flex-1 bg-transparent border-none outline-none text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 text-lg"
          placeholder="Search for a street..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
        />
      </div>

      {isFocused && query.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 rounded-xl shadow-xl overflow-hidden py-2 border border-zinc-100 dark:border-zinc-800">
          {results.length > 0 ? (
            results.map((street) => (
              <button
                key={street.id}
                onClick={() => router.push(`/street/${street.slug}`)}
                className="w-full text-left px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors flex items-center group"
              >
                <div className="bg-zinc-100 dark:bg-zinc-800 rounded-full p-2 mr-4 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                  <MapPin className="w-4 h-4 text-zinc-500 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                </div>
                <div>
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">{street.name}</div>
                  <div className="text-sm text-zinc-500 line-clamp-1">{street.history}</div>
                </div>
              </button>
            ))
          ) : (
            <div className="px-4 py-8 text-center text-zinc-500">
              No streets found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
