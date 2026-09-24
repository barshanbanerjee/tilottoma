"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  FileText,
  Clock,
  Star,
  MapIcon,
  Share2,
  Navigation,
  MapPin,
  MessageSquare,
  Sparkles,
  UserCheck,
  Tag,
  ExternalLink,
  ChevronRight,
  SlidersHorizontal,
  ArrowUpRight,
  Pencil,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import VerticalNameTimeline from "./Timeline/VerticalNameTimeline";
import HeritageChronicleModal from "./Modal/HeritageChronicleModal";
import ZoneRecommendations from "./Recommendations/ZoneRecommendations";
import EditStreetModal from "./Admin/EditStreetModal";
import { useAuth } from "@/context/AuthContext";

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
    source?: string;
  }[];
  sources: {
    title: string;
    author: string;
    url?: string;
  }[];
  tags?: string[] | null;
  images?: { url: string; caption?: string; credit?: string }[] | null;
  blogLinks?: { title: string; url: string; author?: string }[] | null;
  contributorName?: string | null;
  contributedById?: string | null;
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

type Tab = "overview" | "timeline" | "recommendations" | "reviews" | "sources";

export default function StreetInfoPanel({
  street: initialStreet,
  onEditStreet,
}: {
  street: StreetHistoryData;
  onEditStreet?: (street: StreetHistoryData) => void;
}) {
  const router = useRouter();
  const { canModerate, canContribute, openAuthModal, user } = useAuth();

  const [street, setStreet] = useState<StreetHistoryData>(initialStreet);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    setStreet(initialStreet);
  }, [initialStreet]);

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [placeData, setPlaceData] = useState<PlaceData | null>(null);
  const [loadingPlace, setLoadingPlace] = useState(true);
  const [isChronicleModalOpen, setIsChronicleModalOpen] = useState(false);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isChronicleModalOpen) {
          setIsChronicleModalOpen(false);
        } else {
          router.push("/");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, isChronicleModalOpen]);

  // Fetch place data from server-side API route
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

  // Primary cover image: custom street images take priority, otherwise Google Places photo
  const photoUrl = street.images?.[0]?.url || placeData?.photos?.[0]?.url;

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: street.name, url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 260 }}
          className="fixed md:absolute top-auto md:top-0 right-0 bottom-0 left-0 md:left-auto w-full md:w-115 lg:w-lg max-h-[88vh] md:max-h-full bg-white dark:bg-zinc-950 shadow-2xl z-30 pointer-events-auto border-t md:border-t-0 md:border-l border-zinc-200/80 dark:border-zinc-800/80 rounded-t-2xl md:rounded-none flex flex-col overflow-hidden"
        >
          {/* Mobile Sheet Drag Indicator */}
          <div className="pt-2 pb-1.5 flex justify-center md:hidden bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
            <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
          </div>

          {/* Floating Close Button */}
          <button
            onClick={() => router.push("/")}
            className="absolute top-3.5 right-3.5 p-2 rounded-xl bg-black/50 hover:bg-black/70 backdrop-blur-md transition-colors text-white z-40 cursor-pointer shadow-md border border-white/10"
            aria-label="Close panel"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex-1 overflow-y-auto">
            {/* Hero Cover Image */}
            <div className="w-full h-48 sm:h-52 md:h-56 bg-zinc-900 relative">
              {loadingPlace && !street.images?.length ? (
                <div className="w-full h-full animate-pulse bg-zinc-800" />
              ) : photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrl}
                  alt={street.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600 bg-zinc-900">
                  <MapIcon className="w-12 h-12 opacity-20" />
                </div>
              )}
              {/* Refined gradient scrim */}
              <div className="absolute inset-0 bg-linear-to-t from-zinc-950 via-zinc-950/40 to-transparent pointer-events-none" />

              {/* Street name overlaid on image */}
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[9px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-zinc-200 border border-white/15">
                    SPATIAL CORRIDOR • KOLKATA
                  </span>
                  {street.historicalNames && street.historicalNames.length > 0 && (
                    <span className="text-[9px] font-mono font-medium uppercase px-2 py-0.5 rounded bg-blue-600/90 text-white backdrop-blur-md">
                      {street.historicalNames.length + 1} ERAS
                    </span>
                  )}
                </div>
                <h2 className="text-2xl sm:text-3xl font-sans font-bold text-white tracking-tight drop-shadow-sm">
                  {street.name}
                </h2>
              </div>
            </div>

            {/* Ratings & Telemetry Row */}
            <div className="px-5 pt-3 pb-1 flex items-center justify-between">
              {placeData?.rating ? (
                <div className="flex items-center text-xs text-zinc-700 dark:text-zinc-300 font-sans">
                  <div className="flex items-center gap-1 font-semibold mr-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span>{placeData.rating}</span>
                  </div>
                  <span className="text-zinc-400 text-[11px]">
                    ({placeData.userRatingsTotal?.toLocaleString()} Google reviews)
                  </span>
                </div>
              ) : loadingPlace ? (
                <div className="h-4 w-32 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
              ) : (
                <div className="text-[11px] font-mono text-zinc-400">
                  DOCUMENTED ARCHIVAL CORRIDOR
                </div>
              )}
            </div>

            {/* Action Buttons Toolbar */}
            <div className="flex px-5 py-2.5 gap-2 overflow-x-auto scrollbar-none">
              {placeData?.url && (
                <a
                  href={placeData.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-24 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 text-zinc-800 dark:text-zinc-200 text-xs font-medium transition-all shadow-2xs"
                >
                  <Navigation className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Directions</span>
                </a>
              )}

              <button
                onClick={() => setIsChronicleModalOpen(true)}
                className="flex-1 min-w-24 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 text-zinc-800 dark:text-zinc-200 text-xs font-medium transition-all shadow-2xs cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                <span>Monograph</span>
              </button>

              <button
                onClick={handleShare}
                className="flex-1 min-w-20 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 text-zinc-800 dark:text-zinc-200 text-xs font-medium transition-all shadow-2xs cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                <span>Share</span>
              </button>

              {/* Contributor / Moderator / Admin Edit Button */}
              {(canModerate || canContribute) && (
                <button
                  type="button"
                  onClick={() => {
                    if (onEditStreet) {
                      onEditStreet(street);
                    } else {
                      setIsEditModalOpen(true);
                    }
                  }}
                  className="flex-1 min-w-20 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-xs font-medium transition-all shadow-2xs cursor-pointer"
                  title="Edit street details, historical former names, tags or citations"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              )}

              {/* Admin/Moderator Edit Shortcut */}
              {canModerate && (
                <a
                  href="/admin"
                  className="flex-1 min-w-20 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-medium transition-all shadow-2xs"
                  title="Edit street geometry or history in Admin Console"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Admin</span>
                </a>
              )}
            </div>

            <div className="h-px w-full bg-zinc-200/80 dark:border-zinc-800/80" />

            {/* Tabs Navigation */}
            <div className="flex border-b border-zinc-200/80 dark:border-zinc-800/80 sticky top-0 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md z-10 overflow-x-auto scrollbar-none px-5">
              {(
                [
                  { id: "overview", label: "Overview" },
                  { id: "timeline", label: "Timeline" },
                  { id: "recommendations", label: "Spatial Points" },
                  { id: "reviews", label: "Reviews" },
                  { id: "sources", label: "Citations" },
                ] as { id: Tab; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2.5 px-3 text-xs font-medium whitespace-nowrap border-b-2 transition-all cursor-pointer ${
                    activeTab === tab.id
                      ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-semibold"
                      : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            <div className="p-5 pb-8 space-y-5">
              {/* TAB 1: OVERVIEW */}
              {activeTab === "overview" && (
                <section className="space-y-5">
                  {/* Executive Historical Brief */}
                  <div className="p-4 rounded-xl bg-zinc-50/80 dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-zinc-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        Executive Archival Brief
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsChronicleModalOpen(true)}
                        className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-0.5"
                      >
                        Read Monograph <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>

                    <p className="line-clamp-3 leading-relaxed text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-sans">
                      {street.description || 'No detailed historical overview recorded yet.'}
                    </p>

                    <button
                      type="button"
                      onClick={() => setIsChronicleModalOpen(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors cursor-pointer pt-0.5"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Read Full Historical Monograph</span>
                    </button>
                  </div>

                  {/* Curated Tags */}
                  {street.tags && street.tags.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Tag className="w-3 h-3 text-zinc-400 shrink-0" />
                      {street.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 rounded text-[10px] font-mono border border-zinc-200/60 dark:border-zinc-700/60"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Famous Places & Zone Recommendations directly below History */}
                  <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60">
                    <ZoneRecommendations
                      streetId={street.id}
                      streetName={street.name}
                      zone="Central Kolkata"
                    />
                  </div>

                  {/* Vertical Timeline Card Preview */}
                  <div className="p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800">
                    <VerticalNameTimeline
                      currentName={street.name}
                      historicalNames={street.historicalNames}
                      onOpenChronicleModal={() => setIsChronicleModalOpen(true)}
                    />
                  </div>

                  {/* Curated Images Gallery */}
                  {street.images && street.images.length > 0 && (
                    <div className="space-y-2.5">
                      <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Historical Imagery & Cartography
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {street.images.map((img, i) => (
                          <div
                            key={i}
                            className="group relative rounded-xl overflow-hidden aspect-4/3 bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={img.url}
                              alt={img.caption || street.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            {img.caption && (
                              <div className="absolute inset-x-0 bottom-0 p-2 bg-linear-to-t from-black/80 to-transparent text-white text-[10px] truncate font-sans">
                                {img.caption}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* TAB 2: TIMELINE */}
              {activeTab === "timeline" && (
                <section>
                  <VerticalNameTimeline
                    currentName={street.name}
                    historicalNames={street.historicalNames}
                    onOpenChronicleModal={() => setIsChronicleModalOpen(true)}
                  />
                </section>
              )}

              {/* TAB 3: ZONE RECOMMENDATIONS */}
              {activeTab === "recommendations" && (
                <section>
                  <ZoneRecommendations
                    streetId={street.id}
                    streetName={street.name}
                    zone="Central Kolkata"
                  />
                </section>
              )}

              {/* TAB 4: REVIEWS */}
              {activeTab === "reviews" && (
                <section className="space-y-3.5">
                  {loadingPlace ? (
                    <div className="animate-pulse space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 shrink-0" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-1/4" />
                            <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-full" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : placeData?.reviews && placeData.reviews.length > 0 ? (
                    placeData.reviews.map((review, i) => (
                      <div
                        key={i}
                        className="p-3.5 rounded-xl border border-zinc-200/70 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={review.profilePhotoUrl}
                              alt={review.authorName}
                              className="w-6 h-6 rounded-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                              {review.authorName}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-amber-500">
                            <Star className="w-3 h-3 fill-current" />
                            <span className="text-xs font-mono font-semibold">{review.rating}</span>
                          </div>
                        </div>
                        <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed font-sans">
                          {review.text}
                        </p>
                        <div className="text-[10px] font-mono text-zinc-400 pt-1">
                          {review.relativeTime}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10 text-zinc-400 flex flex-col items-center">
                      <MessageSquare className="w-8 h-8 mb-2 opacity-20" />
                      <p className="text-xs font-mono">NO GOOGLE REVIEWS CATALOGUED</p>
                    </div>
                  )}
                </section>
              )}

              {/* TAB 5: CITATIONS & SOURCES */}
              {activeTab === "sources" && (
                <section className="space-y-4">
                  {/* Blog Links */}
                  {street.blogLinks && street.blogLinks.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Monographs & Reading
                      </h4>
                      <div className="space-y-1.5">
                        {street.blogLinks.map((blog, i) => (
                          <a
                            key={i}
                            href={blog.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-800 text-xs transition-colors"
                          >
                            <div>
                              <span className="font-semibold text-zinc-900 dark:text-zinc-100 block">
                                {blog.title}
                              </span>
                              {blog.author && (
                                <span className="text-zinc-400 text-[10px] font-mono">by {blog.author}</span>
                              )}
                            </div>
                            <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Gazette Citations */}
                  <div>
                    <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                      Gazette References
                    </h4>
                    {street.sources.length > 0 ? (
                      <div className="space-y-2">
                        {street.sources.map((source, i) => (
                          <div
                            key={i}
                            className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 text-xs"
                          >
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100 block">
                              {source.title}
                            </span>
                            {source.author && (
                              <span className="text-zinc-500 text-[11px]">
                                Author: {source.author}
                              </span>
                            )}
                            {source.url && (
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-blue-600 dark:text-blue-400 hover:underline mt-1 truncate font-mono text-[11px]"
                              >
                                {source.url}
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-zinc-400 py-8 text-xs font-mono">
                        NO FORMAL CITATIONS CATALOGUED
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
          </div>

          {/* Footer: Provenance Banner */}
          <div className="p-3.5 px-5 border-t border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/90 dark:bg-zinc-900/90 flex items-center justify-between gap-3 text-xs">
            {street.contributorName ? (
              <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 font-medium">
                <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="truncate text-xs">
                  Provenance: <strong>{street.contributorName}</strong>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-zinc-500 text-[11px] font-mono">
                <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>ARCHIVAL REGISTRY</span>
              </div>
            )}

            <button
              onClick={() => setIsChronicleModalOpen(true)}
              className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline shrink-0 cursor-pointer flex items-center gap-1"
            >
              <span>Full Monograph</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Heritage Chronicle Deep-Reading Modal */}
      <HeritageChronicleModal
        isOpen={isChronicleModalOpen}
        onClose={() => setIsChronicleModalOpen(false)}
        street={street}
      />

      {/* Edit Street Details Modal */}
      <EditStreetModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        street={street}
        onSuccess={(updated) => {
          setStreet(updated);
          router.refresh();
        }}
      />
    </>
  );
}
