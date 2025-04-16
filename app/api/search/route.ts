// pages/api/search.ts
import { NextResponse } from "next/server";
import axios from "axios";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query) {
      return NextResponse.json(
        { success: false, message: "Query is required" },
        { status: 400 }
      );
    }

    // Call Outscraper Google Places API endpoint
    const outscraperApiKey = process.env.OUTSCRAPER_API_KEY;

    // Fetch results from Outscraper
    const apiResponse = await axios.get(
      "https://api.app.outscraper.com/maps/search-v3",
      {
        params: {
          query: query,
          location: "Portland, Oregon, United States",
          limit: 10,
          language: "en",
          region: "us",
          coordinates: "45.5155,-122.6789",
          enrichment: "domain_service, emails_validator_service",
          async: true,
        },
        headers: {
          "X-API-KEY": outscraperApiKey,
        },
      }
    );

    // For async requests, Outscraper returns a request ID
    const { id, status, results_location } = apiResponse.data;

    return NextResponse.json({
      success: true,
      message: "Search request initiated successfully",
      requestId: id,
      status,
      resultsLocation: results_location,
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
