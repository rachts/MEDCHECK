import React, { useMemo } from 'react';
import { useMedicine } from '../context/MedicineContext';
import { NetworkIcon } from '../pages/landing-icons';

function InteractionNetworkGraphBase() {
  const { medicines, results, selectMedicine, selectedMedicineName } = useMedicine();

  // Compute node coordinates arranged in a harmonic ring
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

      let strokeColor = '#2d4a22'; // Safe / low
      let strokeWidth = 1.75;
      let strokeDash = 'none';

      if (interaction.severity === 'high') {
        strokeColor = '#8b2500'; // Critical crimson/terracotta
        strokeWidth = 2.5;
      } else if (interaction.severity === 'moderate') {
        strokeColor = '#8a5300'; // Caution mineral amber
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
    <div className="ed-sheet p-5 flex flex-col items-center">
      {/* Header bar */}
      <div className="w-full flex items-center justify-between gap-2 pb-3 mb-3 border-b border-[#d5cfc0]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 border border-[#1a1a18] bg-[#f8f6f0] text-[#1a1a18] flex items-center justify-center shrink-0">
            <NetworkIcon size={15} />
          </div>
          <div>
            <h3 className="font-newsreader text-[17px] font-semibold text-[#1a1a18] leading-tight">
              Interaction Network Web
            </h3>
            <p className="font-ibm-mono text-[10px] uppercase tracking-[0.06em] text-[#57534a] mt-0.5">
              Topology map · Click any node to open profile
            </p>
          </div>
        </div>

        {/* Mineral Severity Legend */}
        <div className="hidden sm:flex items-center gap-2">
          <span className="ed-tag ed-tag-crit">High</span>
          <span className="ed-tag ed-tag-caut">Moderate</span>
          <span className="ed-tag ed-tag-safe">Low</span>
        </div>
      </div>

      {/* Square Flat SVG Canvas */}
      <div className="w-full max-w-[580px] h-[280px] relative bg-[#f8f6f0] border border-[#d5cfc0]">
        <svg className="w-full h-full" viewBox="0 0 580 280" role="img" aria-label="Medicine interaction topology map">
          {/* Connecting Interaction Links */}
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
              strokeLinecap="square"
            />
          ))}

          {/* Medicine Nodes (Square Architectural Frames) */}
          {Object.entries(nodePositions).map(([key, node]) => {
            const isSelected = selectedMedicineName?.toLowerCase() === key;
            const hasCritical = links.some(
              (l) => (l.posA.med.name.toLowerCase() === key || l.posB.med.name.toLowerCase() === key) && l.interaction.severity === 'high'
            );

            let nodeFill = '#f8f6f0';
            let nodeStroke = '#1a1a18';
            let iconColor = '#1a1a18';

            if (isSelected) {
              nodeFill = '#1a1a18';
              nodeStroke = '#1a1a18';
              iconColor = '#f8f6f0';
            } else if (hasCritical) {
              nodeFill = '#f3e9e4';
              nodeStroke = '#8b2500';
              iconColor = '#8b2500';
            }

            return (
              <g
                key={key}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => selectMedicine(node.med.name)}
                className={`cursor-pointer ed-graph-node ${isSelected ? 'selected' : ''}`}
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
                {/* Sharp Rectangular Node Frame */}
                <rect
                  className="ed-node-frame"
                  x={-16}
                  y={-16}
                  width={32}
                  height={32}
                  fill={nodeFill}
                  stroke={nodeStroke}
                  strokeWidth={isSelected ? 2 : 1.5}
                />

                {/* Geometric Angular Pill Mark */}
                <g
                  fill="none"
                  stroke={iconColor}
                  strokeWidth={1.4}
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                  aria-hidden="true"
                >
                  <polygon points="3,-7 7,-3 -3,7 -7,3" />
                  <line x1={-2} y1={-2} x2={2} y2={2} />
                </g>

                {/* Medicine Name Label */}
                <text
                  y={31}
                  textAnchor="middle"
                  style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '0.04em' }}
                  fill={hasCritical && !isSelected ? '#8b2500' : '#1a1a18'}
                  fontWeight={isSelected || hasCritical ? '600' : '500'}
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

export const InteractionNetworkGraph = React.memo(InteractionNetworkGraphBase);
export default InteractionNetworkGraph;
