import { NextResponse } from "next/server";
import axios from "axios";
import { prisma } from "@/lib/prisma"; // Import Prisma client

// Define an interface for the expected lead result structure from Outscraper
interface OutscraperLeadResult {
  place_id?: string;
  name?: string;
  full_address?: string;
  phone?: string;
  site?: string;
  type?: string;
  emails?: string[];
  // Add other potential fields from Outscraper response as needed
}

export async function GET(
  request: Request,
  { params }: { params: { requestId: string } }
) {
  try {
    const outscraperApiKey = process.env.OUTSCRAPER_API_KEY;
    const requestId = params.requestId;

    if (!outscraperApiKey) {
      return NextResponse.json(
        { success: false, message: "API key is not configured." },
        { status: 500 }
      );
    }

    if (!requestId) {
      return NextResponse.json(
        { success: false, message: "Request ID is required" },
        { status: 400 }
      );
    }

    // Fetch results from Outscraper
    const response = await axios.get(
      `https://api.app.outscraper.com/requests/${requestId}`,
      {
        headers: {
          "X-API-KEY": outscraperApiKey,
        },
        // Validate status to prevent axios from throwing on non-2xx responses
        // Outscraper uses 200 for success/pending and potentially others we might want to handle
        validateStatus: function (status) {
          return status >= 200 && status < 500; // Accept all non-server error statuses
        },
      }
    );

    // Check response status from Outscraper
    if (response.status !== 200) {
      // You might want more specific handling based on Outscraper's non-200 status codes
      console.error(
        `Outscraper API error for requestId ${requestId}: Status ${response.status}`,
        response.data
      );
      return NextResponse.json(
        {
          success: false,
          message: `Outscraper API returned status ${response.status}`,
          error: response.data,
        },
        { status: response.status } // Forward Outscraper's status code
      );
    }

    const { status, data } = response.data;

    console.log("status", status);
    console.log("data structure received:", data);
    // If successful and data exists, save/update leads in the database
    if (
      status === "Success" &&
      Array.isArray(data) &&
      data.length > 0 &&
      Array.isArray(data[0])
    ) {
      const leadsToSave: OutscraperLeadResult[] = data[0]; // Assign the inner array
      let savedCount = 0;
      let failedCount = 0;

      console.log(
        `Found ${leadsToSave.length} potential leads in the nested array.`
      );

      for (const lead of leadsToSave) {
        if (!lead || !lead.place_id) {
          // Add a check for lead object itself
          console.warn(
            "Skipping lead due to missing object or place_id:",
            lead?.name || "(no name)"
          );
          failedCount++;
          continue; // Skip if place_id is missing, as it's our unique identifier
        }

        try {
          const leadData = {
            name: lead.name,
            full_address: lead.full_address,
            phone: lead.phone,
            site: lead.site,
            type: lead.type,
            emailsJson: lead.emails ? JSON.stringify(lead.emails) : null,
            socialsJson: null,
          };

          await prisma.lead.upsert({
            where: { place_id: lead.place_id },
            update: leadData,
            create: {
              ...leadData,
              place_id: lead.place_id,
            },
          });
          savedCount++;
        } catch (dbError) {
          console.error(
            `Failed to save lead ${lead.place_id} (${lead.name}):`,
            dbError
          );
          failedCount++;
        }
      }
      console.log(`Saved ${savedCount} leads, failed to save ${failedCount}.`);
    } else if (status === "Success") {
      // Handle cases where status is Success but data format is unexpected
      console.warn(
        "Received Success status but data format is not the expected nested array:",
        data
      );
    }

    // Return the original Outscraper status and data
    return NextResponse.json({
      success: true,
      status: status,
      data: data, // Return original data structure for frontend polling
    });
  } catch (error) {
    console.error(
      `Error fetching results for requestId ${params.requestId}:`,
      error
    );
    // Handle potential network errors or errors within axios itself
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error fetching results.",
        error: message,
      },
      { status: 500 }
    );
  }
}
