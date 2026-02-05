import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReviewText {
  review_text: string;
  review_rating: number | null;
  platform: string;
}

interface ThemeResult {
  theme: string;
  count: number;
  quote: string;
}

interface AnalysisResult {
  positive: ThemeResult[];
  negative: ThemeResult[];
  summary: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { propertyId } = await req.json();
    
    if (!propertyId) {
      return new Response(
        JSON.stringify({ error: 'propertyId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Analyzing reviews for property: ${propertyId}`);

    // Fetch review texts for this property
    const { data: reviews, error: reviewsError } = await supabase
      .from('review_texts')
      .select('review_text, review_rating, platform')
      .eq('property_id', propertyId)
      .limit(100);

    if (reviewsError) {
      throw new Error(`Failed to fetch reviews: ${reviewsError.message}`);
    }

    if (!reviews || reviews.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No reviews found for this property. Fetch reviews first.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${reviews.length} reviews to analyze`);

    // Prepare reviews for AI analysis
    const reviewsText = reviews
      .map((r: ReviewText, i: number) => `Review ${i + 1} (${r.platform}, rating: ${r.review_rating || 'N/A'}):\n${r.review_text}`)
      .join('\n\n---\n\n');

    // Call Lovable AI Gateway
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are a hotel review analyst. Analyze guest reviews and identify key themes. Be specific and actionable. Always respond with valid JSON only, no markdown.`
          },
          {
            role: 'user',
            content: `Analyze these ${reviews.length} hotel reviews and provide:
1. Top 5 positive themes (things guests love) with frequency count and a representative quote
2. Top 5 negative themes (areas for improvement) with frequency count and a representative quote
3. One-sentence overall summary

Here are the reviews:

${reviewsText}

Respond ONLY with this JSON structure (no markdown, no code blocks):
{
  "positive": [{"theme": "Clean rooms", "count": 23, "quote": "The room was spotless..."}],
  "negative": [{"theme": "Slow WiFi", "count": 8, "quote": "WiFi was frustratingly slow..."}],
  "summary": "Overall positive reception with consistent praise for..."
}`
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits depleted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI analysis failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No response from AI');
    }

    console.log('AI response:', content);

    // Parse the JSON response
    let analysis: AnalysisResult;
    try {
      // Clean up potential markdown formatting
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      throw new Error('Failed to parse AI analysis');
    }

    // Store the analysis results using upsert
    const { error: upsertError } = await supabase
      .from('review_analysis')
      .upsert({
        property_id: propertyId,
        positive_themes: analysis.positive || [],
        negative_themes: analysis.negative || [],
        summary: analysis.summary || '',
        review_count: reviews.length,
        analyzed_at: new Date().toISOString(),
      }, {
        onConflict: 'property_id',
      });

    if (upsertError) {
      console.error('Failed to store analysis:', upsertError);
      // Don't fail - still return the analysis
    }

    return new Response(
      JSON.stringify({
        success: true,
        analysis: {
          positive: analysis.positive || [],
          negative: analysis.negative || [],
          summary: analysis.summary || '',
          reviewCount: reviews.length,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error analyzing reviews:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
