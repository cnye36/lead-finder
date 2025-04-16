import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(/* request: Request */) {
  try {
    const leads = await prisma.lead.findMany({
      orderBy: {
        createdAt: "desc", // Order by most recently created
      },
    });

    // Parse the emailsJson string back into an array for the frontend
    const leadsWithParsedEmails = leads.map((lead) => ({
      ...lead,
      emails: lead.emailsJson ? JSON.parse(lead.emailsJson) : [],
    }));

    return NextResponse.json({ success: true, leads: leadsWithParsedEmails });
  } catch (error) {
    console.error("Error fetching leads:", error);
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch leads.",
        error: message,
      },
      { status: 500 }
    );
  }
}
