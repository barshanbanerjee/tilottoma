import StreetInfoPanel from "@/components/StreetInfoPanel";
import StreetSearch from "@/components/Search/StreetSearch";
import { db } from "@/db";
import { streets, historicalNames, sources } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function StreetPage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params;
  
  let streetData: any = null;

  try {
    // Query Drizzle for the specific street, excluding geom to avoid parsing bugs
    const dbStreets = await db.select({
      id: streets.id,
      name: streets.name,
      slug: streets.slug,
      description: streets.description,
      status: streets.status,
      createdAt: streets.createdAt,
      updatedAt: streets.updatedAt,
    }).from(streets).where(eq(streets.slug, slug));
    const street = dbStreets[0];

    if (street) {
      const names = await db.select().from(historicalNames).where(eq(historicalNames.streetId, street.id));
      const streetSources = await db.select().from(sources).where(eq(sources.streetId, street.id));
      
      streetData = {
        ...street,
        historicalNames: names,
        sources: streetSources
      };
    }
  } catch (error) {
    console.error("Database connection failed or table does not exist yet.", error);
    // Silent fail so we can still render the fallback UI during setup
  }

  if (!streetData) {
    // Generate a fallback so any street clicked on the map displays a panel
    const titleCaseName = slug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
      
    streetData = {
      id: slug,
      name: titleCaseName,
      slug: slug,
      description: "No historical data has been added for this street yet. Be the first to uncover its past!",
      historicalNames: [],
      sources: [],
      isIndexed: false
    };
  } else {
    streetData.isIndexed = true;
  }

  return (
    <>
      <div className="absolute inset-0 z-10 pointer-events-none flex-col justify-start items-center pt-16 px-4 sm:pt-24 hidden md:flex">
        {/* We keep the search bar visible on desktop for easy navigation */}
        <div className="w-full max-w-md pointer-events-auto">
          <StreetSearch />
        </div>
      </div>
      
      {/* The side panel */}
      <StreetInfoPanel street={streetData as any} />
    </>
  );
}
