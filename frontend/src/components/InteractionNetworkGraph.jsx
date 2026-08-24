import React, { useMemo } from 'react';
import { useMedicine } from '../context/MedicineContext';
import { Activity } from 'lucide-react';

function InteractionNetworkGraphBase() {
  const { medicines, results, selectMedicine, selectedMedicineName } = useMedicine();

  // Compute node coordinates arranged in a harmonic circle
  const nodePositions = useMemo(() => {
    const count = medicines.length;
    if (count === 0) return {};

    const width = 580;
    const height = 280;
    const centerX = width / 2;
    const centerY = height / 2;
    const radiusX = Math.min(centerX - 60, 190);
    const radiusY = Math.min(centerY - 50, 95);

    const positions = {};
    medicines.forEach((med, index) => {
      const angle = (index / count) * 2 * Math.PI - Math.PI / 2;
      positions[med.name.toLowerCase()] = {
        x: centerX + radiusX * Math.cos(angle),
        y: centerY + radiusY * Math.sin(angle),
        med,
      };
    });
    return positions;
  }, [medicines]);

  // Compute link paths between interacting pairs
  const links = useMemo(() => {
    if (!results || !results.interactions) return [];
    return results.interactions.map((interaction, idx) => {
      const posA = nodePositions[interaction.drug_a.toLowerCase()];
      const posB = nodePositions[interaction.drug_b.toLowerCase()];
      if (!posA || !posB) return null;

      let strokeColor = '#059669'; // Low
      let strokeWidth = 2;
      let strokeDash = 'none';

      if (interaction.severity === 'high') {
        strokeColor = '#DC2626'; // Danger
        strokeWidth = 2.5;
      } else if (interaction.severity === 'moderate') {
        strokeColor = '#D97706'; // Warning
        strokeWidth = 2;
        strokeDash = '4 4';
      }

      return {
        id: `link-${idx}`,
        posA,
        posB,
        interaction,
        strokeColor,
        strokeWidth,
        strokeDash,
      };
    }).filter(Boolean);
  }, [results, nodePositions]);

  if (medicines.length < 2) {
    return null;
  }

  return (
    <div className="card flex flex-col items-center">
      {/* Header bar */}
      <div className="w-full flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-[4px] bg-[var(--accent)] text-[var(--text-inverse)] flex items-center justify-center">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Interaction Network Web
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Topology map • Click any node to open profile
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="hidden sm:flex items-center gap-3">
          <div className="badge badge-high">Critical</div>
          <div className="badge badge-moderate">Moderate</div>
          <div className="badge badge-low">Safe</div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="w-full max-w-[580px] h-[280px] relative">
        <svg className="w-full h-full" viewBox="0 0 580 280">
          {/* Render Connecting Interaction Links */}
          {links.map((link) => (
            <line
              key={link.id}
              x1={link.posA.x}
              y1={link.posA.y}
              x2={link.posB.x}
              y2={link.posB.y}
              stroke={link.strokeColor}
              strokeWidth={link.strokeWidth}
              strokeDasharray={link.strokeDash}
              strokeLinecap="round"
            />
          ))}

          {/* Render Medicine Nodes */}
          {Object.entries(nodePositions).map(([key, node]) => {
            const isSelected = selectedMedicineName?.toLowerCase() === key;
            const hasCritical = links.some(
              (l) => (l.posA.med.name.toLowerCase() === key || l.posB.med.name.toLowerCase() === key) && l.interaction.severity === 'high'
            );

            let nodeFill = '#F8FAFC';
            let nodeStroke = '#CBD5E1';
            // Literal colours, matching nodeFill/nodeStroke above: an SVG `stroke`
            // attribute cannot resolve a Tailwind text-colour class, which is what
            // the removed foreignObject relied on.
            let iconColor = '#64748B';

            if (isSelected) {
              nodeFill = '#0F172A';
              nodeStroke = '#0F172A';
              iconColor = '#FFFFFF';
            } else if (hasCritical) {
              nodeStroke = '#DC2626';
              iconColor = '#DC2626';
            }

            return (
              <g
                key={key}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => selectMedicine(node.med.name)}
                // The former onMouseEnter/onMouseLeave fed a `hoveredNode` state
                // that nothing read, so every pointer movement across the graph
                // re-rendered all nodes and links to no visible effect. The hover
                // emphasis comes from the `group-hover:` class on the circle below,
                // which is pure CSS and needs no state.
                className="cursor-pointer group"
                role="button"
                tabIndex={0}
                aria-label={`View profile for ${node.med.name}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectMedicine(node.med.name);
                  }
                }}
              >
                {/* Base Node Circle */}
                <circle
                  r={16}
                  fill={nodeFill}
                  stroke={nodeStroke}
                  strokeWidth={isSelected ? 2 : 1.5}
                  className="transition-transform duration-150 group-hover:scale-105"
                />

                {/* Pill glyph, drawn as native SVG.
                    This was a <foreignObject> wrapping the lucide <Pill> React
                    component. foreignObject embeds an HTML subtree inside SVG and
                    is unreliable in exactly the browsers this app targets on
                    mobile: WebKit mis-positions or drops the content depending on
                    transform and scaling context, so the node could render as a
                    bare circle. Native <rect>/<line> primitives are painted by the
                    same SVG code path as everything else here and are inert to
                    pointer events without needing a pointer-events override.

                    Geometry: a 12x6 capsule rotated 45deg about the node centre,
                    with a divider across its short axis -- the standard pill
                    silhouette, matching the 14x14 box the icon previously used. */}
                <g
                  transform="rotate(-45)"
                  fill="none"
                  stroke={iconColor}
                  strokeWidth={1.4}
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <rect x={-6} y={-3} width={12} height={6} rx={3} ry={3} />
                  <line x1={0} y1={-3} x2={0} y2={3} />
                </g>

                {/* Medicine Name Label */}
                <text
                  y={28}
                  textAnchor="middle"
                  className={`text-xs font-semibold transition-colors ${
                    isSelected ? 'fill-[var(--text-primary)] font-bold' : hasCritical ? 'fill-[var(--severity-high)]' : 'fill-[var(--text-primary)]'
                  }`}
                >
                  {node.med.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// Memoised: this is the heaviest render on the analysis screen -- an SVG whose node
// positions, link paths and per-node severity colours are all recomputed from the
// basket and the results. It takes no props, so with the context value memoised it
// now re-renders only when the basket or the analysis actually changes, rather than
// on every mobile-tab switch and modal toggle in AppInterface.
export const InteractionNetworkGraph = React.memo(InteractionNetworkGraphBase);
