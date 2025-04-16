"use client";

import { useState, useEffect } from "react";

// Define an interface for the expected lead result structure
// Reflecting data potentially coming from DB or Outscraper initially
interface LeadResult {
  id?: string; // Database ID (might be added later)
  place_id: string; // Use place_id as the primary key for operations
  name?: string;
  full_address?: string;
  address?: string;
  phone?: string;
  site?: string;
  domain?: string;
  emails?: string[];
  // Add other potential fields from Outscraper response as needed
}

// Define a type for the raw data item before validation/filtering
interface OutscraperRawLead {
  place_id?: string; // Make optional initially as we need to check it
  id?: string;
  name?: string;
  full_address?: string;
  address?: string;
  phone?: string;
  site?: string;
  domain?: string;
  emails?: string[];
  // Include other potential fields that might come raw from Outscraper
}

const RESULTS_PER_PAGE = 20;

export default function Home() {
  const [query, setQuery] = useState<string>("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [results, setResults] = useState<LeadResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pollingIntervalId, setPollingIntervalId] =
    useState<NodeJS.Timeout | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const handleSearch = async () => {
    if (!query.trim()) {
      setError("Please enter a search query.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setResults([]);
    setCurrentPage(1); // Reset to first page on new search
    setRequestId(null);
    setStatus(null);
    if (pollingIntervalId) clearInterval(pollingIntervalId); // Clear previous interval if any

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to initiate search.");
      }

      setRequestId(data.requestId);
      setStatus(data.status); // Initial status (likely 'Pending')
      setIsLoading(false); // Initial request done, now polling starts

      // Start polling if we have a request ID
      if (data.requestId) {
        startPolling(data.requestId);
      }
    } catch (err: unknown) {
      console.error("Search initiation error:", err);
      const message =
        err instanceof Error
          ? err.message
          : "An error occurred during search initiation.";
      setError(message);
      setIsLoading(false);
      if (pollingIntervalId) clearInterval(pollingIntervalId);
    }
  };

  const pollResults = async (currentRequestId: string) => {
    console.log("Polling for results for request ID:", currentRequestId);
    try {
      const response = await fetch(`/api/request-results/${currentRequestId}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            `Failed to fetch results (status: ${response.status}).`
        );
      }

      setStatus(data.status);

      if (data.status === "Success") {
        console.log("Polling successful, raw data:", data.data);
        // Assuming data.data contains the nested array: data.data[0]
        const rawLeads: OutscraperRawLead[] = // Use the new type here
          Array.isArray(data.data) && Array.isArray(data.data[0])
            ? data.data[0]
            : [];

        // Filter out leads without a place_id and ensure type safety
        const processedResults: LeadResult[] = rawLeads
          .filter(
            (item: OutscraperRawLead): item is LeadResult =>
              !!item.place_id && item.place_id.trim() !== ""
          ) // Type guard ensures place_id exists and is string
          .map((item: LeadResult) => ({
            // Map to ensure structure matches LeadResult (item is now guaranteed to be LeadResult by the filter)
            place_id: item.place_id, // place_id is guaranteed by filter
            id: item.id,
            name: item.name,
            full_address: item.full_address,
            address: item.address,
            phone: item.phone,
            site: item.site,
            domain: item.domain,
            emails: item.emails,
          }));

        console.log("Processed results with place_id:", processedResults);
        setResults(processedResults);
        setError(null);
        if (pollingIntervalId) clearInterval(pollingIntervalId);
        setPollingIntervalId(null); // Clear interval ID state
      } else if (data.status === "Failure") {
        console.error("Search failed on Outscraper:", data.data);
        setError("The search request failed. Please try again.");
        if (pollingIntervalId) clearInterval(pollingIntervalId);
        setPollingIntervalId(null);
      } else {
        // Still Pending or another status, continue polling
        console.log("Search status:", data.status);
      }
    } catch (err: unknown) {
      console.error("Polling error:", err);
      const message =
        err instanceof Error
          ? err.message
          : "An error occurred while fetching results.";
      setError(message);
      if (pollingIntervalId) clearInterval(pollingIntervalId);
      setPollingIntervalId(null);
    }
  };

  const startPolling = (currentRequestId: string) => {
    // Clear any existing interval before starting a new one
    if (pollingIntervalId) {
      clearInterval(pollingIntervalId);
    }

    // Initial check immediately
    pollResults(currentRequestId);

    // Set up the interval
    const intervalId = setInterval(() => {
      pollResults(currentRequestId);
    }, 10000); // Poll every 10 seconds

    setPollingIntervalId(intervalId);
  };

  // Cleanup interval on component unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
      }
    };
  }, [pollingIntervalId]);

  const handleDelete = async (placeIdToDelete: string) => {
    // Placeholder: Call API: await fetch(`/api/leads/${placeIdToDelete}`, { method: 'DELETE' });
    console.log("Attempting to delete lead with place_id:", placeIdToDelete);
    // Update frontend state optimistically
    setResults((prevResults) =>
      prevResults.filter((result) => result.place_id !== placeIdToDelete)
    );
    // Adjust current page if the last item on the page was deleted
    const newTotalResults = results.length - 1;
    const totalPages = Math.ceil(newTotalResults / RESULTS_PER_PAGE);
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    } else if (newTotalResults === 0) {
      setCurrentPage(1); // Reset to page 1 if no results left
    }
    // TODO: Add error handling if API call fails and revert state
  };

  // Pagination calculations
  const totalPages = Math.ceil(results.length / RESULTS_PER_PAGE);
  const startIndex = (currentPage - 1) * RESULTS_PER_PAGE;
  const endIndex = startIndex + RESULTS_PER_PAGE;
  const currentResults = results.slice(startIndex, endIndex);

  return (
    <main className="flex min-h-screen flex-col items-center p-12 bg-gray-900 text-gray-200">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex mb-8">
        <h1 className="text-3xl font-bold text-white">Local Lead Finder</h1>
      </div>

      <div className="w-full max-w-5xl bg-gray-800 p-8 rounded-lg shadow-md">
        <div className="flex gap-4 mb-6">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., plumbers in Portland, OR"
            className="flex-grow p-3 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white placeholder-gray-400"
          />
          <button
            onClick={handleSearch}
            disabled={
              isLoading || (status === "Pending" && !!pollingIntervalId)
            }
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading || (status === "Pending" && !!pollingIntervalId)
              ? "Searching..."
              : "Search"}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900 bg-opacity-50 text-red-300 border border-red-700 rounded-md">
            {error}
          </div>
        )}

        {requestId && (
          <div className="mb-4 text-sm text-gray-400">
            Request ID: {requestId} | Status: {status || "Initiated"}
            {status === "Pending" && !!pollingIntervalId && (
              <span className="animate-pulse"> (Checking for results...)</span>
            )}
          </div>
        )}

        {/* Results Table */}
        {results.length > 0 && (
          <div className="mt-6 overflow-x-auto">
            <h2 className="text-xl font-semibold mb-4 text-gray-100">
              Results ({results.length} found):
            </h2>
            <table className="min-w-full divide-y divide-gray-700 table-auto">
              <thead className="bg-gray-750">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                  >
                    Name
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                  >
                    Address
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                  >
                    Phone
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                  >
                    Website
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                  >
                    Emails
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {currentResults.map((result) => (
                  <tr key={result.place_id} className="hover:bg-gray-700">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">
                      {result.name || "N/A"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                      {result.full_address || result.address || "N/A"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                      {result.phone || "N/A"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                      {result.site ? (
                        <a
                          href={
                            result.site.startsWith("http")
                              ? result.site
                              : `http://${result.site}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 hover:underline"
                        >
                          {result.site}
                        </a>
                      ) : (
                        "N/A"
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300 break-words max-w-xs">
                      {" "}
                      {/* Allow email wrapping */}
                      {Array.isArray(result.emails) && result.emails.length > 0
                        ? result.emails.join(", ")
                        : "N/A"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleDelete(result.place_id)}
                        className="text-red-500 hover:text-red-400"
                        title="Delete Lead"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-4 flex justify-between items-center text-sm text-gray-400">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-gray-600 rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-gray-600 rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
        {/* Show message if search returned successfully but with 0 results (and results processed) */}
        {status === "Success" &&
          results.length === 0 &&
          !isLoading &&
          !error && (
            <div className="mt-6 text-center text-gray-400">
              No results found for your query (or results lacked place_id).
            </div>
          )}
      </div>
    </main>
  );
}
