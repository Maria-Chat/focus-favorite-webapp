import { NextRequest, NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import { google } from '@ai-sdk/google';

// AI Extraction Schema for LLM using Zod
const ExtractionSchema = z.object({
  normalized_category: z.enum([
    'Food & Cafe',
    'Travel',
    'Tech & Knowledge',
    'Entertainment',
    'Shopping',
    'Lifestyle',
    'General Content'
  ]).describe('The main category of the content based on its title and caption.'),
  tags: z.array(z.string()).max(5).describe('3-5 relevant keywords or hashtags.'),
  extracted_locations: z.array(z.object({
    name: z.string().describe('The name of the place, restaurant, or location mentioned.'),
    type: z.string().describe('e.g., Cafe, Restaurant, Park, Museum, Mall, etc.')
  })).describe('List of specific places or geographical locations mentioned in the content. Empty array if none.')
});

async function geocodeLocation(name: string) {
  // Using OpenStreetMap Nominatim API for free Geocoding (no API key required)
  // Note: Nominatim requires a User-Agent header
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name + ' Thailand')}&format=json&limit=1`, {
      headers: {
        'User-Agent': 'FocusFavoriteApp/1.0'
      }
    });
    const data = await res.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        formatted_address: data[0].display_name
      };
    }
  } catch (err) {
    console.error(`Geocoding failed for ${name}:`, err);
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { title, caption, platform } = await req.json();

    if (!title && !caption) {
      return NextResponse.json({ error: 'Missing title or caption' }, { status: 400 });
    }

    const textToAnalyze = `
      Platform: ${platform}
      Title: ${title}
      Caption: ${caption}
    `;

    // Use Gemini
    let model = null;
    if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      model = google('gemini-3.8-flash');
    } else {
      // Fallback rule-based if no API key is provided
      console.warn("No AI API keys provided. Using fallback rule-based extraction.");
      return NextResponse.json({
        normalized_category: 'General Content',
        tags: ['auto-extracted'],
        extracted_locations: []
      });
    }

    // Call LLM for structured extraction
    const { object } = await generateObject({
      model,
      schema: ExtractionSchema,
      prompt: `Analyze the following social media saved content and extract its category, tags, and specific real-world locations (like restaurants, cafes, tourist spots in Thailand or elsewhere).\n\nContent:\n${textToAnalyze}`
    });

    // Geocode the extracted locations
    const enrichedLocations = await Promise.all(
      object.extracted_locations.map(async (loc) => {
        const coords = await geocodeLocation(loc.name);
        return {
          ...loc,
          ...(coords || { lat: 13.7563, lng: 100.5018, formatted_address: 'Bangkok, Thailand (Fallback)' })
        };
      })
    );

    return NextResponse.json({
      normalized_category: object.normalized_category,
      tags: object.tags,
      extracted_locations: enrichedLocations
    });

  } catch (error: any) {
    console.error('AI Processing Error:', error);
    return NextResponse.json({ error: error.message || 'Processing failed' }, { status: 500 });
  }
}
