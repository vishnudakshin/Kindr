'use client'

import { motion } from 'framer-motion'

// ── Stage thresholds (10 items assumed) ───────────────────────────────────────
// 0:   pct < 0.20  → seed sprouting
// 1:   pct < 0.50  → small sapling (leaves on stem)
// 2:   pct < 0.70  → small tree (compact canopy)
// 3:   pct < 1.00  → maturing tree (tall, wide canopy)
// 4:   pct === 1.0 → full grown oak (100% only)

const SPRING = { type: 'spring' as const, stiffness: 58, damping: 18 }

const TRUNK       = '#A07845'
const TRUNK_LIGHT = '#C49A5A'
const LEAF_DARK   = '#3E7832'
const LEAF_MID    = '#5C9645'
const LEAF_LIGHT  = '#7AB855'
const LEAF_BRIGHT = '#90C060'

export function SaplingTree({ pct }: { pct: number }) {
  const stage =
    pct >= 1.0 ? 4 :
    pct >= 0.7 ? 3 :
    pct >= 0.5 ? 2 :
    pct >= 0.2 ? 1 :
    0

  const vis = (s: number) => ({
    animate: { opacity: stage === s ? 1 : 0, scale: stage === s ? 1 : 0.86 },
    transition: SPRING,
  })

  return (
    <svg viewBox="0 0 120 152" fill="none" className="w-full h-full">

      {/* Ground (always present) */}
      <ellipse cx="60" cy="144" rx="36" ry="5.5" fill="#C8BA82" opacity="0.55" />

      {/* ── Stage 0: Seed sprouting ──────────────────────────────── */}
      <motion.g style={{ transformOrigin: '60px 140px' }} {...vis(0)}>
        {/* Soil mound */}
        <path d="M44,140 C44,128 51,121 60,121 C69,121 76,128 76,140 Z" fill="#C0A060"/>
        <ellipse cx="60" cy="140" rx="16" ry="4" fill="#B09050"/>
        {/* Stem */}
        <line x1="60" y1="121" x2="60" y2="108"
          stroke="#7A9848" strokeWidth="2.5" strokeLinecap="round"/>
        {/* Two oval seedling leaves */}
        <ellipse cx="52" cy="108" rx="9" ry="5"
          fill="#82B268" transform="rotate(-28 52 108)"/>
        <ellipse cx="68" cy="108" rx="9" ry="5"
          fill="#82B268" transform="rotate(28 68 108)"/>
        {/* Upright centre leaf */}
        <ellipse cx="60" cy="102" rx="4.5" ry="7"
          fill="#8EC264"/>
      </motion.g>

      {/* ── Stage 1: Small sapling (leaves on stem, no canopy) ──── */}
      <motion.g style={{ transformOrigin: '60px 140px' }} {...vis(1)}>
        {/* Thin stem */}
        <path d="M58,140 C57,126 57,112 59,96 L61,96 C63,112 63,126 62,140 Z"
          fill={TRUNK}/>
        {/* Soil bump */}
        <ellipse cx="60" cy="140" rx="9" ry="3" fill="#C0A060" opacity="0.5"/>
        {/* Large broad leaves (like reference sapling) */}
        <ellipse cx="46" cy="92" rx="15" ry="7.5"
          fill={LEAF_LIGHT} transform="rotate(-22 46 92)"/>
        <ellipse cx="74" cy="92" rx="15" ry="7.5"
          fill={LEAF_LIGHT} transform="rotate(22 74 92)"/>
        {/* Upright top leaf */}
        <ellipse cx="60" cy="82" rx="7" ry="12" fill="#8EC264"/>
        {/* Leaf highlights */}
        <ellipse cx="43" cy="88" rx="6" ry="3"
          fill={LEAF_BRIGHT} opacity="0.5" transform="rotate(-22 43 88)"/>
        <ellipse cx="77" cy="88" rx="6" ry="3"
          fill={LEAF_BRIGHT} opacity="0.5" transform="rotate(22 77 88)"/>
      </motion.g>

      {/* ── Stage 2: Small tree (compact round canopy) ──────────── */}
      <motion.g style={{ transformOrigin: '60px 140px' }} {...vis(2)}>
        {/* Trunk */}
        <path d="M55,140 C54,126 54,112 56,98 L64,98 C66,112 66,126 65,140 Z"
          fill={TRUNK}/>
        <path d="M58,138 C57,124 57,110 58,100"
          stroke={TRUNK_LIGHT} strokeWidth="1.5" strokeLinecap="round" opacity="0.45"/>
        {/* Canopy */}
        <circle cx="60" cy="84" r="19" fill={LEAF_MID}/>
        <circle cx="44" cy="91" r="13" fill={LEAF_MID}/>
        <circle cx="76" cy="91" r="13" fill={LEAF_MID}/>
        <circle cx="60" cy="68" r="15" fill={LEAF_LIGHT}/>
        <circle cx="52" cy="73" r="8"  fill={LEAF_BRIGHT} opacity="0.52"/>
        <circle cx="68" cy="71" r="7"  fill={LEAF_BRIGHT} opacity="0.46"/>
      </motion.g>

      {/* ── Stage 3: Maturing tree (taller, wider) ──────────────── */}
      <motion.g style={{ transformOrigin: '60px 140px' }} {...vis(3)}>
        {/* Trunk */}
        <path d="M52,140 C51,124 51,105 53,90 L67,90 C69,105 69,124 68,140 Z"
          fill={TRUNK}/>
        <path d="M57,138 C56,120 56,102 57,92"
          stroke={TRUNK_LIGHT} strokeWidth="2" strokeLinecap="round" opacity="0.38"/>
        {/* Canopy — multi-blob like reference */}
        <circle cx="37" cy="94" r="19" fill={LEAF_DARK}  opacity="0.9"/>
        <circle cx="83" cy="94" r="19" fill={LEAF_DARK}  opacity="0.9"/>
        <circle cx="60" cy="80" r="25" fill={LEAF_MID}/>
        <circle cx="44" cy="64" r="17" fill={LEAF_LIGHT}/>
        <circle cx="76" cy="64" r="17" fill={LEAF_LIGHT}/>
        <circle cx="60" cy="52" r="19" fill={LEAF_LIGHT}/>
        <circle cx="50" cy="58" r="9"  fill={LEAF_BRIGHT} opacity="0.52"/>
        <circle cx="70" cy="56" r="8"  fill={LEAF_BRIGHT} opacity="0.46"/>
        <circle cx="42" cy="80" r="6"  fill={LEAF_BRIGHT} opacity="0.38"/>
        <circle cx="78" cy="80" r="6"  fill={LEAF_BRIGHT} opacity="0.38"/>
      </motion.g>

      {/* ── Stage 4: Full grown oak (100% only) ─────────────────── */}
      {/* Drawing order: trunk → branches → canopy back→front */}
      <motion.g style={{ transformOrigin: '60px 140px' }} {...vis(4)}>

        {/* Grass tufts at base */}
        <ellipse cx="40" cy="138" rx="9"  ry="4"   fill="#5A9820" opacity="0.75"/>
        <ellipse cx="80" cy="138" rx="9"  ry="4"   fill="#5A9820" opacity="0.75"/>
        <ellipse cx="60" cy="139" rx="7"  ry="3"   fill="#4A8818" opacity="0.55"/>

        {/* Trunk — left shadow strip */}
        <path d="M46,140 C44,126 44,110 46,97 L52,97 L51,112 L50,130 Z"
          fill="#3A1E08"/>
        {/* Trunk main body */}
        <path d="M46,140 C44,126 44,110 46,97 L74,97 C76,110 76,126 74,140 Z"
          fill="#6B3A18"/>
        {/* Trunk right highlight */}
        <path d="M68,98 C71,110 72,125 72,139 L74,140 C74,124 73,108 71,98 Z"
          fill="#A06030" opacity="0.45"/>
        {/* Bark grain */}
        <path d="M59,136 C58,120 58,105 59,99"
          stroke="#3A1E08" strokeWidth="1.5" strokeLinecap="round" opacity="0.28"/>

        {/* Y-fork — left branch */}
        <path d="M49,99 C46,92 41,86 35,79"
          stroke="#5A3015" strokeWidth="10" strokeLinecap="round"/>
        <path d="M49,99 C46,92 41,86 35,79"
          stroke="#3A1E08" strokeWidth="3"  strokeLinecap="round" opacity="0.38"/>
        {/* Y-fork — right branch */}
        <path d="M71,99 C74,92 79,86 85,79"
          stroke="#5A3015" strokeWidth="10" strokeLinecap="round"/>
        <path d="M71,99 C74,92 79,86 85,79"
          stroke="#A06030" strokeWidth="2.5" strokeLinecap="round" opacity="0.32"/>

        {/* ── Canopy layer 1: deepest shadow / outer perimeter ── */}
        <circle cx="14"  cy="90" r="14" fill="#1E4A10"/>
        <circle cx="106" cy="90" r="14" fill="#1E4A10"/>
        <circle cx="22"  cy="78" r="16" fill="#1E4A10"/>
        <circle cx="98"  cy="78" r="16" fill="#1E4A10"/>
        <circle cx="32"  cy="88" r="19" fill="#2A5818"/>
        <circle cx="88"  cy="88" r="19" fill="#2A5818"/>
        <circle cx="60"  cy="86" r="23" fill="#2A5818"/>

        {/* ── Canopy layer 2: dark forest green (main body) ─── */}
        <circle cx="18"  cy="74" r="16" fill="#326820"/>
        <circle cx="102" cy="74" r="16" fill="#326820"/>
        <circle cx="24"  cy="62" r="14" fill="#3A7222"/>
        <circle cx="96"  cy="62" r="14" fill="#3A7222"/>
        <circle cx="34"  cy="70" r="21" fill="#3A7222"/>
        <circle cx="86"  cy="70" r="21" fill="#3A7222"/>
        <circle cx="60"  cy="68" r="26" fill="#3A7222"/>
        <circle cx="46"  cy="54" r="17" fill="#3A7222"/>
        <circle cx="74"  cy="54" r="17" fill="#3A7222"/>

        {/* ── Canopy layer 3: medium vibrant green ─────────── */}
        <circle cx="28"  cy="58" r="15" fill="#4E9030"/>
        <circle cx="92"  cy="58" r="15" fill="#4E9030"/>
        <circle cx="42"  cy="50" r="20" fill="#4E9030"/>
        <circle cx="78"  cy="50" r="20" fill="#4E9030"/>
        <circle cx="60"  cy="52" r="24" fill="#4E9030"/>
        <circle cx="54"  cy="38" r="16" fill="#5CA034"/>
        <circle cx="66"  cy="38" r="16" fill="#5CA034"/>
        <circle cx="60"  cy="40" r="20" fill="#5CA034"/>

        {/* ── Canopy layer 4: bright lime-green (lit top) ──── */}
        <circle cx="44"  cy="40" r="15" fill="#72B835"/>
        <circle cx="76"  cy="40" r="15" fill="#72B835"/>
        <circle cx="54"  cy="28" r="16" fill="#72B835"/>
        <circle cx="66"  cy="28" r="16" fill="#72B835"/>
        <circle cx="60"  cy="24" r="19" fill="#7EC040"/>

        {/* ── Canopy layer 5: yellow-green top highlight ───── */}
        <circle cx="52"  cy="20" r="11" fill="#94CC38" opacity="0.92"/>
        <circle cx="68"  cy="20" r="11" fill="#94CC38" opacity="0.92"/>
        <circle cx="60"  cy="16" r="14" fill="#A8D840"/>
        <circle cx="56"  cy="12" r="8"  fill="#C0E840" opacity="0.85"/>
        <circle cx="64"  cy="12" r="8"  fill="#C0E840" opacity="0.85"/>
        <circle cx="60"  cy="10" r="7"  fill="#D4F050" opacity="0.72"/>

        {/* ── Bumpy leaf-edge perimeter dots ───────────────── */}
        <circle cx="8"   cy="84" r="5" fill="#2A5818"/>
        <circle cx="112" cy="84" r="5" fill="#2A5818"/>
        <circle cx="12"  cy="70" r="5" fill="#326820"/>
        <circle cx="108" cy="70" r="5" fill="#326820"/>
        <circle cx="18"  cy="56" r="5" fill="#3A7222"/>
        <circle cx="102" cy="56" r="5" fill="#3A7222"/>
        <circle cx="26"  cy="42" r="5" fill="#4E9030"/>
        <circle cx="94"  cy="42" r="5" fill="#4E9030"/>
        <circle cx="36"  cy="28" r="5" fill="#72B835"/>
        <circle cx="84"  cy="28" r="5" fill="#72B835"/>
        <circle cx="48"  cy="16" r="5" fill="#94CC38"/>
        <circle cx="72"  cy="16" r="5" fill="#94CC38"/>

      </motion.g>

    </svg>
  )
}
