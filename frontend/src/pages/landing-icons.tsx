import type { SVGProps } from 'react';

export interface LandingIconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

const DEFAULT_SVG_PROPS: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'square',
  strokeLinejoin: 'miter',
};

/** Geometric shield with an embedded medical cross for brand and safety marks. */
export function ShieldCrossIcon({ size = 20, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <path d="M4 3h16v9c0 5-3.6 8.1-8 9.5C7.6 20.1 4 17 4 12V3z" />
      <path d="M12 7.5v7" />
      <path d="M8.5 11h7" />
    </svg>
  );
}

/** Open-outline shield icon for protection and Stomach Guardian references. */
export function ShieldIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <path d="M4.5 3.5h15v8.5c0 4.5-3.2 7.4-7.5 8.8-4.3-1.4-7.5-4.3-7.5-8.8V3.5z" />
      <path d="M8 7.5h8" />
    </svg>
  );
}

/** Framed geometric medical cross for clinical hazard and dosage markers. */
export function MedicalCrossIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <rect x="3" y="3" width="18" height="18" />
      <path d="M12 7v10" />
      <path d="M7 12h10" />
    </svg>
  );
}

/** Ruled document sheet icon representing OpenFDA monographs and doctor reports. */
export function DocumentIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <path d="M5 3h10l4 4v14H5V3z" />
      <path d="M15 3v4h4" />
      <path d="M8 11h8" />
      <path d="M8 14.5h8" />
      <path d="M8 18h5" />
    </svg>
  );
}

/** Angular geometric pill capsule icon for drug and alias resolution entries. */
export function PillIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <path d="M14.5 4.5l5 5-9.5 9.5-5-5 9.5-9.5z" />
      <path d="M9.75 9.25l5 5" />
    </svg>
  );
}

/** Geometric octagonal clock face for 24-hour dose and meal timing schedules. */
export function ClockIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <polygon points="8,3 16,3 21,8 21,16 16,21 8,21 3,16 3,8" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

/** Open reference book icon for pharmacology index and label citations. */
export function BookIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <path d="M3 4.5h7.5l1.5 1.5v13.5l-1.5-1H3V4.5z" />
      <path d="M21 4.5h-7.5L12 6v13.5l1.5-1H21V4.5z" />
      <path d="M5.5 9h4" />
      <path d="M14.5 9h4" />
    </svg>
  );
}

/** Precision clinical balance scale icon for severity ranking and risk weighting. */
export function BalanceIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <path d="M12 3v17" />
      <path d="M7 20h10" />
      <path d="M4.5 7h15" />
      <path d="M4.5 7l-2 6h4l-2-6z" />
      <path d="M19.5 7l-2 6h4l-2-6z" />
    </svg>
  );
}

/** Geometric octagonal magnifying lens for catalog and basket search. */
export function SearchIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <polygon points="7.5,3.5 13.5,3.5 16.5,6.5 16.5,12.5 13.5,15.5 7.5,15.5 4.5,12.5 4.5,6.5" />
      <path d="M15 14l5.5 5.5" />
    </svg>
  );
}

/** Architectural apothecary basket and medicine case icon. */
export function BasketIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <rect x="3" y="8" width="18" height="12" />
      <path d="M8 8V5h8v3" />
      <path d="M12 11.5v5" />
      <path d="M9.5 14h5" />
    </svg>
  );
}

/** Sharp triangular warning mark for clinical risk alerts and partial-data flags. */
export function WarningIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <polygon points="12,3 22,20 2,20" />
      <path d="M12 9.5v5" />
      <path d="M12 17.2v0.4" />
    </svg>
  );
}

/** Geometric fork and knife emblem for meal and administration guidance. */
export function FoodIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <path d="M6 3.5v6" />
      <path d="M10 3.5v6" />
      <path d="M6 9.5h4" />
      <path d="M8 3.5v17" />
      <path d="M15 3.5h2.5v9H15v8" />
    </svg>
  );
}

/** Geometric chalice with diagonal bar indicating alcohol avoidance. */
export function AlcoholIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <path d="M6.5 4h11v4l-5.5 5-5.5-5V4z" />
      <path d="M12 13v7.5" />
      <path d="M8 20.5h8" />
      <path d="M4 4l16 16" />
    </svg>
  );
}

/** Stepped printer silhouette for Doctor's Report printing. */
export function PrinterIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <path d="M6.5 8.5V3.5h11v5" />
      <rect x="3" y="8.5" width="18" height="8" />
      <path d="M6.5 14h11v6.5h-11V14z" />
      <path d="M16.5 11.5h1" />
    </svg>
  );
}

/** Downward arrow into flat tray for report or dossier export. */
export function DownloadIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <path d="M12 3.5v11.5" />
      <path d="M7.5 10.5L12 15l4.5-4.5" />
      <path d="M4 16.5v4h16v-4" />
    </svg>
  );
}

/** Two stacked document sheets for copying brief text. */
export function CopyIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <rect x="8.5" y="7.5" width="11.5" height="13" />
      <path d="M15.5 7.5V4h-11v13h4" />
    </svg>
  );
}

/** Crisp geometric cross mark for closing modals and removing basket chips. */
export function CloseIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <path d="M5.5 5.5l13 13" />
      <path d="M18.5 5.5l-13 13" />
    </svg>
  );
}

