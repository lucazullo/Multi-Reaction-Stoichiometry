"use client";

interface HelpModalProps {
  onClose: () => void;
}

export default function HelpModal({ onClose }: HelpModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 overflow-y-auto py-8"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-gray-200 bg-gradient-to-r from-slate-800 via-teal-900 to-slate-800 rounded-t-xl">
          <h2 className="text-xl font-bold text-white">
            User Guide
          </h2>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition p-1"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-8 py-6 space-y-6 max-h-[75vh] overflow-y-auto text-sm text-gray-700 leading-relaxed">

          {/* Overview */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Overview</h3>
            <p>
              The Multi-Reaction Stoichiometry Calculator lets you build chemical reaction systems
              — single reactions, parallel pathways, or sequential chains — and calculate quantities,
              thermodynamics, and economics across the entire system.
            </p>
            <p className="mt-2">
              Describe reactions in plain English and the app uses AI to parse them into balanced
              chemical equations with accurate molar masses, physical states, and enthalpies of formation.
            </p>
          </section>

          {/* Getting Started */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Getting Started</h3>
            <ol className="list-decimal list-inside space-y-2">
              <li>
                <strong>Add a reaction</strong> — Type a description in the input field (e.g.,
                &ldquo;methane reacts with steam to produce carbon monoxide and hydrogen&rdquo;)
                and click <span className="font-medium text-teal-700">Balance</span>. Or click one of
                the example buttons.
              </li>
              <li>
                <strong>Add more reactions</strong> — Repeat to build a multi-reaction system.
                Each reaction appears as a collapsible card.
              </li>
              <li>
                <strong>Link reactions in series</strong> — Click{" "}
                <span className="font-medium text-purple-700">Add Series Link Between Reactions</span>{" "}
                to connect a product of one reaction to a reactant of another. Set the fraction
                (0&ndash;1) of the product that flows downstream.
              </li>
              <li>
                <strong>Calculate</strong> — In the &ldquo;Calculate System&rdquo; section, select a
                starting reaction and substance, enter an amount and unit, then click{" "}
                <span className="font-medium text-teal-700">Calculate System</span>.
              </li>
            </ol>
          </section>

          {/* Bidirectional Calculation */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Forward &amp; Backward Calculation</h3>
            <p>
              You can calculate from <strong>any point</strong> in the reaction chain:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>
                <strong>Forward</strong> — Start with a feedstock (e.g., 100 kg CH&#x2084;) and the
                system calculates all downstream products.
              </li>
              <li>
                <strong>Backward</strong> — Start with a desired product (e.g., 1000 kg urea) and
                the system calculates all upstream feedstocks needed.
              </li>
            </ul>
          </section>

          {/* Results Tabs */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Results Tabs</h3>
            <p>After calculating, four tabs appear:</p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li>
                <strong>Per Reaction</strong> — Quantities for each individual reaction (moles, grams,
                kg, lb, liters, gallons).
              </li>
              <li>
                <strong>System Totals</strong> — Overall balanced equation for the entire system, plus
                a detailed mass balance. Substances are classified as:
                <ul className="list-none ml-6 mt-1 space-y-0.5">
                  <li><span className="text-blue-700 font-medium">Feedstock</span> — net inputs consumed by the system</li>
                  <li><span className="text-green-700 font-medium">Product</span> — net outputs produced</li>
                  <li><span className="text-gray-500 font-medium">Intermediate</span> — produced and fully consumed internally</li>
                  <li><span className="text-amber-700 font-medium">Excess</span> — produced more than consumed (byproduct)</li>
                  <li><span className="text-red-700 font-medium">Deficit</span> — consumed more than produced (additional input needed)</li>
                </ul>
              </li>
              <li>
                <strong>Thermodynamics</strong> — Enthalpy of reaction (&#916;H) for each reaction and the
                full system, with exothermic/endothermic classification. Toggle between kJ and BTU.
                Specific energy per unit of the selected substance is also shown.
              </li>
              <li>
                <strong>Economics</strong> — Enter prices for feedstocks and products at the system
                boundary. Intermediates are internal and not priced. Excess substances can be assigned
                a value. The summary shows total feedstock cost, product/excess value, and net delta.
                Methane (CH&#x2084;) supports pricing in $/MMBTU.
              </li>
            </ul>
          </section>

          {/* Saving Sessions */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Saving &amp; Loading Sessions</h3>
            <p>
              The <strong>Saved Sessions</strong> panel (top of the page) lets you persist your work
              in the browser:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong>Save As</strong> — Save the current state with a new name.</li>
              <li><strong>Save</strong> — Overwrite the currently loaded session (appears when working on a loaded session).</li>
              <li><strong>Load</strong> — Restore a previously saved session including all reactions, links, results, input values, and economics prices.</li>
              <li><strong>Delete</strong> — Remove a saved session.</li>
            </ul>
            <p className="mt-2 text-xs text-gray-500">
              Sessions are stored in your browser&rsquo;s local storage. They persist across page
              refreshes but are specific to this browser and device.
            </p>
          </section>

          {/* Downloads */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Downloading Results</h3>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Download CSV</strong> buttons on individual tables export that section.</li>
              <li><strong>Download Full System Report (CSV)</strong> exports all reactions, totals, thermodynamics, economics, and links.</li>
              <li><strong>Download PNG</strong> on the System Summary panel exports the overall equation as an image.</li>
            </ul>
          </section>

          {/* Supported Units */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Supported Units</h3>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Mass</p>
                <p>Grams, Kilograms, Pounds</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Volume (liquids)</p>
                <p>Liters, Gallons</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Amount</p>
                <p>Moles</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Energy</p>
                <p>kJ, BTU</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Pricing</p>
                <p>$/mol, $/g, $/kg, $/lb, $/MMBTU (methane)</p>
              </div>
            </div>
          </section>

          {/* Tips */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Tips</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Be specific in reaction descriptions — include reactant and product names.</li>
              <li>Use the fraction field in series links to model partial conversions or splits.</li>
              <li>Check the System Totals tab for excess/deficit warnings that indicate stoichiometric imbalances.</li>
              <li>Save your work frequently — the AI parsing costs API credits each time.</li>
            </ul>
          </section>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-teal-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-teal-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
