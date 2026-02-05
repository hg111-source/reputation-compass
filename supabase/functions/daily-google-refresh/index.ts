import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DELAY_BETWEEN_CALLS_MS = 2000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const googleApiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");

  if (!googleApiKey) {
    console.error("GOOGLE_PLACES_API_KEY not configured");
    return new Response(
      JSON.stringify({ error: "GOOGLE_PLACES_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Use service role to access all properties across all users
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Fetch all properties
    const { data: properties, error: propertiesError } = await supabase
      .from("properties")
      .select("id, name, city, state");

    if (propertiesError) {
      throw new Error(`Failed to fetch properties: ${propertiesError.message}`);
    }

    if (!properties || properties.length === 0) {
      // Log empty run
      await supabase.from("refresh_logs").insert({
        total_properties: 0,
        successes: 0,
        failures: 0,
      });

      return new Response(
        JSON.stringify({ message: "No properties to refresh", total: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let successes = 0;
    let failures = 0;
    const totalProperties = properties.length;

    for (let i = 0; i < properties.length; i++) {
      const property = properties[i];

      try {
        // Get the latest Google snapshot for this property
        const { data: latestSnapshot } = await supabase
          .from("source_snapshots")
          .select("normalized_score_0_10, review_count, collected_at")
          .eq("property_id", property.id)
          .eq("source", "google")
          .order("collected_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Fetch current Google rating
        const searchQuery = `${property.name} ${property.city} ${property.state} hotel`;
        const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(searchQuery)}&inputtype=textquery&fields=place_id&key=${googleApiKey}`;

        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();

        if (searchData.status !== "OK" || !searchData.candidates?.length) {
          console.log(`Property "${property.name}" not found on Google`);
          failures++;
          if (i < properties.length - 1) await delay(DELAY_BETWEEN_CALLS_MS);
          continue;
        }

        const placeId = searchData.candidates[0].place_id;
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=rating,user_ratings_total&key=${googleApiKey}`;

        const detailsResponse = await fetch(detailsUrl);
        const detailsData = await detailsResponse.json();

        if (detailsData.status !== "OK" || !detailsData.result) {
          console.log(`Failed to get details for "${property.name}"`);
          failures++;
          if (i < properties.length - 1) await delay(DELAY_BETWEEN_CALLS_MS);
          continue;
        }

        const rating = detailsData.result.rating;
        const reviewCount = detailsData.result.user_ratings_total || 0;

        if (rating === undefined || rating === null) {
          console.log(`No rating available for "${property.name}"`);
          failures++;
          if (i < properties.length - 1) await delay(DELAY_BETWEEN_CALLS_MS);
          continue;
        }

        const normalizedScore = parseFloat(((rating / 5) * 10).toFixed(2));

        // Determine if we should insert a new snapshot
        let shouldInsert = false;

        if (!latestSnapshot) {
          // No previous snapshot - always insert
          shouldInsert = true;
        } else {
          const scoreChanged = Math.abs(latestSnapshot.normalized_score_0_10 - normalizedScore) >= 0.01;
          const countChanged = latestSnapshot.review_count !== reviewCount;
          const lastSnapshotAge = Date.now() - new Date(latestSnapshot.collected_at).getTime();
          const isOlderThan7Days = lastSnapshotAge > SEVEN_DAYS_MS;

          shouldInsert = scoreChanged || countChanged || isOlderThan7Days;
        }

        if (shouldInsert) {
          const { error: insertError } = await supabase.from("source_snapshots").insert({
            property_id: property.id,
            source: "google",
            score_raw: rating,
            score_scale: 5,
            review_count: reviewCount,
            normalized_score_0_10: normalizedScore,
          });

          if (insertError) {
            console.error(`Failed to insert snapshot for "${property.name}":`, insertError);
            failures++;
          } else {
            console.log(`Inserted snapshot for "${property.name}": ${normalizedScore} (${reviewCount} reviews)`);
            successes++;
          }
        } else {
          console.log(`Skipped "${property.name}" - no changes detected`);
          successes++; // Count as success since fetch worked, just no update needed
        }
      } catch (propertyError) {
        console.error(`Error processing "${property.name}":`, propertyError);
        failures++;
      }

      // Delay before next call (unless it's the last one)
      if (i < properties.length - 1) {
        await delay(DELAY_BETWEEN_CALLS_MS);
      }
    }

    // Log the run results
    const { error: logError } = await supabase.from("refresh_logs").insert({
      total_properties: totalProperties,
      successes,
      failures,
    });

    if (logError) {
      console.error("Failed to insert refresh log:", logError);
    }

    const result = {
      total_properties: totalProperties,
      successes,
      failures,
      message: "Daily refresh completed",
    };

    console.log("Daily refresh completed:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Daily refresh error:", error);

    // Try to log the failure
    try {
      await supabase.from("refresh_logs").insert({
        total_properties: 0,
        successes: 0,
        failures: 1,
      });
    } catch {}

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