/** Sharp geometric plus sign for adding medicines. */
export function PlusIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <path d="M12 4.5v15" />
      <path d="M4.5 12h15" />
    </svg>
  );
}

/** Geometric clear/remove bin icon for clearing the medicine basket. */
export function RemoveIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <path d="M4 6.5h16" />
      <path d="M9 6.5V4h6v2.5" />
      <path d="M6.5 6.5l1 13.5h9l1-13.5" />
      <path d="M10.2 10.5v6" />
      <path d="M13.8 10.5v6" />
    </svg>
  );
}

/** Horizontal arrow with mitered arrowhead for navigation and actions. */
export function ArrowRightIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <path d="M4 12h15.5" />
      <path d="M14 6.5l5.5 5.5-5.5 5.5" />
    </svg>
  );
}

/** Framed diagonal arrow for external FDA label references. */
export function ExternalLinkIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <path d="M14 4h6v6" />
      <path d="M11 13l9-9" />
      <path d="M19 14v6H4V5h6" />
    </svg>
  );
}

/** Mitered downward chevron for collapsible sections and menus. */
export function ChevronDownIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** Mitered upward chevron for collapsible sections. */
export function ChevronUpIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <path d="M6 15l6-6 6 6" />
    </svg>
  );
}

/** Sharp geometric check mark for verified states and comparisons. */
export function CheckIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <path d="M4.5 12.5l5 5 10-10.5" />
    </svg>
  );
}

/** Square-framed informational marker. */
export function InfoIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" />
      <path d="M12 10.5v6" />
      <path d="M12 7.5v0.4" />
    </svg>
  );
}

/** Geometric account profile emblem. */
export function UserIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <rect x="8" y="3.5" width="8" height="8" />
      <path d="M4.5 20.5l2-5.5h11l2 5.5" />
    </svg>
  );
}

/** Three crisp horizontal rules for mobile navigation menu toggle. */
export function MenuIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <path d="M4 6.5h16" />
      <path d="M4 12h16" />
      <path d="M4 17.5h16" />
    </svg>
  );
}

/** Geometric three-node interaction graph emblem. */
export function NetworkIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <rect x="9.5" y="3" width="5" height="5" />
      <rect x="3" y="16" width="5" height="5" />
      <rect x="16" y="16" width="5" height="5" />
      <path d="M10.5 8L6.5 16" />
      <path d="M13.5 8l4 8" />
      <path d="M8 18.5h8" />
    </svg>
  );
}

/** Stacked ledger sheets emblem for medicine profile tabs and views. */
export function LayersIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <rect x="4" y="4" width="13" height="13" />
      <path d="M17 7h3v13H7v-3" />
      <path d="M7.5 8.5h6" />
      <path d="M7.5 12h4" />
    </svg>
  );
}

/** Rectangular retry loop arrow for paused analysis recovery. */
export function RefreshIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <path d="M19.5 5.5H6.5v5.5" />
      <path d="M16 3l3.5 2.5-3.5 2.5" />
      <path d="M4.5 18.5h13V13" />
      <path d="M8 16l-3.5 2.5L8 21" />
    </svg>
  );
}

/** Square editorial dialogue ledger icon for the Medicine Assistant. */
export function MessageIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <path d="M3.5 4h17v12h-9.5L6.5 20v-4H3.5V4z" />
      <path d="M7.5 8.5h9" />
      <path d="M7.5 11.8h6" />
    </svg>
  );
}

/** Geometric rectangular padlock for account credential fields. */
export function LockIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <rect x="4.5" y="10.5" width="15" height="10" />
      <path d="M8 10.5V6.5l2-2h4l2 2v4" />
      <path d="M12 14.5v2.5" />
    </svg>
  );
}

/** Geometric envelope mark for optional email registration fields. */
export function MailIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <rect x="3.5" y="5" width="17" height="14" />
      <path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
    </svg>
  );
}

/** Geometric sign-out frame and outward arrow for session termination. */
export function LogOutIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <path d="M11 4H4.5v16H11" />
      <path d="M9.5 12h10" />
      <path d="M15.5 8l4 4-4 4" />
    </svg>
  );
}

/** Horizontal left-pointing arrow with mitered arrowhead for back navigation. */
export function ArrowLeftIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <path d="M20 12H4.5" />
      <path d="M10 6.5L4.5 12 10 17.5" />
    </svg>
  );
}

/** Sharp-cornered architectural house icon for home route navigation. */
export function HomeIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <path d="M3.5 10.5L12 3.5l8.5 7v10h-17v-10z" />
      <path d="M9.5 20.5v-6.5h5v6.5" />
    </svg>
  );
}

/** Geometric octagonal compass rose emblem for route-not-found markers. */
export function CompassIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <polygon points="8,3 16,3 21,8 21,16 16,21 8,21 3,16 3,8" />
      <polygon points="15.5,8.5 13.5,13.5 8.5,15.5 10.5,10.5" />
    </svg>
  );
}

/** Sharp geometric ECG pulse trace for clinical reaction and activity panels. */
export function PulseIcon({ size = 18, ...props }: LandingIconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" {...DEFAULT_SVG_PROPS} {...props}>
      <path d="M2.5 12h4l2.5-6.5 4.5 13 2.5-6.5h5.5" />
    </svg>
  );
}
