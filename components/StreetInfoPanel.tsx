"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, BookOpen, Clock, Star, MapIcon, Share2, Bookmark, Navigation, Plus, MapPin, MessageSquare } from "lucide-react";
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
  isIndexed?: boolean;
}

interface PlaceData {
  name: string;
  rating: number;
  userRatingsTotal: number;
  url: string;
  photos: { url: string; attribution: string }[];
  reviews: {
    authorName: string;
    profilePhotoUrl: string;
    rating: number;
    text: string;
    relativeTime: string;
  }[];
}

type Tab = "overview" | "history" | "reviews" | "sources";

export default function StreetInfoPanel({ street }: { street: StreetHistoryData }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [placeData, setPlaceData] = useState<PlaceData | null>(null);
  const [loadingPlace, setLoadingPlace] = useState(true);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push("/");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  // Fetch place data from our secure server-side API route
  useEffect(() => {
    if (!street.name) return;
    setLoadingPlace(true);
    setPlaceData(null);

    fetch(`/api/place-details?query=${encodeURIComponent(street.name + ", Kolkata")}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && !data.error) setPlaceData(data);
      })
      .catch(console.error)
      .finally(() => setLoadingPlace(false));
  }, [street.name]);

  const photoUrl = placeData?.photos?.[0]?.url;

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: street.name, url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: "100%", opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="absolute top-0 right-0 bottom-0 w-full sm:w-100 md:w-112.5 bg-white dark:bg-zinc-950 shadow-2xl z-20 pointer-events-auto border-l border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden"
      >
        {/* Floating Close Button */}
        <button
          onClick={() => router.push("/")}
          className="absolute top-4 right-4 p-2 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md transition-colors text-white z-30"
          aria-label="Close panel"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex-1 overflow-y-auto">
          {/* Hero Cover Image */}
          <div className="w-full h-56 md:h-64 bg-zinc-200 dark:bg-zinc-800 relative">
            {loadingPlace ? (
              <div className="w-full h-full animate-pulse bg-zinc-300 dark:bg-zinc-700" />
            ) : photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt={street.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-400">
                <MapIcon className="w-16 h-16 opacity-10" />
              </div>
            )}
            <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
            {/* Street name overlaid on image */}
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <h2 className="text-2xl sm:text-3xl font-semibold text-white drop-shadow-lg">
                {street.name}
              </h2>
            </div>
          </div>

          {/* Header Info */}
          <div className="px-5 pt-4 pb-2">
            <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
              Street • Kolkata • Historical
            </div>
            {/* Rating */}
            {placeData?.rating ? (
              <div className="flex items-center text-sm font-medium text-zinc-800 dark:text-zinc-200">
                <span className="mr-1.5 font-bold text-base">{placeData.rating}</span>
                <div className="flex text-amber-400 mr-1.5">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${i < Math.round(placeData.rating) ? "fill-current" : "text-zinc-300 dark:text-zinc-600"}`}
                    />
                  ))}
                </div>
                <span className="text-zinc-400 font-normal">
                  ({placeData.userRatingsTotal?.toLocaleString()})
                </span>
              </div>
            ) : loadingPlace ? (
              <div className="h-4 w-32 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
            ) : null}
          </div>

          {/* Action Buttons Row */}
          <div className="flex px-4 py-3 gap-2 overflow-x-auto">
            {placeData?.url && (
              <a
                href={placeData.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center px-4 py-2 min-w-18 rounded-2xl bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
              >
                <Navigation className="w-5 h-5 mb-1" />
                <span className="text-xs font-medium whitespace-nowrap">Directions</span>
              </a>
            )}
            <button
              onClick={handleShare}
              className="flex flex-col items-center justify-center px-4 py-2 min-w-18 rounded-2xl bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
            >
              <Share2 className="w-5 h-5 mb-1" />
              <span className="text-xs font-medium">Share</span>
            </button>
            <button className="flex flex-col items-center justify-center px-4 py-2 min-w-18 rounded-2xl bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors">
              <Bookmark className="w-5 h-5 mb-1" />
              <span className="text-xs font-medium">Save</span>
            </button>
            <a
              href="/admin"
              className="flex flex-col items-center justify-center px-4 py-2 min-w-18 rounded-2xl bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-400 transition-colors"
              title="Edit street geometry or history in Admin Console"
            >
              <span className="text-base mb-0.5">🛠️</span>
              <span className="text-xs font-medium whitespace-nowrap">Admin Edit</span>
            </a>
          </div>

          <div className="h-px w-full bg-zinc-100 dark:bg-zinc-900" />

          {/* Tabs Navigation */}
          <div className="flex border-b border-zinc-200 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-950 z-10">
            {(["overview", "history", "reviews", "sources"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                    : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Contents */}
          <div className="p-5 pb-10">
            {/* OVERVIEW */}
            {activeTab === "overview" && (
              <section className="space-y-5">
                <div className="flex items-start gap-4 text-zinc-800 dark:text-zinc-200">
                  <MapPin className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed text-sm">{street.description}</p>
                </div>
                {street.historicalNames.length > 0 && (
                  <div className="flex items-start gap-4 text-zinc-800 dark:text-zinc-200">
                    <Clock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-sm mb-2">Formerly known as</h4>
                      <div className="flex flex-wrap gap-2">
                        {street.historicalNames.map((hn, i) => (
                          <span
                            key={i}
                            className="inline-block px-3 py-1 bg-zinc-100 dark:bg-zinc-900 rounded-full text-xs border border-zinc-200 dark:border-zinc-800"
                          >
                            {hn.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {street.isIndexed === false && (
                  <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
                    <p className="font-medium mb-1">No history documented yet</p>
                    <p className="text-amber-600 dark:text-amber-400 text-xs">Be the first to contribute the history of this street using the button above.</p>
                  </div>
                )}
              </section>
            )}

            {/* HISTORY */}
            {activeTab === "history" && (
              <section className="space-y-6">
                {street.historicalNames.length > 0 ? (
                  street.historicalNames.map((hn, i) => (
                    <div
                      key={i}
                      className="relative pl-5 border-l-2 border-zinc-200 dark:border-zinc-800 last:border-0"
                    >
                      <div className="absolute w-3 h-3 bg-blue-600 rounded-full -left-1.75 top-1.5 ring-4 ring-white dark:ring-zinc-950" />
                      <div className="flex justify-between items-baseline mb-1 gap-2 flex-wrap">
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{hn.name}</h3>
                        <span className="text-xs font-mono text-zinc-500 bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 rounded whitespace-nowrap">
                          {hn.validFrom} – {hn.validUntil || "Present"}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        {hn.explanation}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-zinc-400 py-12">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No historical name changes recorded yet.</p>
                  </div>
                )}
              </section>
            )}

            {/* REVIEWS */}
            {activeTab === "reviews" && (
              <section className="space-y-5">
                {loadingPlace ? (
                  <div className="animate-pulse space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex gap-3">
                        <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3" />
                          <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-full" />
                          <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-5/6" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : placeData?.reviews && placeData.reviews.length > 0 ? (
                  placeData.reviews.map((review, i) => (
                    <div
                      key={i}
                      className="border-b border-zinc-100 dark:border-zinc-900 pb-5 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={review.profilePhotoUrl}
                          alt={review.authorName}
                          className="w-9 h-9 rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                            {review.authorName}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="flex text-amber-400">
                              {[...Array(5)].map((_, idx) => (
                                <Star
                                  key={idx}
                                  className={`w-3 h-3 ${idx < review.rating ? "fill-current" : "text-zinc-300 dark:text-zinc-700"}`}
                                />
                              ))}
                            </div>
                            <span className="text-xs text-zinc-400">{review.relativeTime}</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed line-clamp-5">
                        {review.text}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-zinc-400 flex flex-col items-center">
                    <MessageSquare className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-sm">No Google reviews available for this location.</p>
                  </div>
                )}
              </section>
            )}

            {/* SOURCES */}
            {activeTab === "sources" && (
              <section>
                {street.sources.length > 0 ? (
                  <ul className="space-y-4">
                    {street.sources.map((source, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <BookOpen className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <span className="font-medium text-zinc-900 dark:text-zinc-100 block">
                            {source.title}
                          </span>
                          {source.author && (
                            <span className="text-zinc-500 text-xs">by {source.author}</span>
                          )}
                          {source.url && (
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-xs text-blue-500 hover:underline mt-0.5 truncate"
                            >
                              {source.url}
                            </a>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-center text-zinc-400 py-12">
                    <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No scholarly sources documented yet.</p>
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
