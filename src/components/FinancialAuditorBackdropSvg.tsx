import React from 'react';

interface FinancialAuditorBackdropSvgProps {
  className?: string;
}

export const FinancialAuditorBackdropSvg: React.FC<FinancialAuditorBackdropSvgProps> = ({
  className = '',
}) => {
  return (
    <svg
      viewBox="0 0 280 230"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <defs>
        <radialGradient id="auditor-emerald-aura" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#10B981" stopOpacity="0.22" />
          <stop offset="65%" stopColor="#34D399" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="auditor-orange-aura" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F97316" stopOpacity="0.20" />
          <stop offset="70%" stopColor="#FB923C" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="auditor-suit-grad" x1="100" y1="90" x2="180" y2="180" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#047857" />
          <stop offset="100%" stopColor="#065F46" />
        </linearGradient>
        <linearGradient id="auditor-desk-grad" x1="18" y1="176" x2="264" y2="196" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#ECFDF5" />
        </linearGradient>
        <linearGradient id="auditor-badge-grad" x1="62" y1="92" x2="96" y2="126" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FB923C" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
      </defs>

      {/* Soft Institutional Ambient Halos */}
      <circle cx="144" cy="116" r="96" fill="url(#auditor-emerald-aura)" />
      <circle cx="72" cy="94" r="54" fill="url(#auditor-orange-aura)" />

      {/* Subtle Architectural Trust Arc & Nodes */}
      <path
        d="M52 72C72 34 114 18 156 22C196 26 226 50 242 86"
        stroke="#059669"
        strokeOpacity="0.2"
        strokeWidth="1.5"
        strokeDasharray="4 4"
        strokeLinecap="round"
      />
      <circle cx="196" cy="34" r="3.5" fill="#F97316" fillOpacity="0.45" />
      <circle cx="242" cy="86" r="3" fill="#10B981" fillOpacity="0.45" />
      <circle cx="48" cy="140" r="2.5" fill="#059669" fillOpacity="0.35" />

      {/* Floating Audited Invoice / Financial Statement Document */}
      <g opacity="0.96">
        <rect
          x="26"
          y="42"
          width="58"
          height="74"
          rx="8"
          fill="#FFFFFF"
          stroke="#A7F3D0"
          strokeWidth="1.6"
        />
        {/* Document Header Bar */}
        <rect x="34" y="51" width="42" height="7" rx="3.5" fill="#10B981" fillOpacity="0.88" />
        {/* Document Income & Expense Rows */}
        <rect x="34" y="65" width="26" height="4" rx="2" fill="#CBD5E1" />
        <rect x="64" y="65" width="12" height="4" rx="2" fill="#10B981" fillOpacity="0.7" />
        <rect x="34" y="75" width="22" height="4" rx="2" fill="#CBD5E1" />
        <rect x="60" y="75" width="16" height="4" rx="2" fill="#FB923C" fillOpacity="0.85" />
        <rect x="34" y="85" width="28" height="4" rx="2" fill="#CBD5E1" />
        <rect x="66" y="85" width="10" height="4" rx="2" fill="#10B981" fillOpacity="0.7" />
        <rect x="34" y="95" width="19" height="4" rx="2" fill="#E2E8F0" />
        <line x1="34" y1="104" x2="76" y2="104" stroke="#E2E8F0" strokeWidth="1.2" />
      </g>

      {/* Magnifying Glass / Financial Audit Seal Over Document */}
      <g>
        <path
          d="M89 119L100 130"
          stroke="#EA580C"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <circle
          cx="78"
          cy="108"
          r="16"
          fill="#FFFFFF"
          stroke="url(#auditor-badge-grad)"
          strokeWidth="3.2"
        />
        <circle cx="78" cy="108" r="11.5" fill="#ECFDF5" />
        <path
          d="M72.5 108.5L76.3 112.2L84 104.2"
          stroke="#059669"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* Office Chair Backrest */}
      <rect
        x="110"
        y="80"
        width="64"
        height="72"
        rx="18"
        fill="#E2E8F0"
        fillOpacity="0.7"
        stroke="#CBD5E1"
        strokeWidth="1.5"
      />

      {/* Auditor Figure Sitting Behind Desk */}
      <g>
        {/* Neck & Collar */}
        <rect x="134" y="79" width="16" height="14" rx="6" fill="#E8B896" />
        {/* Hair Back */}
        <path
          d="M120 62C120 45 129 36 142 36C155 36 164 45 164 62C164 67 161 70 158 70H126C123 70 120 67 120 62Z"
          fill="#1E293B"
        />
        {/* Head */}
        <circle cx="142" cy="61" r="18" fill="#F3C6A5" />
        {/* Hair Front Wave */}
        <path
          d="M124 57C126 44 134 39 144 39C154 39 160 46 160 56C155 51 148 49 140 50C133 51 128 53 124 57Z"
          fill="#0F172A"
        />
        {/* Analytical Glasses */}
        <rect x="129" y="57" width="11" height="7.5" rx="3" fill="#FFFFFF" fillOpacity="0.45" stroke="#1E293B" strokeWidth="1.5" />
        <rect x="144" y="57" width="11" height="7.5" rx="3" fill="#FFFFFF" fillOpacity="0.45" stroke="#1E293B" strokeWidth="1.5" />
        <line x1="140" y1="60.5" x2="144" y2="60.5" stroke="#1E293B" strokeWidth="1.5" />

        {/* Jacket Torso */}
        <path
          d="M96 176C97 126 112 94 142 94C172 94 187 126 188 176H96Z"
          fill="url(#auditor-suit-grad)"
        />
        {/* Crisp White Shirt V-Collar */}
        <path d="M131 94L142 126L153 94H131Z" fill="#FFFFFF" />
        {/* Warm Orange Institutional Tie */}
        <path d="M140 99L144 99L145.5 117L142 124L138.5 117L140 99Z" fill="#F97316" />
        {/* Suit Lapel Lines */}
        <path d="M131 94L125 115L142 128" stroke="#064E3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M153 94L159 115L142 128" stroke="#064E3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Left Arm Reaching to Ledger with Audit Pen */}
        <path
          d="M107 116C94 126 88 142 98 152L115 157"
          stroke="#047857"
          strokeWidth="15"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="116" cy="157" r="6.5" fill="#F3C6A5" />
        {/* Pen Held by Auditor */}
        <path d="M119 152L104 164" stroke="#EA580C" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M104 164L100.5 167" stroke="#0F172A" strokeWidth="1.8" strokeLinecap="round" />

        {/* Right Arm Reaching to Calculator */}
        <path
          d="M177 116C190 126 196 141 188 151L176 156"
          stroke="#065F46"
          strokeWidth="15"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="176" cy="156" r="6.5" fill="#F3C6A5" />
      </g>

      {/* Stacked Financial Folders & Accounting Binders on Desk Right */}
      <g>
        <rect x="214" y="160" width="46" height="16" rx="3.5" fill="#059669" />
        <rect x="220" y="165" width="18" height="6" rx="2" fill="#FFFFFF" fillOpacity="0.9" />
        <rect x="218" y="145" width="40" height="15" rx="3.5" fill="#F97316" />
        <rect x="224" y="150" width="16" height="5" rx="1.5" fill="#FFFFFF" fillOpacity="0.92" />
        <rect x="222" y="131" width="34" height="14" rx="3.5" fill="#FFFFFF" stroke="#6EE7B7" strokeWidth="1.4" />
        <rect x="228" y="136" width="14" height="4" rx="1.5" fill="#10B981" fillOpacity="0.65" />
      </g>

      {/* Open Accounting Ledger Book on Desk */}
      <g>
        {/* Emerald Hardcover Base */}
        <rect x="46" y="154" width="96" height="23" rx="4" fill="#047857" />
        {/* Left & Right White Ledger Pages */}
        <path
          d="M50 151C50 147.5 53 145 56.5 145H93V174H56.5C53 174 50 171.5 50 168V151Z"
          fill="#FFFFFF"
          stroke="#D1FAE5"
          strokeWidth="1.2"
        />
        <path
          d="M138 151C138 147.5 135 145 131.5 145H95V174H131.5C135 174 138 171.5 138 168V151Z"
          fill="#FFFFFF"
          stroke="#D1FAE5"
          strokeWidth="1.2"
        />
        {/* Center Spine Line */}
        <line x1="94" y1="145" x2="94" y2="174" stroke="#CBD5E1" strokeWidth="1.5" />
        {/* Left Page Accounting Entries */}
        <rect x="57" y="152" width="16" height="3" rx="1.5" fill="#059669" fillOpacity="0.75" />
        <rect x="76" y="152" width="10" height="3" rx="1.5" fill="#F97316" fillOpacity="0.8" />
        <rect x="57" y="159" width="28" height="2.6" rx="1.3" fill="#CBD5E1" />
        <rect x="57" y="165" width="22" height="2.6" rx="1.3" fill="#CBD5E1" />
        {/* Right Page Accounting Entries */}
        <rect x="102" y="152" width="26" height="3" rx="1.5" fill="#94A3B8" fillOpacity="0.6" />
        <rect x="102" y="159" width="20" height="2.6" rx="1.3" fill="#CBD5E1" />
        <rect x="102" y="165" width="24" height="2.6" rx="1.3" fill="#10B981" fillOpacity="0.6" />
      </g>

      {/* Financial Calculator on Desk */}
      <g>
        <rect
          x="156"
          y="142"
          width="42"
          height="35"
          rx="6"
          fill="#FFFFFF"
          stroke="#94A3B8"
          strokeOpacity="0.45"
          strokeWidth="1.4"
        />
        {/* Calculator Screen */}
        <rect x="162" y="147" width="30" height="8" rx="2.5" fill="#065F46" />
        <rect x="176" y="149.5" width="12" height="3" rx="1.5" fill="#6EE7B7" />
        {/* Calculator Keys */}
        <rect x="162" y="158" width="6" height="4.5" rx="1.2" fill="#E2E8F0" />
        <rect x="170" y="158" width="6" height="4.5" rx="1.2" fill="#E2E8F0" />
        <rect x="178" y="158" width="6" height="4.5" rx="1.2" fill="#E2E8F0" />
        <rect x="186" y="158" width="6" height="4.5" rx="1.2" fill="#10B981" fillOpacity="0.75" />
        <rect x="162" y="165" width="6" height="4.5" rx="1.2" fill="#E2E8F0" />
        <rect x="170" y="165" width="6" height="4.5" rx="1.2" fill="#E2E8F0" />
        <rect x="178" y="165" width="6" height="4.5" rx="1.2" fill="#E2E8F0" />
        <rect x="186" y="165" width="6" height="7" rx="1.4" fill="#F97316" />
      </g>

      {/* Clean Institutional Desk Surface */}
      <rect
        x="16"
        y="175"
        width="250"
        height="13"
        rx="6.5"
        fill="url(#auditor-desk-grad)"
        stroke="#10B981"
        strokeOpacity="0.35"
        strokeWidth="1.4"
      />
      <rect x="30" y="188" width="222" height="5" rx="2.5" fill="#047857" fillOpacity="0.12" />
    </svg>
  );
};
