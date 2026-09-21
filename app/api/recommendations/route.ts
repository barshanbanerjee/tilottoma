import { NextResponse } from 'next/server';
import { db } from '@/db';
import { recommendations, streets } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { getServerSession } from '@/lib/session';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const streetId = searchParams.get('streetId');
    const zone = searchParams.get('zone');
    const latStr = searchParams.get('lat');
    const lngStr = searchParams.get('lng');
    const radiusStr = searchParams.get('radius');

    // Default radius: 5000m (5km) if lat/lng or streetId provided without radius
    const defaultRadius = 5000;
    const radius = radiusStr ? Math.min(Math.max(parseFloat(radiusStr), 100), 25000) : defaultRadius;

    // 1. Spatial query bound to a specific street geometry
    if (streetId) {
      const items = await db.execute<{
        id: string;
        street_id: string | null;
        zone: string;
        title: string;
        category: string;
        description: string;
        address: string | null;
        lat: number | null;
        lng: number | null;
        status: string;
        contributor_name: string | null;
        created_at: string;
        distance_meters: number | null;
      }>(sql`
        WITH target_street AS (
          SELECT id, geom FROM streets WHERE id = ${streetId} LIMIT 1
        )
        SELECT 
          r.id,
          r.street_id,
          r.zone,
          r.title,
          r.category,
          r.description,
          r.address,
          r.lat,
          r.lng,
          r.status,
          r.contributor_name,
          r.created_at,
          CASE 
            WHEN r.lat IS NOT NULL AND r.lng IS NOT NULL THEN
              ROUND(ST_Distance(s.geom::geography, ST_SetSRID(ST_MakePoint(r.lng, r.lat), 4326)::geography))
            ELSE NULL
          END AS distance_meters
        FROM recommendations r
        CROSS JOIN target_street s
        WHERE r.status = 'APPROVED'
          AND (
            r.street_id = s.id
            OR (
              r.lat IS NOT NULL 
              AND r.lng IS NOT NULL 
              AND ST_DWithin(s.geom::geography, ST_SetSRID(ST_MakePoint(r.lng, r.lat), 4326)::geography, ${radius})
            )
          )
        ORDER BY 
          CASE WHEN r.street_id = s.id THEN 0 ELSE 1 END,
          distance_meters ASC NULLS LAST,
          r.created_at DESC;
      `);

      return NextResponse.json(
        items.map((row) => ({
          id: row.id,
          streetId: row.street_id,
          zone: row.zone,
          title: row.title,
          category: row.category,
          description: row.description,
          address: row.address,
          lat: row.lat,
          lng: row.lng,
          status: row.status,
          contributorName: row.contributor_name,
          createdAt: row.created_at,
          distanceMeters: row.distance_meters,
        }))
      );
    }

    // 2. Spatial query around a point (lat, lng)
    if (latStr && lngStr) {
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);

      const items = await db.execute<{
        id: string;
        street_id: string | null;
        zone: string;
        title: string;
        category: string;
        description: string;
        address: string | null;
        lat: number | null;
        lng: number | null;
        status: string;
        contributor_name: string | null;
        created_at: string;
        distance_meters: number;
      }>(sql`
        SELECT 
          r.id,
          r.street_id,
          r.zone,
          r.title,
          r.category,
          r.description,
          r.address,
          r.lat,
          r.lng,
          r.status,
          r.contributor_name,
          r.created_at,
          ROUND(ST_Distance(
            ST_SetSRID(ST_MakePoint(r.lng, r.lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
          )) AS distance_meters
        FROM recommendations r
        WHERE r.status = 'APPROVED'
          AND r.lat IS NOT NULL AND r.lng IS NOT NULL
          AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(r.lng, r.lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
            ${radius}
          )
        ORDER BY distance_meters ASC;
      `);

      return NextResponse.json(
        items.map((row) => ({
          id: row.id,
          streetId: row.street_id,
          zone: row.zone,
          title: row.title,
          category: row.category,
          description: row.description,
          address: row.address,
          lat: row.lat,
          lng: row.lng,
          status: row.status,
          contributorName: row.contributor_name,
          createdAt: row.created_at,
          distanceMeters: row.distance_meters,
        }))
      );
    }

    // 3. Fallback: Filter by zone name or return recent approved (or all if all=true)
    const allParam = searchParams.get('all');
    const items = await db.execute<{
      id: string;
      street_id: string | null;
      zone: string;
      title: string;
      category: string;
      description: string;
      address: string | null;
      lat: number | null;
      lng: number | null;
      status: string;
      contributor_name: string | null;
      created_at: string;
    }>(
      zone
        ? sql`SELECT * FROM recommendations WHERE status = 'APPROVED' AND zone ILIKE ${'%' + zone + '%'} ORDER BY created_at DESC`
        : allParam === 'true'
        ? sql`SELECT * FROM recommendations WHERE status = 'APPROVED' ORDER BY created_at DESC`
        : sql`SELECT * FROM recommendations WHERE status = 'APPROVED' ORDER BY created_at DESC LIMIT 50`
    );

    return NextResponse.json(
      items.map((row) => ({
        id: row.id,
        streetId: row.street_id,
        zone: row.zone,
        title: row.title,
        category: row.category,
        description: row.description,
        address: row.address,
        lat: row.lat,
        lng: row.lng,
        status: row.status,
        contributorName: row.contributor_name,
        createdAt: row.created_at,
      }))
    );
  } catch (error) {
    console.error('Error fetching recommendations with PostGIS:', error);
    return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Login is required to recommend spots.' }, { status: 401 });
    }

    const body = await req.json();
    let { streetId, zone, title, category, description, address, lat, lng } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Spot title is required' }, { status: 400 });
    }
    if (!category) {
      return NextResponse.json({ error: 'Category is required' }, { status: 400 });
    }
    if (!description || !description.trim()) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }

    const parsedLat = lat ? parseFloat(lat) : null;
    const parsedLng = lng ? parseFloat(lng) : null;

    // PostGIS Auto-Binding: If coordinates exist and no streetId given, find closest street within 450m
    if (!streetId && parsedLat && parsedLng) {
      const closest = await db.execute<{ id: string; name: string }>(sql`
        SELECT id, name
        FROM streets
        WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(${parsedLng}, ${parsedLat}), 4326)::geography, 450)
        ORDER BY ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint(${parsedLng}, ${parsedLat}), 4326)::geography) ASC
        LIMIT 1;
      `);
      if (closest.length > 0) {
        streetId = closest[0].id;
      }
    }

    const isDirectApproved = ['ADMIN', 'MODERATOR', 'CONTRIBUTOR'].includes(session.role);
    const validUserId = session.id && UUID_REGEX.test(session.id) ? session.id : null;

    const [newRec] = await db
      .insert(recommendations)
      .values({
        streetId: streetId || null,
        zone: zone || 'Central Kolkata',
        title: title.trim(),
        category,
        description: description.trim(),
        address: address?.trim() || null,
        lat: parsedLat,
        lng: parsedLng,
        status: isDirectApproved ? 'APPROVED' : 'PENDING',
        contributedById: validUserId,
        contributorName: session.name || 'Heritage Contributor',
      })
      .returning();

    revalidatePath('/', 'layout');
    revalidatePath('/admin');

    return NextResponse.json({
      success: true,
      recommendation: newRec,
      message: isDirectApproved
        ? 'Spot published to live heritage map!'
        : 'Thank you! Your spot recommendation has been submitted for moderation.',
    });
  } catch (error) {
    console.error('Error creating recommendation:', error);
    return NextResponse.json({ error: 'Failed to submit recommendation' }, { status: 500 });
  }
}

