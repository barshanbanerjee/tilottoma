import MapProvider from "@/components/Map/MapProvider";
import MainMap from "@/components/Map/MainMap";
import { getIndexedStreets } from "@/db/queries";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const indexedStreets = await getIndexedStreets();

  return (
    <div className="w-full h-screen overflow-hidden relative">
      <MapProvider>
        <MainMap indexedStreets={indexedStreets}>
          {children}
        </MainMap>
      </MapProvider>
    </div>
  );
}
