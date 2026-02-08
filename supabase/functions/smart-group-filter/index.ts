import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all user properties
    const { data: properties, error: propError } = await supabase
      .from("properties")
      .select("id, name, city, state, kasa_url, kasa_aggregated_score");
    if (propError) throw propError;

    // Fetch latest snapshots for scoring context
    const propertyIds = (properties || []).map((p: any) => p.id);
    const { data: snapshots } = await supabase
      .from("source_snapshots")
      .select("property_id, source, normalized_score_0_10, review_count, status")
      .in("property_id", propertyIds)
      .order("collected_at", { ascending: false });

    // Build latest scores per property
    const latestScores: Record<string, Record<string, { score: number; count: number }>> = {};
    const seen = new Set<string>();
    for (const snap of (snapshots || [])) {
      const key = `${snap.property_id}_${snap.source}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!latestScores[snap.property_id]) latestScores[snap.property_id] = {};
      if (snap.normalized_score_0_10 && snap.status !== "not_listed") {
        latestScores[snap.property_id][snap.source] = {
          score: snap.normalized_score_0_10,
          count: snap.review_count,
        };
      }
    }

    // Build property summaries for AI
    const propertySummaries = (properties || []).map((p: any) => {
      const scores = latestScores[p.id] || {};
      const platforms = Object.entries(scores)
        .map(([src, d]: [string, any]) => `${src}: ${d.score.toFixed(1)} (${d.count} reviews)`)
        .join(", ");
      
      // Calculate weighted avg
      let totalPts = 0, totalRevs = 0;
      for (const [_, d] of Object.entries(scores) as [string, any][]) {
        if (d.score > 0 && d.count > 0) {
          totalPts += d.score * d.count;
          totalRevs += d.count;
        }
      }
      const avg = totalRevs > 0 ? (totalPts / totalRevs).toFixed(2) : "N/A";
      const isKasa = !!(p.kasa_url || p.kasa_aggregated_score !== null);

      return {
        id: p.id,
        summary: `${p.name} | ${p.city}, ${p.state} | type: ${isKasa ? "Kasa" : "Competitor"} | avg: ${avg} | ${platforms || "no scores"}`,
      };
    });

    // Call AI to filter
    const aiPrompt = `You are a property filter assistant. Given a user's description of what properties they want in a group, return ONLY a JSON array of property IDs that match.

User prompt: "${prompt}"

Available properties:
${propertySummaries.map((p: any) => `- ID: ${p.id} | ${p.summary}`).join("\n")}

Rules:
- Return ONLY a valid JSON array of ID strings, nothing else
- If the prompt mentions score thresholds, use the weighted average
- "Kasa" means type=Kasa, "competitors" or "comp" means type=Competitor
- Match by state, city, score range, property type, or any combination
- If unclear, include all properties that could reasonably match
- Return [] if nothing matches`;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: aiPrompt }],
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "[]";

    // Extract JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*?\]/);
    const matchedIds: string[] = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    // Validate IDs exist
    const validIds = new Set(propertyIds);
    const filteredIds = matchedIds.filter((id: string) => validIds.has(id));

    return new Response(JSON.stringify({ propertyIds: filteredIds, count: filteredIds.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
