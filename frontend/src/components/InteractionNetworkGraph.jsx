import React, { useMemo, useState } from 'react';
import { useMedicine } from '../context/MedicineContext';
import { Pill, Activity } from 'lucide-react';

export function InteractionNetworkGraph() {
  const { medicines, results, selectMedicine, selectedMedicineName } = useMedicine();
  const [hoveredNode, setHoveredNode] = useState(null);

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

            if (isSelected) {
              nodeFill = '#0F172A';
              nodeStroke = '#0F172A';
            } else if (hasCritical) {
              nodeStroke = '#DC2626';
            }

            return (
              <g
                key={key}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => selectMedicine(node.med.name)}
                onMouseEnter={() => setHoveredNode(key)}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer group"
              >
                {/* Base Node Circle */}
                <circle
                  r={16}
                  fill={nodeFill}
                  stroke={nodeStroke}
                  strokeWidth={isSelected ? 2 : 1.5}
                  className="transition-transform duration-150 group-hover:scale-105"
                />

                {/* Icon inside node */}
                <foreignObject x={-7} y={-7} width={14} height={14} className="pointer-events-none">
                  <div className={`w-full h-full flex items-center justify-center ${isSelected ? 'text-white' : 'text-[var(--text-muted)] group-hover:text-[var(--text-primary)]'}`}>
                    <Pill className="w-3 h-3" />
                  </div>
                </foreignObject>

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
