import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  const apiKey = process.env.GEOCODING_API || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // 1. Text Search to find the Place ID
  const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
  const textSearchRes = await fetch(textSearchUrl);
  const textSearchData = await textSearchRes.json();

  if (textSearchData.status !== "OK" || !textSearchData.results?.length) {
    return NextResponse.json({ error: "No results found", status: textSearchData.status }, { status: 404 });
  }

  const placeId = textSearchData.results[0].place_id;

  // 2. Get Place Details — photos, rating, reviews, url
  const fields = "photos,rating,user_ratings_total,reviews,url,name";
  const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`;
  const detailsRes = await fetch(detailsUrl);
  const detailsData = await detailsRes.json();

  if (detailsData.status !== "OK") {
    return NextResponse.json({ error: "Details fetch failed", status: detailsData.status }, { status: 500 });
  }

  const result = detailsData.result;

  // Convert photo references to actual URLs
  const photos = (result.photos || []).slice(0, 3).map((p: any) => ({
    url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${p.photo_reference}&key=${apiKey}`,
    attribution: p.html_attributions?.[0] || "",
  }));

  return NextResponse.json({
    name: result.name,
    rating: result.rating,
    userRatingsTotal: result.user_ratings_total,
    url: result.url,
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
