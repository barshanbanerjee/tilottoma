import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");
  const placeIdParam = searchParams.get("placeId");

  if (!query && !placeIdParam) {
    return NextResponse.json({ error: "Missing query or placeId parameter" }, { status: 400 });
  }

  const apiKey = process.env.GEOCODING_API || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  let targetPlaceId = placeIdParam;

  if (!targetPlaceId && query) {
    // Text Search to find the Place ID
    const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
    const textSearchRes = await fetch(textSearchUrl);
    const textSearchData = await textSearchRes.json();

    if (textSearchData.status !== "OK" || !textSearchData.results?.length) {
      return NextResponse.json({ error: "No results found", status: textSearchData.status }, { status: 404 });
    }

    targetPlaceId = textSearchData.results[0].place_id;
  }

  // Get Place Details — photos, rating, reviews, url, formatted_address, geometry, types
  const fields = "photos,rating,user_ratings_total,reviews,url,name,formatted_address,geometry,types,website";
  const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${targetPlaceId}&fields=${fields}&key=${apiKey}`;
  const detailsRes = await fetch(detailsUrl);
  const detailsData = await detailsRes.json();

  if (detailsData.status !== "OK" || !detailsData.result) {
    return NextResponse.json({ error: "Details fetch failed", status: detailsData.status }, { status: 500 });
  }

  const result = detailsData.result;

  // Convert photo references to actual URLs
  const photos = (result.photos || []).slice(0, 3).map((p: any) => ({
    url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${p.photo_reference}&key=${apiKey}`,
    attribution: p.html_attributions?.[0] || "",
  }));

  const lat = result.geometry?.location?.lat ?? null;
  const lng = result.geometry?.location?.lng ?? null;

  return NextResponse.json({
    placeId: targetPlaceId,
    name: result.name,
    formattedAddress: result.formatted_address || null,
    rating: result.rating || null,
    userRatingsTotal: result.user_ratings_total || null,
    url: result.url || null,
    website: result.website || null,
    types: result.types || [],
    lat,
    lng,
    photos,
    reviews: (result.reviews || []).map((r: any) => ({
      authorName: r.author_name,
      profilePhotoUrl: r.profile_photo_url,
      rating: r.rating,
      text: r.text,
      relativeTime: r.relative_time_description,
    })),
  });
}

