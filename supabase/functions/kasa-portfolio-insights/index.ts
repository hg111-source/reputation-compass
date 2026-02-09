import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { properties } = await req.json();
    if (!properties || !Array.isArray(properties) || properties.length === 0) {
      return new Response(JSON.stringify({ error: 'properties array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Sort by total review count descending, take top 20 for context
    const sorted = [...properties]
      .sort((a, b) => (b.totalReviews || 0) - (a.totalReviews || 0))
      .slice(0, 20);

    // Build concise property summary for the AI
    const propertySummary = sorted.map((p, i) => {
      const parts = [
        `${i + 1}. ${p.name} (${p.city}, ${p.state})`,
        p.kasaScore != null ? `Kasa: ${p.kasaScore.toFixed(2)}/10` : null,
        p.avgScore != null ? `OTA Avg: ${p.avgScore.toFixed(2)}/10` : null,
        p.totalReviews != null ? `Reviews: ${p.totalReviews}` : null,
        p.google != null ? `Google: ${p.google.toFixed(1)}` : null,
        p.tripadvisor != null ? `TA: ${p.tripadvisor.toFixed(1)}` : null,
        p.booking != null ? `Booking: ${p.booking.toFixed(1)}` : null,
        p.expedia != null ? `Expedia: ${p.expedia.toFixed(1)}` : null,
      ].filter(Boolean);
      return parts.join(' | ');
    }).join('\n');

    const totalProps = properties.length;
    const avgKasa = properties.filter(p => p.kasaScore != null).reduce((s, p) => s + p.kasaScore, 0) / Math.max(properties.filter(p => p.kasaScore != null).length, 1);
    const totalReviews = properties.reduce((s, p) => s + (p.totalReviews || 0), 0);

    const prompt = `You are a hospitality portfolio analyst for Kasa, a tech-enabled hotel/apartment operator.

PORTFOLIO OVERVIEW:
- ${totalProps} properties
- Average Kasa score: ${avgKasa.toFixed(2)}/10
- Total OTA reviews: ${totalReviews.toLocaleString()}

TOP PROPERTIES BY REVIEW VOLUME:
${propertySummary}

TASK:
Produce exactly 2-4 concise executive insights. Each insight should be one sentence max. Focus on:
1. Performance signals (standout performers, score patterns)
2. Risks (underperformers, platform gaps, declining signals)
3. Portfolio implications (geographic concentration, brand consistency)

Rules:
- Be specific: reference property names and numbers
- Analytical and neutral tone — no cheerleading
- Operator-level: actionable for a VP of Operations
- If a property's OTA avg diverges significantly from its Kasa score, flag it

Respond ONLY with this JSON (no markdown):
{
  "insights": [
    { "type": "signal|risk|implication", "text": "One concise sentence." }
  ]
}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'You are a concise hospitality analytics engine. JSON only.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again shortly.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits depleted.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const t = await aiResponse.text();
      console.error('AI error:', aiResponse.status, t);
      throw new Error(`AI analysis failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) throw new Error('No AI response');

    const clean = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(clean);

    return new Response(JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    console.error('kasa-portfolio-insights error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
