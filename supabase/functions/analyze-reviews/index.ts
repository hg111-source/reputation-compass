import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ReviewText {
  review_text: string;
  review_rating: number | null;
  platform: string;
  property_id?: string;
}

interface ThemeResult {
  theme: string;
  count: number;
  quote: string;
}

interface AnalysisResult {
  positive_themes: ThemeResult[];
  negative_themes: ThemeResult[];
  summary: string;
}

// Pre-processing: Filter and categorize reviews
function preprocessReviews(reviews: ReviewText[]): { positive: ReviewText[]; negative: ReviewText[]; neutral: ReviewText[] } {
  // Filter reviews with 10+ words
  const filtered = reviews.filter(r => {
    const wordCount = r.review_text.trim().split(/\s+/).length;
    return wordCount >= 10;
  });

  // Split by rating
  const positive = filtered
    .filter(r => r.review_rating !== null && r.review_rating >= 4)
    .slice(0, 50); // Most recent 50

  const negative = filtered
    .filter(r => r.review_rating !== null && r.review_rating <= 2)
    .slice(0, 50);

  // Include neutral/unrated for context
  const neutral = filtered
    .filter(r => r.review_rating === null || (r.review_rating > 2 && r.review_rating < 4))
    .slice(0, 25);

  return { positive, negative, neutral };
}

// Post-processing: Filter and sort themes
function postprocessThemes(themes: ThemeResult[]): ThemeResult[] {
  return themes
    .filter(t => t.count >= 2) // Remove themes with < 2 mentions
    .sort((a, b) => b.count - a.count) // Sort by count descending
    .slice(0, 5); // Top 5
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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { propertyId, groupId } = await req.json();
    
    if (!propertyId && !groupId) {
      return new Response(
        JSON.stringify({ error: 'propertyId or groupId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let reviews: ReviewText[] = [];
    let analysisTarget: string;

    if (groupId) {
      // GROUP-LEVEL ANALYSIS: Fetch reviews for all properties in the group
      console.log(`Analyzing reviews for group: ${groupId}`);
      analysisTarget = groupId;

      // Get property IDs in this group
      const { data: groupProperties, error: gpError } = await supabase
        .from('group_properties')
        .select('property_id')
        .eq('group_id', groupId);

      if (gpError) throw new Error(`Failed to fetch group properties: ${gpError.message}`);
      
      if (!groupProperties || groupProperties.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No properties in this group' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const propertyIds = groupProperties.map(gp => gp.property_id);
      
      const { data: groupReviews, error: reviewsError } = await supabase
        .from('review_texts')
        .select('review_text, review_rating, platform, property_id')
        .in('property_id', propertyIds)
        .order('collected_at', { ascending: false })
        .limit(200);

      if (reviewsError) throw new Error(`Failed to fetch reviews: ${reviewsError.message}`);
      reviews = groupReviews || [];

    } else {
      // PROPERTY-LEVEL ANALYSIS
      console.log(`Analyzing reviews for property: ${propertyId}`);
      analysisTarget = propertyId;

      const { data: propReviews, error: reviewsError } = await supabase
        .from('review_texts')
        .select('review_text, review_rating, platform')
        .eq('property_id', propertyId)
        .order('collected_at', { ascending: false })
        .limit(150);

      if (reviewsError) throw new Error(`Failed to fetch reviews: ${reviewsError.message}`);
      reviews = propReviews || [];
    }

    if (reviews.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No reviews found. Fetch reviews first using the Insights button.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // RULE-BASED PRE-PROCESSING
    const { positive, negative, neutral } = preprocessReviews(reviews);
    
    console.log(`Pre-processed: ${positive.length} positive, ${negative.length} negative, ${neutral.length} neutral reviews`);

    if (positive.length === 0 && negative.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Not enough rated reviews for analysis. Need reviews with ratings.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format reviews for LLM
    const formatReviews = (revs: ReviewText[]) => 
      revs.map((r, i) => `${i + 1}. [${r.platform}] "${r.review_text}"`).join('\n');

    const positiveText = positive.length > 0 
      ? formatReviews(positive) 
      : 'No positive reviews available.';
    
    const negativeText = negative.length > 0 
      ? formatReviews(negative) 
      : 'No negative reviews available.';

    // LLM ANALYSIS with Lovable AI Gateway
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
            content: `You are a hotel review analyst. Analyze guest reviews and identify recurring themes. Be specific, actionable, and data-driven. Always respond with valid JSON only, no markdown code blocks.`
          },
          {
            role: 'user',
            content: `Analyze these hotel reviews and identify the most common themes.

POSITIVE REVIEWS (rating 4-5 stars):
${positiveText}

NEGATIVE REVIEWS (rating 1-2 stars):
${negativeText}

Instructions:
1. Identify the top 5 positive themes (what guests love)
2. Identify the top 5 negative themes (areas for improvement)  
3. For each theme, estimate how many reviews mention it
4. Include a representative quote (verbatim from reviews)
5. Write a one-sentence overall assessment

Respond ONLY with this JSON structure:
{
  "positive_themes": [{"theme": "Clean Rooms", "count": 23, "quote": "The room was spotless and modern"}],
  "negative_themes": [{"theme": "Slow WiFi", "count": 8, "quote": "WiFi was frustratingly slow"}],
  "summary": "Guests consistently praise X while noting Y as the main area for improvement."
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
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a minute.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits depleted. Please add credits to your workspace.' }),
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

    console.log('AI response received');

    // Parse and validate JSON response
    let analysis: AnalysisResult;
    try {
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Failed to parse AI analysis result');
    }

    // RULE-BASED POST-PROCESSING
    const processedPositive = postprocessThemes(analysis.positive_themes || []);
    const processedNegative = postprocessThemes(analysis.negative_themes || []);

    // Store results (only for property-level analysis)
    if (propertyId && !groupId) {
      const { error: upsertError } = await supabase
        .from('review_analysis')
        .upsert({
          property_id: propertyId,
          positive_themes: processedPositive,
          negative_themes: processedNegative,
          summary: analysis.summary || '',
          review_count: positive.length + negative.length + neutral.length,
          analyzed_at: new Date().toISOString(),
        }, {
          onConflict: 'property_id',
        });

      if (upsertError) {
        console.error('Failed to cache analysis:', upsertError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        analysis: {
          positive_themes: processedPositive,
          negative_themes: processedNegative,
          summary: analysis.summary || '',
          review_count: positive.length + negative.length,
          breakdown: {
            positive_reviews: positive.length,
            negative_reviews: negative.length,
            neutral_reviews: neutral.length,
          },
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
