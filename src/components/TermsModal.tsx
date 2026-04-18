"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface TermsModalProps {
  onClose: () => void;
}

export function TermsModal({ onClose }: TermsModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-16 px-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Terms of Use</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 max-h-[65vh] overflow-y-auto text-sm text-gray-700 space-y-4 leading-relaxed text-left">
          <section>
            <h3 className="font-semibold text-gray-800 mb-1">
              AI-Generated Content; No Warranty; Use at Your Own Risk
            </h3>
            <p>
              ReactionIQ uses large language models (Claude) to parse user-described
              reactions, infer stoichiometry, look up physical properties, estimate
              thermodynamic and kinetic parameters, and suggest SMILES for structure
              rendering. It also performs numerical calculations (balancing, ICE tables,
              integration of rate equations, equilibrium solvers, economics). All outputs
              are for informational and educational purposes only.
            </p>
          </section>
          <section>
            <h3 className="font-semibold text-gray-800 mb-1">AI Output May Be Incorrect</h3>
            <p>
              LLM-generated chemistry is subject to hallucination. Reaction equations,
              enthalpies, equilibrium constants, rate laws, activation energies, molar
              masses, physical states, prices, and molecular structures may be wrong,
              outdated, misattributed, or fabricated. Even when a citation is shown, the
              underlying value may not match the citation. Always check against a primary
              source (NIST, peer-reviewed literature, or laboratory data) before using any
              number for design, safety, or commercial purposes.
            </p>
          </section>
          <section>
            <h3 className="font-semibold text-gray-800 mb-1">Numerical Calculations</h3>
            <p>
              Derived quantities (yields, heat of reaction, system-level mass and energy
              balances, economics) are only as good as the inputs. Rounding, unit
              conversions, sign conventions, and assumptions about phase, temperature, or
              standard states can introduce errors. Results are shown with computed
              precision, not measured accuracy.
            </p>
          </section>
          <section>
            <h3 className="font-semibold text-gray-800 mb-1">No Warranty</h3>
            <p>
              ReactionIQ is provided <em>“as is”</em> and <em>“as available”</em>, without
              any warranty of any kind, express or implied, including but not limited to
              warranties of merchantability, fitness for a particular purpose,
              non-infringement, accuracy, or availability. No promise is made that the
              site will be error-free, complete, up-to-date, or uninterrupted.
            </p>
          </section>
          <section>
            <h3 className="font-semibold text-gray-800 mb-1">Not Engineering or Safety Advice</h3>
            <p>
              ReactionIQ is not a substitute for qualified chemical, process, or safety
              engineering judgment. Do not use its output as the basis for reactor design,
              process scale-up, hazardous-material handling, regulatory filings, or any
              decision with safety, environmental, or financial consequences without
              independent verification by a qualified professional.
            </p>
          </section>
          <section>
            <h3 className="font-semibold text-gray-800 mb-1">Third-Party Sources</h3>
            <p>
              When literature lookup or web search is enabled, ReactionIQ may surface
              citations to public databases and publications. Those sources remain the
              property of their respective owners and are subject to their own terms of
              use. ReactionIQ does not endorse, verify, or control the underlying content.
            </p>
          </section>
          <section>
            <h3 className="font-semibold text-gray-800 mb-1">Limitation of Liability</h3>
            <p>
              To the maximum extent permitted by applicable law, neither ReactionIQ nor
              its operators or contributors shall be liable for any direct, indirect,
              incidental, consequential, special, exemplary, or punitive damages arising
              out of or in connection with the use of, or inability to use, the site or
              its content, including but not limited to decisions, analyses, or actions
              based on any value or result presented here.
            </p>
          </section>
          <section>
            <h3 className="font-semibold text-gray-800 mb-1">Use at Your Own Risk</h3>
            <p>
              By using this site you acknowledge and accept the above, and agree that any
              reliance on the content is solely at your own risk.
            </p>
          </section>
        </div>
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-teal-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
