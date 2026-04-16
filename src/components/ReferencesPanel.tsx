"use client";

import type { Reference } from "@/lib/types";

interface ReferencesPanelProps {
  references: Reference[];
}

/**
 * Check if a URL is a specific deep link (DOI, compound page, etc.)
 * vs a generic homepage or top-level page.
 */
function isVerifiedLink(url: string): boolean {
  try {
    const u = new URL(url);
    const path = u.pathname;

    // DOI links are always specific
    if (u.hostname.includes("doi.org")) return true;

    // NIST WebBook with compound ID query param
    if (u.hostname.includes("nist.gov") && u.search.includes("ID=")) return true;

    // Generic homepages or top-level pages
    if (path === "/" || path === "" || path === "/index.html") return false;

    // Very short paths are likely generic (e.g. /webbook, /chemistry)
    const segments = path.split("/").filter(Boolean);
    if (segments.length <= 1) return false;

    // URLs with query params or long paths are more likely specific
    if (u.search.length > 5) return true;
    if (segments.length >= 3) return true;

    return false;
  } catch {
    return false;
  }
}

export default function ReferencesPanel({ references }: ReferencesPanelProps) {
  if (references.length === 0) return null;

  return (
    <details className="mt-2 rounded-lg border border-gray-200 bg-gray-50">
      <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-gray-600 hover:text-gray-800">
        References ({references.length})
      </summary>
      <ul className="divide-y divide-gray-200 px-3 pb-2">
        {references.map((ref, i) => {
          const verified = ref.url ? isVerifiedLink(ref.url) : false;

          return (
            <li key={i} className="py-2">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-[10px] font-bold text-gray-600">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-gray-700">{ref.citation}</p>
                  <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-medium text-teal-700">
                      {ref.dataType}
                    </span>
                    {ref.url && verified && (
                      <a
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-teal-600 underline hover:text-teal-800"
                      >
                        View source
                      </a>
                    )}
                    {ref.url && !verified && (
                      <span className="flex items-center gap-1">
                        <a
                          href={ref.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-gray-400 underline hover:text-gray-600"
                        >
                          {new URL(ref.url).hostname}
                        </a>
                        <span className="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-medium text-amber-700">
                          approximate link — navigate to find specific data
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
