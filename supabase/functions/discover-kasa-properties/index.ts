import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      throw new Error('FIRECRAWL_API_KEY is not configured');
    }

    console.log('Scraping kasa.com/locations for property list...');

    // Scrape the Kasa locations page
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://kasa.com/locations',
        formats: ['html', 'links'],
        onlyMainContent: false,
        waitFor: 3000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Firecrawl error:', errorText);
      throw new Error(`Firecrawl request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('Firecrawl response received');

    // Extract property URLs from the page
    const links: string[] = data.data?.links || data.links || [];
    
    // Filter for property URLs (e.g., /properties/kasa-sunset-los-angeles)
    const propertyUrls = links
      .filter((link: string) => link.includes('/properties/') || link.includes('kasa.com/properties/'))
      .map((link: string) => {
        // Normalize URLs
        if (link.startsWith('/')) {
          return `https://kasa.com${link}`;
        }
        return link;
      })
      .filter((link: string, index: number, arr: string[]) => arr.indexOf(link) === index); // Remove duplicates

    // Extract property slugs and names
    const properties = propertyUrls.map((url: string) => {
      const match = url.match(/\/properties\/([^/?#]+)/);
      const slug = match ? match[1] : '';
      // Convert slug to readable name (kasa-sunset-los-angeles -> Kasa Sunset Los Angeles)
      const name = slug
        .split('-')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      return {
        url,
        slug,
        name,
      };
    }).filter((p: { slug: string }) => p.slug);

    console.log(`Found ${properties.length} Kasa properties`);

    return new Response(
      JSON.stringify({
        success: true,
        properties,
        count: properties.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error discovering Kasa properties:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
