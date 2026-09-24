import { db } from "./index";
import { streets } from "./schema";
import { eq, sql } from "drizzle-orm";

export async function getIndexedStreets() {
  try {
    const indexedStreets = await db.select({
      id: streets.id,
      name: streets.name,
      slug: streets.slug,
      status: streets.status,
      // ST_LineMerge stitches touching OSM segments into a continuous line
      geom: sql<string>`ST_AsGeoJSON(ST_LineMerge(${streets.geom}))`,
      // ST_PointOnSurface is more reliable than ST_Centroid for non-convex lines
      centroid: sql<string>`ST_AsGeoJSON(ST_PointOnSurface(ST_LineMerge(${streets.geom})))`
    }).from(streets).where(sql`${streets.status} IN ('APPROVED', 'PENDING')`);

    // Parse the JSON strings back to objects
    return indexedStreets.map(street => ({
      ...street,
      geom: street.geom ? JSON.parse(street.geom) : null,
      centroid: street.centroid ? JSON.parse(street.centroid) : null
    }));
  } catch (error) {
    console.error("Failed to fetch indexed streets", error);
    return [];
  }
}

export async function getPendingStreets() {
  try {
    const pending = await db.select({
      id: streets.id,
      name: streets.name,
      slug: streets.slug,
      description: streets.description,
      geom: sql<string>`ST_AsGeoJSON(ST_LineMerge(${streets.geom}))`,
      createdAt: streets.createdAt,
    }).from(streets).where(eq(streets.status, 'PENDING')).orderBy(streets.createdAt);

    return pending.map(street => ({
      ...street,
      geom: street.geom ? JSON.parse(street.geom) : null,
    }));
  } catch (error) {
    console.error("Failed to fetch pending streets", error);
    return [];
  }
}

export async function getAllStreetsForAdmin() {
  try {
    const all = await db.select({
      id: streets.id,
      name: streets.name,
      slug: streets.slug,
      status: streets.status,
      description: streets.description,
      tags: streets.tags,
      geom: sql<string>`ST_AsGeoJSON(ST_LineMerge(${streets.geom}))`,
      createdAt: streets.createdAt,
      updatedAt: streets.updatedAt,
    }).from(streets).orderBy(streets.name);

    return all.map(street => ({
      ...street,
      geom: street.geom ? JSON.parse(street.geom) : null,
    }));
  } catch (error) {
    console.error("Failed to fetch all streets for admin", error);
    return [];
  }
}

