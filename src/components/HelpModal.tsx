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
        <div className="flex items-center justify-between px-8 py-5 border-b border-gray-200 bg-gradient-to-b from-slate-50 to-slate-100 rounded-t-xl">
          <h2 className="text-xl font-bold text-slate-800">
            ReactionIQ User Guide
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition p-1"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-8 py-6 space-y-6 max-h-[75vh] overflow-y-auto text-sm text-gray-700 leading-relaxed">

          {/* Table of Contents */}
          <nav className="rounded-lg bg-slate-50 border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Contents</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              {[
                ["overview", "Overview"],
                ["getting-started", "Getting Started"],
                ["bidirectional", "Forward & Backward Calculation"],
                ["modes", "Basic & Advanced Mode"],
                ["stoich-editor", "Stoichiometry Editor & Auto-Balance"],
                ["balance-check", "Balance Checks"],
                ["conversion", "Fractional Conversion"],
                ["lookup", "Literature Lookup"],
                ["kinetics", "Kinetics"],
                ["equilibrium", "Equilibrium"],
                ["selectivity", "Selectivity & Competing Reactions"],
                ["results", "Results Tabs"],
                ["sessions", "Saving & Loading Sessions"],
                ["downloads", "Downloading Results"],
                ["units", "Supported Units"],
                ["network", "Reaction Network Graph"],
                ["topology", "Topology Validation"],
                ["naming", "Naming Reactions"],
                ["tips", "Tips"],
              ].map(([id, label]) => (
                <a
                  key={id}
                  href={`#help-${id}`}
                  className="text-xs text-teal-700 hover:text-teal-900 hover:underline truncate"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(`help-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  {label}
                </a>
              ))}
            </div>
          </nav>

          {/* Overview */}
          <section id="help-overview">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Overview</h3>
            <p>
              ReactionIQ lets you build chemical reaction systems
              — single reactions, parallel pathways, or sequential chains — and calculate quantities,
              kinetics, equilibria, selectivity, thermodynamics, and economics across the entire system.
            </p>
            <p className="mt-2">
              Describe reactions in plain English and the app uses AI to parse them into balanced
              chemical equations with accurate molar masses, physical states, and enthalpies of formation.
            </p>
          </section>

          {/* Getting Started */}
          <section id="help-getting-started">
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
          <section id="help-bidirectional">
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

          {/* Basic & Advanced Mode */}
          <section id="help-modes">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Basic &amp; Advanced Mode</h3>
            <p>
              ReactionIQ has two modes, selectable from the toggle in the header:
            </p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li>
                <strong>Basic</strong> — Standard stoichiometric calculations identical to v1:
                quantities, thermodynamics, and economics. All advanced features are hidden.
              </li>
              <li>
                <strong>Advanced</strong> — Reveals additional controls under each reaction card
                (conversion slider, kinetics parameters, equilibrium data, literature lookup) and
                three new results tabs (Kinetics, Equilibrium, Selectivity). All advanced features
                are optional — you can use them selectively.
              </li>
            </ul>
          </section>

          {/* Stoichiometry Editor & Auto-Balance */}
          <section id="help-stoich-editor">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Stoichiometry Editor &amp; Auto-Balance</h3>
            <p>
              Each reaction card has a flask icon (<span className="text-amber-600">&#x2697;</span>) that opens
              the <strong>Stoichiometry Editor</strong>. It also appears as a &ldquo;Fix stoichiometry&rdquo; link
              in the unbalanced-equation warning. The editor has two modes:
            </p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li>
                <strong>Balance Coefficients</strong> (default) — Formulas are read-only; you adjust
                stoichiometric coefficients. Use the lock icons to mark which coefficients you know:
                <ul className="list-none ml-6 mt-1 space-y-0.5 text-xs">
                  <li><span className="text-amber-700">&#x1F512; Locked</span> — A coefficient you specify (user-known value).</li>
                  <li><span className="text-gray-500">&#x1F513; Unlocked</span> — An unknown the solver will compute.</li>
                </ul>
                <p className="mt-1">
                  The panel shows degrees of freedom: <em>N</em> substances, <em>M</em> atom types,
                  and how many coefficients you&rsquo;ve locked. Once enough are locked
                  (unknowns &le; atom types), the <strong>Auto-balance</strong> button activates and
                  solves the remaining coefficients via Gaussian elimination on the atom-balance matrix.
                </p>
              </li>
              <li>
                <strong>Edit Formulas</strong> — Edit chemical formulas, names, and coefficients directly.
                Use this when the AI parsed the wrong molecular formula (e.g., incorrect triglyceride
                structure). Molar masses are recomputed automatically from IUPAC standard atomic weights.
              </li>
            </ul>
            <p className="mt-2">
              Both modes show a <strong>live equation preview</strong> and a{" "}
              <strong>real-time balance indicator</strong> that updates as you type, so you can see
              immediately when the equation balances.
            </p>
          </section>

          {/* Balance Checks */}
          <section id="help-balance-check">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Balance Checks</h3>
            <p>Two levels of balance verification operate automatically:</p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li>
                <strong>Level 1 — Per-reaction</strong> (immediate): Each reaction card shows an amber
                warning banner if its equation is not atom-balanced. This runs instantly when a reaction
                is parsed — no calculation required. The warning lists each imbalanced element with
                left-side and right-side atom counts.
              </li>
              <li>
                <strong>Level 2 — System-wide</strong> (after Calculate): The{" "}
                <strong>System Totals</strong> tab includes a Balance Check section that verifies
                atom conservation and mass conservation across all linked reactions. It shows a
                per-element table and an overall mass balance with a pass/fail tolerance of 1%.
              </li>
            </ul>
            <p className="mt-2 text-xs text-gray-500">
              Molar masses are computed deterministically from chemical formulas using IUPAC 2021
              standard atomic weights, ensuring the same compound always has the same molar mass
              regardless of which API call parsed it.
            </p>
          </section>

          {/* Conversion */}
          <section id="help-conversion">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Fractional Conversion</h3>
            <p>
              In Advanced mode, each reaction card shows a <strong>Conversion slider</strong> (0&ndash;100%).
              This represents the fraction of the limiting reactant that actually reacts. Default is 100%
              (complete reaction, same as Basic mode). Setting a lower value scales product outputs and
              affects downstream propagation through series links.
            </p>
          </section>

          {/* Literature Lookup */}
          <section id="help-lookup">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Literature Lookup</h3>
            <p>
              In Advanced mode, each reaction card has a{" "}
              <span className="font-medium text-amber-700">Look up parameters</span> button that
              searches for published kinetic and equilibrium data:
            </p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li>
                <strong>Claude lookup</strong> (default) — Searches Claude&rsquo;s training data
                (NIST, textbooks, journals) for rate constants, activation energies, Keq values.
                Fast (~2&ndash;3 seconds).
              </li>
              <li>
                <strong>Include web search</strong> — Check the toggle to also search the web for
                recent publications. More comprehensive but slower (~5&ndash;8 seconds).
              </li>
              <li>
                <strong>Manual entry</strong> — All fields are always editable. Lookup results
                are suggestions that pre-fill the inputs; you can override any value.
              </li>
            </ul>
            <p className="mt-2">
              Results include <strong>confidence ratings</strong> (high/medium/low),{" "}
              <strong>source attribution</strong>, and{" "}
              <strong>literature notes</strong> (e.g., catalyst requirements, operating conditions).
              All lookup data — including references with DOI links — persists across session saves
              and file exports.
            </p>
          </section>

          {/* Kinetics */}
          <section id="help-kinetics">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Kinetics</h3>
            <p>
              Enable the <strong>Kinetics data</strong> checkbox on a reaction card to specify
              rate law parameters:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong>k</strong> — Rate constant at the reference temperature</li>
              <li><strong>E<sub>a</sub></strong> — Activation energy (kJ/mol) for Arrhenius temperature dependence</li>
              <li><strong>Partial orders</strong> — Reaction order with respect to each reactant</li>
              <li><strong>T<sub>ref</sub></strong> — Reference temperature where k was measured</li>
            </ul>
            <p className="mt-2">
              The <strong>Kinetics tab</strong> in results lets you set a calculation temperature,
              reactor volume, and integration time, then click <strong>Run Kinetics</strong> to see:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Concentration-vs-time profiles for all species (interactive chart)</li>
              <li>k(T) computed via Arrhenius: k(T) = k(T<sub>ref</sub>) &times; exp(&minus;E<sub>a</sub>/R &times; (1/T &minus; 1/T<sub>ref</sub>))</li>
              <li>Initial reaction rate and estimated half-life</li>
              <li>Editable initial concentrations (defaults: reactants from stoichiometry, products at zero)</li>
            </ul>
            <p className="mt-2">
              <strong>Equilibrium-constrained kinetics:</strong> If both kinetics and equilibrium data
              are present, the integrator automatically includes the reverse reaction
              (k<sub>rev</sub> = k<sub>fwd</sub>/K<sub>eq</sub>), so concentrations approach
              equilibrium and stop changing — matching real physical behaviour.
            </p>
          </section>

          {/* Equilibrium */}
          <section id="help-equilibrium">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Equilibrium</h3>
            <p>
              Enable the <strong>Equilibrium data</strong> checkbox to specify:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong>K<sub>eq</sub></strong> — Equilibrium constant at reference temperature</li>
              <li><strong>T<sub>ref</sub></strong> — Reference temperature (K)</li>
              <li><strong>&#916;H</strong> — Reaction enthalpy (kJ/mol) for van&rsquo;t Hoff temperature dependence</li>
            </ul>
            <p className="mt-2">
              The <strong>Equilibrium tab</strong> in results provides:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong>ICE Table</strong> — Initial/Change/Equilibrium concentrations for all species</li>
              <li>K<sub>eq</sub>(T) via van&rsquo;t Hoff: ln(K(T)/K(T<sub>ref</sub>)) = &minus;(&#916;H/R)(1/T &minus; 1/T<sub>ref</sub>)</li>
              <li>Reaction quotient Q and direction of shift (forward/reverse/at equilibrium)</li>
              <li><strong>Le Chatelier analysis</strong> — Qualitative predictions for temperature, pressure, and concentration changes</li>
            </ul>
          </section>

          {/* Selectivity */}
          <section id="help-selectivity">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Selectivity &amp; Competing Reactions</h3>
            <p>
              The <strong>Selectivity tab</strong> lets you define competing reaction sets — where
              a shared reactant splits between a desired reaction and undesired side reactions:
            </p>
            <ol className="list-decimal list-inside space-y-2 mt-2">
              <li>Click <strong>Define Competing Reaction Set</strong></li>
              <li>Select the shared reactant formula</li>
              <li>Designate one reaction as the primary (desired) pathway</li>
              <li>Select one or more competing (undesired) reactions</li>
              <li>Adjust allocation sliders to set what fraction of the shared reactant goes to each pathway</li>
            </ol>
            <p className="mt-2">
              Results show:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong>Selectivity</strong> — moles of desired product / total product moles</li>
              <li><strong>Yield</strong> — moles of desired product / moles of reactant fed</li>
              <li><strong>Atom economy</strong> — molecular weight efficiency of the desired pathway</li>
              <li><strong>Named co-products</strong> — each undesired product shown with its name, formula, quantity, and which side reaction produced it</li>
            </ul>
          </section>

          {/* Results Tabs */}
          <section id="help-results">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Results Tabs</h3>
            <p>After calculating, up to eight tabs appear (Advanced mode shows all; Basic mode shows five):</p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li>
                <strong>Per Reaction</strong> — Quantities for each individual reaction (moles, grams,
                kg, lb, liters, gallons).
              </li>
              <li>
                <strong>System Totals</strong> — Overall balanced equation for the entire system, plus
                a detailed mass balance and a <strong>Balance Check</strong> panel showing atom-level
                and mass-level conservation. Substances are classified as:
                <ul className="list-none ml-6 mt-1 space-y-0.5">
                  <li><span className="text-blue-700 font-medium">Feedstock</span> — net inputs consumed by the system</li>
                  <li><span className="text-green-700 font-medium">Product</span> — net outputs produced</li>
                  <li><span className="text-gray-500 font-medium">Intermediate</span> — produced and fully consumed internally</li>
                  <li><span className="text-amber-700 font-medium">Excess</span> — produced more than consumed (byproduct)</li>
                  <li><span className="text-red-700 font-medium">Deficit</span> — consumed more than produced (additional input needed)</li>
                </ul>
              </li>
              <li>
                <strong>Properties</strong> — Physical properties for each substance: molecular weight,
                density, Higher Heating Value (HHV), and Lower Heating Value (LHV). Each value has its
                own unit selector.
              </li>
              <li>
                <strong>Thermodynamics</strong> — Enthalpy of reaction (&#916;H) for each reaction and the
                full system, with exothermic/endothermic classification. Toggle between kJ and BTU.
              </li>
              <li>
                <strong>Kinetics</strong> <span className="text-xs text-gray-400">(Advanced)</span> — Concentration-vs-time
                charts, rate constants at temperature, half-lives.
              </li>
              <li>
                <strong>Equilibrium</strong> <span className="text-xs text-gray-400">(Advanced)</span> — ICE tables,
                equilibrium concentrations, Le Chatelier analysis.
              </li>
              <li>
                <strong>Selectivity</strong> <span className="text-xs text-gray-400">(Advanced)</span> — Competing reaction
                allocation, selectivity/yield/atom economy metrics with named co-products.
              </li>
              <li>
                <strong>Economics</strong> — Enter prices for feedstocks and products at the system
                boundary. The summary shows total feedstock cost, product/excess value, and net delta.
              </li>
            </ul>
          </section>

          {/* Saving Sessions */}
          <section id="help-sessions">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Saving &amp; Loading Sessions</h3>
            <p>
              The <strong>Saved Sessions</strong> panel (top of the page) lets you persist your work
              in the browser:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong>Save</strong> (teal) — Save the current state to the browser with a name. If a session is already loaded, overwrites it.</li>
              <li><strong>Save to File</strong> (blue) — Save to the browser AND download as a <code>.stoich.json</code> file.
                On Chrome/Edge, a Save As dialog lets you choose the folder and filename.
                On Safari/Firefox, the file goes to your default downloads folder.</li>
              <li><strong>Load</strong> — Restore a previously saved session including all reactions, links, results, input values, and economics prices.</li>
              <li><strong>Export</strong> — Download an existing saved session as a <code>.stoich.json</code> file to share with others or transfer to another browser/device.</li>
              <li><strong>Import</strong> — Load a <code>.stoich.json</code> file from disk into your saved sessions.</li>
              <li><strong>Delete</strong> — Remove a saved session.</li>
            </ul>
            <p className="mt-2 text-xs text-gray-500">
              Sessions are stored in your browser&rsquo;s local storage. They persist across page
              refreshes but are specific to this browser and device. Use Save to File/Export/Import
              to share sessions between users or move them between devices.
            </p>
          </section>

          {/* Downloads */}
          <section id="help-downloads">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Downloading Results</h3>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Download CSV</strong> buttons on individual tables export that section.</li>
              <li><strong>Download Full System Report (CSV)</strong> exports all reactions, totals, thermodynamics, economics, and links.</li>
              <li><strong>Download PNG</strong> on the System Summary panel exports the overall equation as an image.</li>
            </ul>
          </section>

          {/* Supported Units */}
          <section id="help-units">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Supported Units</h3>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Mass</p>
                <p>Grams, Kilograms, Pounds, Short Tons (US), Metric Tonnes</p>
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
                <p className="text-xs font-medium text-gray-500 uppercase">Density (std conditions)</p>
                <p>kg/L, lb/ft&#179;, lb/L, lb/gal (liquids)</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Heating Values</p>
                <p>BTU/lb, MJ/kg, BTU/gal (liquids), MJ/L (liquids)</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs font-medium text-gray-500 uppercase">Pricing</p>
                <p>$/mol, $/g, $/kg, $/lb, $/ton, $/tonne, $/L, $/gal (liquids), $/MMBTU (methane)</p>
              </div>
            </div>
          </section>

          {/* Reaction Network Graph */}
          <section id="help-network">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Reaction Network Graph</h3>
            <p>
              When you have two or more reactions, a collapsible <strong>Reaction Network</strong>
              section appears showing an interactive flow diagram:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong>Blue ovals</strong> (top) — feedstocks entering the system.</li>
              <li><strong>Teal rectangles</strong> (middle) — reactions, with equations and optional custom names.</li>
              <li><strong>Green ovals</strong> (bottom) — products and coproducts leaving the system.</li>
              <li><strong>Purple arrows</strong> — linked substance flows between reactions (with formula and fraction).</li>
              <li>Nodes can be <strong>dragged</strong> to rearrange the layout. Use zoom and pan controls.</li>
              <li><strong>Download PNG</strong> button exports the network as an image.</li>
            </ul>
          </section>

          {/* Topology Validation */}
          <section id="help-topology">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Topology Validation</h3>
            <p>
              The app automatically checks your reaction system for common issues and displays
              warnings above the network graph:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Unlinked products that match reactants in other reactions (missing links).</li>
              <li>Mismatched formulas in links (product formula &#8800; reactant formula).</li>
              <li>Split fractions exceeding 100% for the same product.</li>
              <li>Circular dependencies (cycles) in the reaction chain.</li>
              <li>Disconnected reactions with no links.</li>
            </ul>
          </section>

          {/* Naming Reactions */}
          <section id="help-naming">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Naming Reactions</h3>
            <p>
              Click the pencil icon (&#9998;) on any reaction card to give it a custom name
              (e.g., &ldquo;Boudouard Reaction&rdquo;, &ldquo;Haber Process&rdquo;). The name
              appears as &ldquo;Reaction 2 &#8212; Haber Process&rdquo; throughout the app,
              including in the network graph. This is optional &#8212; leave blank to keep the
              default numbering.
            </p>
          </section>

          {/* Tips */}
          <section id="help-tips">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Tips</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Use the <strong>+ insert</strong> buttons between reaction cards to add a reaction at a specific position in the sequence.</li>
              <li>Be specific in reaction descriptions — include reactant and product names.</li>
              <li>If the AI returns an unbalanced equation, use the <strong>Stoichiometry Editor</strong> (flask icon) to fix it without re-parsing.</li>
              <li>In the <strong>Balance Coefficients</strong> mode, lock the coefficients you&rsquo;re sure of and let the solver compute the rest.</li>
              <li>Use the fraction field in series links to model partial conversions or splits.</li>
              <li>The link editor auto-matches product and reactant formulas and shows a green/amber indicator.</li>
              <li>Check the System Totals tab for the <strong>Balance Check</strong> panel to verify mass and atom conservation.</li>
              <li>Save your work frequently — the AI parsing costs API credits each time.</li>
              <li><strong>Literature lookup</strong> results (parameters, notes, references) are saved with sessions — no need to re-search after loading.</li>
              <li><strong>Toggling</strong> kinetics or equilibrium checkboxes off and on preserves your data — no values are lost.</li>
              <li>When both <strong>kinetics and equilibrium</strong> data are present, the kinetics integration automatically includes the reverse reaction for physically correct behaviour.</li>
              <li>Use the <strong>conversion slider</strong> for quick what-if analysis without needing full kinetics parameters.</li>
              <li>The <strong>initial concentrations</strong> in the Kinetics tab are editable — adjust them to model different feed compositions.</li>
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
