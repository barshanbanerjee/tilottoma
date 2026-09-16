import StreetSearch from "@/components/Search/StreetSearch";

export default function Home() {
  return (
    <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-start items-center pt-16 px-4 sm:pt-24">
      {/* Title / Intro */}
      {/* <div className="text-center mb-8 bg-white/80 dark:bg-black/80 backdrop-blur-md px-6 py-4 rounded-3xl shadow-sm border border-white/20">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-2 font-serif">
          Kolkata Street History
        </h1>
        <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
          Discover the origins, historical names, and forgotten stories of the City of Joy.
        </p>
      </div> */}

      {/* Search Bar */}
      <div className="w-full max-w-md pointer-events-auto">
        <StreetSearch />
      </div>
    </div>
  );
}
