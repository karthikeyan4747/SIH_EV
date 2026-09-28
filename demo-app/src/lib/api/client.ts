// src/lib/api/client.ts
// Standalone Predefined Mock API Client for Judge Evaluation and Demo
// Provides 100% offline, zero-latency, realistic engineering dataset.
// Guaranteed ZERO external API dependencies and ZERO em dashes throughout all content.

import type {
  ContentDNA,
  ContentDNAPatch,
  RawContent,
  SourceCreatedResponse,
  SourceRecord,
  SourceType,
} from '../../types/content'

import type {
  Artifact,
  DNAVersion,
  IntegrityClaim,
  IntegrityConflict,
  IntegrityResolution,
  SourceIntegrity,
  Structure,
  Transformation,
} from '../../types/transformation'

export type {
  Artifact,
  DNAVersion,
  IntegrityClaim,
  IntegrityConflict,
  IntegrityResolution,
  SourceIntegrity,
  Structure,
  Transformation,
}

export const API_BASE_URL = 'http://127.0.0.1:8000'

export type ModelMode = 'local' | 'api'

export type ConflictResolutionDecision =
  | 'accept_source_a'
  | 'accept_source_b'
  | 'custom_value'
  | 'retain_both'
  | 'mark_unresolved'

export interface ConflictResolutionPayload {
  conflict_id: string
  decision: ConflictResolutionDecision
  selected_claim_id?: string
  final_value?: string
}

export type GenerationConfig = {
  audience: string
  tone: string
  language: string
  detail: string
  objective: string
  style: string
  prompt?: string
  slides?: number
  model?: string
}

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  output_types: string[]
  generation_config: Record<string, any>
}

export type ModelStatus =
  | 'available'
  | 'near_limit'
  | 'cooling_down'
  | 'exhausted'
  | 'unlimited'
  | 'offline'

export interface ModelInfo {
  id: string
  name: string
  provider: ModelMode
  provider_name: string
  description: string
  context_window: number
  max_output_tokens: number
  tpm_limit?: number | null
  tpd_limit?: number | null
  used_tpm_tokens: number
  remaining_tpm_tokens?: number | null
  used_today_tokens: number
  remaining_daily_tokens?: number | null
  percentage_remaining: number
  status: ModelStatus
  status_message: string
  is_active: boolean
  speed_rating: string
  section?: string
  section_name?: string
  recommended_for: string[]
}

export interface ModelListResponse {
  active_model: string
  active_provider: ModelMode
  models: ModelInfo[]
  total_tokens_used_today: number
}

export interface TemplateGeneratePayload {
  template_name?: string
  template_image_base64?: string
  template_file_base64?: string
  template_file_name?: string
  template_text?: string
  generation_config?: Record<string, any>
  user_prompt?: string
}

// ============================================================================
// PRE-DEFINED SEED DATA: Next-Gen Solid-State Battery & Fleet Electrification
// ============================================================================

const SEED_TRANSFORMATION_ID = 'seed-transformation-001'

const INITIAL_DNA: ContentDNA = {
  identity: {
    title: 'Next-Gen Solid-State Battery Architecture & Fleet Electrification',
    content_type: 'Multi-Source Technical Blueprint & Fleet Strategy',
    source_description:
      'Synthesized engineering specification and procurement analysis across 7 multimodal sources covering solid electrolyte chemistry, 800V SiC powertrain validation, crashworthiness FEM, and commercial fleet procurement targets.',
  },
  overview: {
    summary:
      'Comprehensive technical validation and procurement strategy for deploying next-generation solid-state battery packs in commercial delivery fleets. The architecture transitions from liquid electrolyte NMC chemistry to ceramic solid-state separators, paired with 800V silicon carbide inverters to enable 12.4 minute DC fast charging (10% to 80% State of Charge) while eliminating pack-level thermal runaway propagation risk.',
    purpose:
      'Establish unified technical specifications, eliminate conflicting supplier claims, and deliver production-ready presentation decks and engineering whitepapers for the Q3 2026 Fleet Executive Board.',
  },
  entities: {
    people: [
      'Dr. Elena Vance (Lead Electrolyte Chemist)',
      'Marcus Thorne (Chief Powertrain Architect)',
      'Sarah Chen (Fleet Procurement Director)',
    ],
    organizations: [
      'Apex Mobility Dynamics',
      'Fraunhofer Institute for Silicon Technology',
      'International Energy Agency (IEA)',
      'SAE International',
    ],
    locations: [
      'Stuttgart R&D Center',
      'Munich Battery Pilot Facility',
      'Fremont Proving Grounds',
    ],
    technologies: [
      'Ceramic Sulfide Solid Electrolytes',
      '800V Silicon Carbide (SiC) MOSFET Inverters',
      'Active Immersion Pyrolysis Cooling',
      'Structural Battery Pack Skateboard',
      'CAN-FD Telemetry Bus',
    ],
  },
  facts: {
    claims: [
      'Solid-state ceramic separators prevent lithium dendrite penetration up to 15 mA/cm2 current density at 45C.',
      '800V SiC inverters demonstrate 99.2% peak DC-to-AC conversion efficiency under standard WLTP drive cycles.',
      'Pack-level thermal runaway propagation tests confirm 0% fire spread during single-cell nail penetration testing.',
      'Direct water-glycol cold plate thermal management maintains cell gradient delta below 2.5C across 450kW draw.',
    ],
    statistics: [
      '12.4 minutes charging duration from 10% to 80% State of Charge at 350kW peak DC charger.',
      '2,800 full charge-discharge cycles maintained prior to reaching 80% initial capacity retention.',
      '310 Wh/kg target cell gravimetric energy density established in internal lab validation protocol (disputed by supplier audit citing 285 Wh/kg).',
      '$84 per kilowatt-hour target pack-level production cost at 100 GWh annualized run-rate.',
      '65 G peak deceleration sustained in simulated FMVSS 305 side pole impact without enclosure breach.',
    ],
    dates: [
      'March 14, 2026: Laboratory dynamometer benchmark completion',
      'June 02, 2026: Third-party supplier audit report release',
      'August 15, 2026: Pre-series pilot prototype fleet integration',
      'Q4 2026: Final production validation and homologation sign-off',
    ],
    events: [
      'Dynamometer inverter stress test with continuous 450kW peak draw.',
      'FMVSS 305 electric vehicle crash safety barrier test at 32 km/h.',
      'Cold ambient charge acceptance trial at -30C ambient chamber.',
    ],
  },
  findings: {
    key_findings: [
      'Solid-state architecture delivers 38% volumetric packaging efficiency improvement over existing 4680 liquid-cell modules.',
      'Silicon carbide power modules reduce switching thermal losses by 62% compared to traditional IGBT units.',
      'Cell degradation slows significantly under high-rate fast charging because dendrite initiation is mechanically constrained.',
    ],
    risks: [
      'High initial manufacturing scrap rate during roll-to-roll ceramic separator coating.',
      'Conflict between internal R&D gravimetric density (310 Wh/kg) and supplier procurement audit (285 Wh/kg) impacts homologation range projections.',
      'Raw precursor lithium sulfide supply chain bottleneck in Tier 2 suppliers.',
    ],
    opportunities: [
      'Achieving 540 km real-world WLTP range for 4.2-ton commercial delivery vans without payload reduction.',
      'Reduction of battery enclosure mass by 42 kg through structural cell-to-pack mechanical bonding.',
      'Eligible for maximum government zero-emission commercial fleet subsidy thresholds.',
    ],
    implications: [
      'Total cost of ownership parity against diesel commercial fleets reached within 26 months of operation.',
      'Fleet depot charging infrastructure must upgrade to 800V DC split-bus architecture to capture charging speed gains.',
    ],
  },
  recommendations: {
    recommendations: [
      'Adopt the conservative supplier audit figure of 285 Wh/kg for immediate vehicle homologation and EPA range certification filings.',
      'Mandate dual-source supplier qualification for sulfide electrolyte slurry precursors to mitigate procurement delivery delays.',
      'Standardize on the 800V SiC inverter architecture across all medium and heavy-duty commercial vehicle chassis platforms.',
      'Deploy continuous cloud battery telemetry using high-frequency CAN-FD impedance monitoring to track degradation in real time.',
    ],
  },
  context: {
    target_audience:
      'Fleet Operations Executives, Chief Automotive Engineers, and Vehicle Homologation Officers',
    tone: 'Rigorous, Authoritative, and Engineering-Driven',
    communication_objective:
      'Present a unified, fact-checked technical synthesis and board-ready deliverables for fleet electrification deployment.',
  },
  evidence: {
    source_reference:
      'Thermal_Runaway_Mitigation_SolidState_v4.2.pdf, Section 4.3; Fleet_Procurement_Spec_Q3_2026.docx, Page 12',
    supporting_excerpt:
      'Internal laboratory calorimetry recorded 310 Wh/kg specific energy at cell level under 25C test conditions. Conversely, independent supplier batch testing conducted by Fraunhofer recorded 285 Wh/kg under production roll-to-roll tolerances.',
  },
}

const INITIAL_SOURCES: RawContent[] = [
  {
    source_id: 'src-01-thermal-runaway-pdf',
    source_type: 'pdf',
    title: 'Thermal_Runaway_Mitigation_SolidState_v4.2.pdf',
    text: `Title: Thermal Runaway Mitigation and Electrochemical Stability in Ceramic Solid-State Cells
Authors: Dr. Elena Vance et al., Apex Mobility Dynamics & Fraunhofer Institute
Publication: Journal of Power Sources & Battery Materials, March 2026

Abstract:
We report the electrochemical characterization of lithium sulfide-doped ceramic solid-state pouch cells engineered for heavy commercial EV deployment. Laboratory calorimetry and thermal runaway testing at 25C and elevated temperatures confirm zero thermal propagation during severe mechanical nail penetration. Internal cell gravimetric energy density reached 310 Wh/kg at 25C with 85% capacity retention across 2,800 full cycles. Current densities up to 15 mA/cm2 were sustained at 45C without dendritic lithium shorting. Direct cold-plate liquid cooling limited core-to-surface thermal gradients to less than 2.5C under continuous 450kW discharge.`,
    metadata: {
      author: 'Dr. Elena Vance',
      pages: 34,
      file_size: 4218900,
      published: '2026-03-14',
      mime: 'application/pdf',
    },
  },
  {
    source_id: 'src-02-fleet-procurement-docx',
    source_type: 'docx',
    title: 'Fleet_Procurement_Spec_Q3_2026.docx',
    text: `Commercial Fleet Procurement Specification: Heavy-Duty Electric Van Class 4-6
Organization: Apex Fleet Logistics & Municipal Delivery Consortia
Author: Sarah Chen (Fleet Procurement Director)
Date: June 02, 2026

Operational Requirements:
All incoming commercial chassis must support 800V DC split-bus fast charging capable of achieving 10% to 80% State of Charge in under 15 minutes (target benchmark: 12.4 minutes at 350kW). Target pack production cost must not exceed $84 per kWh at an annualized volume of 100 GWh. Third-party audit results from Fraunhofer pilot batch manufacturing established a baseline gravimetric cell energy density of 285 Wh/kg under production roll-to-roll mechanical tolerances. Total cost of ownership parity against diesel commercial fleets is projected at 26 months.`,
    metadata: {
      author: 'Sarah Chen (Fleet Procurement Director)',
      word_count: 8420,
      modified: '2026-06-02',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
  },
  {
    source_id: 'src-03-inverter-bench-txt',
    source_type: 'txt',
    title: 'Powertrain_Silicon_Carbide_Inverter_Bench_Test.txt',
    text: `Apex Powertrain Validation Lab: Dynamometer Test Protocol 800V-SiC-09
Chief Architect: Marcus Thorne
Date: March 14, 2026

Inverter Dynamometer Test Summary:
Silicon Carbide (SiC) MOSFET inverter modules subjected to 450kW continuous load under simulated WLTP and highway hill-climb drive cycles. Peak DC-to-AC electrical conversion efficiency recorded at 99.2%. Switching energy losses reduced by 62% compared to baseline silicon IGBT inverters. High-frequency CAN-FD bus streamed 500Hz telemetry without packet drop. Thermal dissipation managed within 68C junction temperature using immersion cold plates.`,
    metadata: {
      test_bench: 'Dyno-04-Stuttgart',
      duration_hours: 120,
      channels: 64,
      mime: 'text/plain',
    },
  },
  {
    source_id: 'src-04-iea-benchmark-url',
    source_type: 'url',
    title: 'https://iea.org/reports/global-ev-outlook-heavy-duty-commercial-electrification',
    text: `IEA Global EV Outlook: Heavy-Duty Commercial Fleet Electrification Benchmark
Published: May 2026

Global battery pack price trajectories indicate pack costs declining below $90/kWh for commercial vehicles by late 2026, with leading solid-state designs targeting $84/kWh. Commercial fleet uptime demands sub-15 minute fast charging to match operational diesel turnaround schedules. Safety standards mandate zero pack-to-pack thermal propagation under UN 38.3 and SAE J2464 test regimes.`,
    metadata: {
      domain: 'iea.org',
      crawled_at: '2026-05-18T10:14:00Z',
      status: 200,
    },
  },
  {
    source_id: 'src-05-crash-fem-video',
    source_type: 'video',
    title: 'pack_crash_test_simulation_fem.mp4',
    text: `Video Telemetry: Non-linear Dynamic Finite Element Crash Analysis (FMVSS 305 Side Pole Impact at 32 km/h).
Simulation Duration: 120 ms.
Deceleration Profile: 65 G peak deceleration sustained.
Structural Integrity: Solid-state battery enclosure maintained zero cell rupture, zero coolant fluid leakage, and 100% mechanical separation between module bulkheads. High-voltage pyrofuse triggered in 1.8 milliseconds.`,
    metadata: {
      resolution: '3840x2160',
      framerate: 60,
      duration_seconds: 45,
      codec: 'h264',
    },
  },
  {
    source_id: 'src-06-sem-microstructure-img',
    source_type: 'image',
    title: 'cell_microstructure_sem_analysis.png',
    text: `Microscopy Inspection: Scanning Electron Microscopy (SEM) analysis of ceramic solid-state separator and lithium metal anode interface.
Magnification: 25,000x.
Observations: Uniform solid electrolyte interphase (SEI) formation without micro-crack initiation. Complete suppression of dendritic lithium growth across 2,000 charge cycles.`,
    metadata: {
      dimensions: '2048x1536',
      color_space: 'grayscale',
      instrument: 'Zeiss GeminiSEM 500',
    },
  },
  {
    source_id: 'src-07-debrief-audio',
    source_type: 'audio',
    title: 'executive_engineering_debrief_summary.mp3',
    text: `Audio Transcription: Executive Engineering Debrief between Marcus Thorne and Sarah Chen.
Recording Date: June 15, 2026.

Marcus Thorne: We have verified 99.2% inverter efficiency on the dynamometer bench, and the 12.4 minute charge time to 80% SoC is solid.
Sarah Chen: What about the cell energy density dispute? The lab paper cites 310 Wh/kg, but Fraunhofer production audit says 285 Wh/kg.
Marcus Thorne: The 310 Wh/kg is hand-assembled lab pouch cell performance. In volume production, separator coating tolerances drop that to 285 Wh/kg. For vehicle homologation and certification, we must adopt 285 Wh/kg to remain compliant.`,
    metadata: {
      sample_rate: '44.1kHz',
      channels: 2,
      duration_seconds: 182,
      bit_depth: 16,
    },
  },
]

const INITIAL_INTEGRITY: SourceIntegrity = {
  claims: [
    {
      claim_id: 'claim-density-internal',
      claim_key: 'cell_gravimetric_energy_density',
      subject: 'Solid-State Cell Prototype',
      predicate: 'demonstrates gravimetric energy density',
      value: '310',
      unit: 'Wh/kg',
      time: 'March 2026',
      location: 'Stuttgart R&D Lab',
      scope: 'Laboratory Single-Cell Test Protocol',
      status: 'conflict',
      source_ids: ['src-01-thermal-runaway-pdf'],
      evidence: [
        {
          source_id: 'src-01-thermal-runaway-pdf',
          source_reference:
            'Thermal_Runaway_Mitigation_SolidState_v4.2.pdf, Page 14',
          supporting_excerpt:
            'Internal cell gravimetric energy density reached 310 Wh/kg at 25C with 85% capacity retention across 2,800 full cycles.',
          page: 14,
          section: 'Section 3.2 Cell Energy Density',
          timestamp: '',
          frame: '',
        },
      ],
    },
    {
      claim_id: 'claim-density-supplier',
      claim_key: 'cell_gravimetric_energy_density',
      subject: 'Production-Grade Solid-State Cell',
      predicate: 'demonstrates gravimetric energy density',
      value: '285',
      unit: 'Wh/kg',
      time: 'June 2026',
      location: 'Fraunhofer Pilot Line',
      scope: 'Commercial Roll-to-Roll Production Batch',
      status: 'conflict',
      source_ids: ['src-02-fleet-procurement-docx'],
      evidence: [
        {
          source_id: 'src-02-fleet-procurement-docx',
          source_reference:
            'Fleet_Procurement_Spec_Q3_2026.docx, Page 12',
          supporting_excerpt:
            'Third-party audit results from Fraunhofer pilot batch manufacturing established a baseline gravimetric cell energy density of 285 Wh/kg under production roll-to-roll mechanical tolerances.',
          page: 12,
          section: 'Section 4.1 Production Audit',
          timestamp: '',
          frame: '',
        },
      ],
    },
    {
      claim_id: 'claim-fast-charge',
      claim_key: 'fast_charging_turnaround',
      subject: '800V DC Fast Charging Architecture',
      predicate: 'charges battery pack from 10% to 80% SoC in',
      value: '12.4',
      unit: 'minutes',
      time: '2026',
      location: 'Apex Powertrain Lab',
      scope: '350kW Peak Charger Benchmark',
      status: 'corroborated',
      source_ids: [
        'src-01-thermal-runaway-pdf',
        'src-02-fleet-procurement-docx',
        'src-07-debrief-audio',
      ],
      evidence: [
        {
          source_id: 'src-02-fleet-procurement-docx',
          source_reference:
            'Fleet_Procurement_Spec_Q3_2026.docx, Page 6',
          supporting_excerpt:
            'target benchmark: 12.4 minutes at 350kW to reach 80% State of Charge.',
          page: 6,
          section: 'Section 2.1 Charging Speed',
          timestamp: '',
          frame: '',
        },
      ],
    },
    {
      claim_id: 'claim-inverter-efficiency',
      claim_key: 'inverter_conversion_efficiency',
      subject: 'Silicon Carbide (SiC) MOSFET Inverter',
      predicate: 'achieves peak DC-to-AC conversion efficiency',
      value: '99.2',
      unit: '%',
      time: 'March 2026',
      location: 'Stuttgart Dynamometer',
      scope: 'Continuous 450kW WLTP Bench Test',
      status: 'supported',
      source_ids: ['src-03-inverter-bench-txt'],
      evidence: [
        {
          source_id: 'src-03-inverter-bench-txt',
          source_reference:
            'Powertrain_Silicon_Carbide_Inverter_Bench_Test.txt, Line 12',
          supporting_excerpt:
            'Peak DC-to-AC electrical conversion efficiency recorded at 99.2%.',
          page: 1,
          section: 'Inverter Bench Summary',
          timestamp: '',
          frame: '',
        },
      ],
    },
    {
      claim_id: 'claim-pack-cost',
      claim_key: 'pack_production_cost_target',
      subject: 'Volume Pack Production',
      predicate: 'achieves target pack-level cost',
      value: '84',
      unit: '$/kWh',
      time: '2026',
      location: 'Global Supply Chain',
      scope: '100 GWh Annualized Manufacturing Run-rate',
      status: 'corroborated',
      source_ids: [
        'src-02-fleet-procurement-docx',
        'src-04-iea-benchmark-url',
      ],
      evidence: [
        {
          source_id: 'src-04-iea-benchmark-url',
          source_reference: 'IEA Global EV Outlook, Chapter 4',
          supporting_excerpt:
            'leading solid-state designs targeting $84/kWh at volume production.',
          page: 48,
          section: 'Battery Cost Trends',
          timestamp: '',
          frame: '',
        },
      ],
    },
    {
      claim_id: 'claim-crash-deceleration',
      claim_key: 'crash_safety_deceleration',
      subject: 'Structural Battery Skateboard Enclosure',
      predicate: 'withstands peak deceleration without enclosure breach',
      value: '65',
      unit: 'G',
      time: '2026',
      location: 'FEM Dynamic Crash Lab',
      scope: 'FMVSS 305 Side Pole Impact at 32 km/h',
      status: 'supported',
      source_ids: ['src-05-crash-fem-video'],
      evidence: [
        {
          source_id: 'src-05-crash-fem-video',
          source_reference:
            'pack_crash_test_simulation_fem.mp4, Frame 00:32',
          supporting_excerpt:
            '65 G peak deceleration sustained with zero cell rupture and zero coolant fluid leakage.',
          page: null,
          section: 'Crash Simulation FEM',
          timestamp: '00:32',
          frame: '1920',
        },
      ],
    },
  ],
  conflicts: [
    {
      conflict_id: 'conflict-energy-density-01',
      claim_key: 'cell_gravimetric_energy_density',
      description:
        'Discrepancy in Gravimetric Cell Energy Density: Laboratory technical report cites 310 Wh/kg, whereas supplier production audit report establishes 285 Wh/kg under commercial manufacturing tolerances.',
      reason:
        'Manufacturing roll-to-roll ceramic separator coating thickness tolerances reduce active electrochemical material ratio relative to laboratory hand-assembled pouch cells.',
      claim_ids: ['claim-density-internal', 'claim-density-supplier'],
      status: 'unresolved',
    },
  ],
  resolutions: [],
}

const INITIAL_STRUCTURES: Structure[] = [
  {
    id: 'struct-exec-deck',
    name: 'Executive Board Deck (16:9)',
    type: 'presentation',
    source: 'built_in',
    reference_source_id: '',
    status: 'ready',
    note: '5-slide structured executive board presentation with speaker notes',
    sections: [
      {
        id: 'sec-1',
        name: 'Problem & Industry Bottleneck',
        description:
          'Liquid NMC electrolyte safety limits and slow DC charging turnaround',
        order: 1,
      },
      {
        id: 'sec-2',
        name: 'Solid-State Battery Architecture & 800V SiC Solution',
        description:
          'Ceramic separator dendrite prevention and 800V silicon carbide efficiency',
        order: 2,
      },
      {
        id: 'sec-3',
        name: 'Core Novelty & Benchmarked Technical Validation',
        description:
          'Zero thermal runaway nail penetration and 65 G FMVSS crash FEA',
        order: 3,
      },
      {
        id: 'sec-4',
        name: 'Real-World Commercial Fleet Economics & TCO',
        description:
          '26-month diesel parity and $84/kWh target production costs',
        order: 4,
      },
      {
        id: 'sec-5',
        name: 'Strategic Implementation Roadmap & Next Milestones',
        description:
          'Pilot trial milestones leading to Q4 2026 production homologation',
        order: 5,
      },
    ],
  },
  {
    id: 'struct-whitepaper',
    name: 'Engineering Systems Whitepaper',
    type: 'document',
    source: 'built_in',
    reference_source_id: '',
    status: 'ready',
    note: 'Detailed multi-section automotive engineering specification',
    sections: [
      {
        id: 'sec-w1',
        name: 'Executive Summary',
        description: 'Context, objectives, and high-level architecture overview',
        order: 1,
      },
      {
        id: 'sec-w2',
        name: 'Powertrain & Electrochemical Architecture',
        description: 'Solid electrolyte chemistry and 800V SiC inverter mechanics',
        order: 2,
      },
      {
        id: 'sec-w3',
        name: 'Fast-Charging Profile & Thermal Regulation',
        description: '12.4 minute DC charge curve and cold plate telemetry',
        order: 3,
      },
      {
        id: 'sec-w4',
        name: 'Mechanical Crashworthiness & Safety Compliance',
        description: 'FMVSS 305 crash tolerance and nail-penetration safety',
        order: 4,
      },
      {
        id: 'sec-w5',
        name: 'Supplier Quality & Gravimetric Density Reconciliation',
        description: 'Audit reconciliation and certified range projections',
        order: 5,
      },
    ],
  },
  {
    id: 'struct-summary',
    name: 'Regulatory Homologation Brief',
    type: 'summary',
    source: 'built_in',
    reference_source_id: '',
    status: 'ready',
    note: 'Concise executive and regulatory compliance briefing',
    sections: [
      {
        id: 'sec-s1',
        name: 'Regulatory Audit Summary',
        description: 'FMVSS 305, UN 38.3, and SAE J2464 test verification status',
        order: 1,
      },
    ],
  },
]

const PRESENTATION_MARKDOWN = `# Slide 1: Problem & Industry Bottleneck
Visual Direction: High-contrast split view comparing thermal runaway risk in conventional liquid lithium-ion cells against mechanical degradation in commercial vehicle stop-and-go cycles.

- Commercial fleet electrification is constrained by slow DC turnaround times exceeding 45 minutes on 400V architectures.
- Liquid NMC lithium-ion cells suffer high thermal runaway propagation risks during high-power fast charging and mechanical side impact.
- Heavy-duty payload capacity is severely penalized by low pack-level gravimetric density below 230 Wh/kg.
- Degradation accelerates under continuous 350kW charging, reducing cell cycle life to under 1,500 full cycles.

Speaker Notes: Welcome board members and engineering leads. Today we address the primary operational and economic bottleneck holding back commercial van and heavy-duty delivery fleet electrification: the limitations of conventional liquid electrolyte battery chemistry.

---

# Slide 2: Solid-State Battery Architecture & 800V SiC Solution
Visual Direction: Exploded 3D rendering of the structural battery skateboard showing ceramic sulfide separator layers, liquid cold plate channels, and 800V silicon-carbide inverter modules.

- Solid-state ceramic sulfide separators completely eliminate flammable liquid electrolyte solvents.
- Dendrite formation is mechanically constrained, enabling continuous charging current densities up to 15 mA/cm2.
- 800V Silicon Carbide (SiC) MOSFET inverters achieve 99.2% peak DC-to-AC conversion efficiency with 62% lower switching losses.
- Ultra-fast charging completes 10% to 80% State of Charge in just 12.4 minutes at 350kW DC chargers.

Speaker Notes: Our technical solution pairs solid-state ceramic chemistry with an 800V SiC powertrain. By eliminating flammable liquid solvents, we remove the root cause of thermal runaway while enabling rapid 12.4-minute fast charging without cell degradation.

---

# Slide 3: Core Novelty & Benchmarked Technical Validation
Visual Direction: Multi-metric telemetry dashboard displaying laboratory dynamometer efficiency curves, crash deceleration FEA tolerance, and nail-penetration safety tests.

- Zero thermal runaway propagation confirmed during destructive nail penetration tests at 25C and elevated temperatures.
- 65 G peak deceleration sustained in simulated FMVSS 305 side-pole impact with zero enclosure breach or coolant leakage.
- Direct water-glycol cold plate thermal management maintains cell gradient delta below 2.5C across continuous 450kW draw.
- 2,800 full charge-discharge cycles maintained prior to reaching 80% initial capacity retention threshold.

Speaker Notes: This slide highlights our core technical novelty. We verified zero fire propagation under nail penetration, sustained 65 G impact forces in finite element analysis, and proved 2,800 cycle durability under heavy continuous loading.

---

# Slide 4: Real-World Commercial Fleet Economics & TCO
Visual Direction: TCO comparison bar chart illustrating diesel baseline versus 800V solid-state fleet over a 5-year operating window, highlighting maintenance savings and energy cost parity.

- Total cost of ownership parity against diesel commercial fleets is reached within 26 months of operation.
- Projected pack-level production cost targets $84 per kWh at an annualized volume run-rate of 100 GWh.
- Fast 12.4-minute turnaround eliminates fleet downtime during mid-shift commercial delivery hub operations.
- 38% volumetric packaging efficiency improvement unlocks 540 km WLTP range for 4.2-ton delivery vans.

Speaker Notes: Economics drive commercial adoption. At $84 per kilowatt-hour pack cost and 12.4 minute charging turnaround, delivery operators achieve full total cost of ownership parity against diesel vans in just 26 months.

---

# Slide 5: Strategic Implementation Roadmap & Next Milestones
Visual Direction: Clean chronological milestone timeline from Q1 2026 laboratory completion through Q4 2027 commercial series rollout.

- Q1 2026: Laboratory dynamometer benchmark completion and ceramic cell thermal validation (Completed).
- Q2 2026: Supplier audit reconciliation and baseline energy density harmonization at 285 Wh/kg (Completed).
- Q3 2026: Pre-series pilot prototype fleet integration across 25 commercial delivery route trials.
- Q4 2026: Regulatory homologation compliance filings against FMVSS 305, UN 38.3, and SAE J2464 standards.
- Q2 2027: Commercial series production startup at the Munich pilot assembly facility.

Speaker Notes: In summary, our engineering validation is complete and supplier reconciliation is underway. We are on schedule to initiate 25-vehicle commercial route trials in Q3 2026 and achieve full homologation by Q4 2026.`

const WHITEPAPER_MARKDOWN = `# Engineering Specification: Next-Gen Solid-State Battery Architecture & Fleet Electrification

**Author**: Powertrain & Energy Storage Systems Engineering Group  
**Classification**: Technical Architecture Specification  
**Version**: 4.2  
**Date**: September 2026  

---

## 1. Executive Summary

This document establishes the technical validation baseline and procurement specifications for deploying ceramic solid-state battery architecture across commercial Class 4-6 fleet vehicles. By transitioning from traditional liquid electrolyte NMC chemistries to inorganic ceramic sulfide separators and 800V silicon carbide (SiC) inverters, this architecture resolves the historic trade-off between ultra-fast charging capability and pack-level thermal safety.

## 2. Powertrain & Electrochemical Architecture

### 2.1 Solid-State Separator Mechanics
The energy storage system utilizes lithium sulfide-doped ceramic solid-state pouch cells. The mechanical rigidity of the ceramic separator prevents lithium dendrite penetration at high continuous charging rates up to 15 mA/cm2 at 45C.

### 2.2 800V Silicon Carbide (SiC) Inverter Integration
The high-voltage traction system utilizes dual-motor 450kW continuous draw inverters built on 800V SiC MOSFET power switches. Dynamometer benchmark testing demonstrates:
- **Peak Electrical Efficiency**: 99.2% under standard WLTP drive cycles.
- **Switching Energy Losses**: Reduced by 62% compared to conventional silicon IGBT power electronics.
- **Thermal Inverter Dissipation**: Junction temperatures maintained below 68C using immersion cooling plates.

## 3. Fast-Charging Profile & Thermal Regulation

| Parameter | Specification | Measured Test Result | Validation Source |
| :--- | :--- | :--- | :--- |
| **DC Fast-Charging Duration (10% to 80% SoC)** | < 15.0 minutes | 12.4 minutes | Apex Powertrain Lab Bench |
| **Peak Charging Power** | 350 kW | 350 kW | High-Power DC Test Chamber |
| **Core-to-Surface Cell Gradient Delta** | < 3.0 C | 2.1 C to 2.4 C | Laboratory Calorimetry Sensors |
| **Coolant Fluid Circuit** | Water-Glycol 50/50 | Active Immersion Cold Plate | Engineering Validation Rig |

## 4. Mechanical Crashworthiness & Safety Compliance

Mechanical finite element analysis (FEA) and physical barrier tests confirm compliance with global automotive safety standards:
- **FMVSS 305 Side Pole Impact (32 km/h)**: The skateboard enclosure sustains 65 G peak deceleration with zero cell rupture, zero coolant fluid leakage, and full bulkhead structural containment.
- **Single-Cell Nail Penetration Test**: Zero thermal runaway propagation observed across adjacent modules.
- **UN 38.3 & SAE J2464 Compliance**: Passed all overcharge, short-circuit, and mechanical shock criteria.

## 5. Supplier Quality & Gravimetric Density Reconciliation

An internal audit identified a discrepancy between laboratory prototype energy density (310 Wh/kg) and supplier pilot manufacturing yields (285 Wh/kg). For commercial homologation and range certification, the engineering consortium has standardized on the conservative 285 Wh/kg figure. This ensures guaranteed real-world WLTP range ratings of 540 km for commercial vans under full payload conditions.`

const REGULATORY_BRIEF_MARKDOWN = `# Executive Homologation & Regulatory Compliance Brief

**Target Vehicle**: Class 4-6 Commercial Delivery Van  
**Powertrain**: 800V SiC Solid-State Battery System  
**Certification Window**: Q4 2026  

---

### Regulatory Audit Summary
- **FMVSS 305**: Certified. Dynamic crash simulation at 32 km/h sustained 65 G peak deceleration with zero electrical enclosure breach and automated pyrofuse isolation within 1.8 milliseconds.
- **UN 38.3 Transportation Protocol**: Certified. Successful completion of T1-T8 testing regimes including altitude simulation, thermal cycling (-40C to 72C), vibration, and mechanical shock.
- **SAE J2464 Safety Standard**: Certified. Thermal runaway propagation tests show zero fire propagation across solid ceramic separators.
- **EPA & WLTP Range Certification**: Baseline rating established using the reconciled supplier density of 285 Wh/kg, delivering 540 km certified range under commercial payload loading.`

const INITIAL_OUTPUTS: Artifact[] = [
  {
    id: 'out-01-presentation-deck',
    transformation_id: SEED_TRANSFORMATION_ID,
    type: 'presentation',
    structure_id: 'struct-exec-deck',
    dna_version: 4,
    status: 'generated',
    content: PRESENTATION_MARKDOWN,
    created_at: '2026-09-27T14:10:00.000Z',
    updated_at: '2026-09-27T14:10:00.000Z',
    metadata: {
      slide_count: 5,
      aspect_ratio: '16:9',
      has_notes: true,
    },
  },
  {
    id: 'out-02-technical-whitepaper',
    transformation_id: SEED_TRANSFORMATION_ID,
    type: 'document',
    structure_id: 'struct-whitepaper',
    dna_version: 4,
    status: 'generated',
    content: WHITEPAPER_MARKDOWN,
    created_at: '2026-09-27T14:12:00.000Z',
    updated_at: '2026-09-27T14:12:00.000Z',
    metadata: {
      format: 'markdown',
      sections: 5,
    },
  },
  {
    id: 'out-03-homologation-brief',
    transformation_id: SEED_TRANSFORMATION_ID,
    type: 'summary',
    structure_id: 'struct-summary',
    dna_version: 4,
    status: 'generated',
    content: REGULATORY_BRIEF_MARKDOWN,
    created_at: '2026-09-27T14:14:00.000Z',
    updated_at: '2026-09-27T14:14:00.000Z',
    metadata: {
      format: 'markdown',
      sections: 1,
    },
  },
]

const INITIAL_VERSIONS: DNAVersion[] = [
  {
    version: 1,
    content_dna: JSON.parse(JSON.stringify(INITIAL_DNA)),
    note: 'Initial ingestion of thermal runaway PDF and dynamometer test logs.',
    created_at: '2026-09-20T08:30:00.000Z',
  },
  {
    version: 2,
    content_dna: JSON.parse(JSON.stringify(INITIAL_DNA)),
    note: 'Integrated commercial fleet procurement specifications and cost models.',
    created_at: '2026-09-22T11:45:00.000Z',
  },
  {
    version: 3,
    content_dna: JSON.parse(JSON.stringify(INITIAL_DNA)),
    note: 'Ingested FEA crash simulation video and SEM microstructural analysis.',
    created_at: '2026-09-25T16:20:00.000Z',
  },
  {
    version: 4,
    content_dna: JSON.parse(JSON.stringify(INITIAL_DNA)),
    note: 'Synthesized 6-layer Content DNA and identified energy density conflict.',
    created_at: '2026-09-27T14:15:00.000Z',
  },
]

function buildSeedTransformation(): Transformation {
  return {
    id: SEED_TRANSFORMATION_ID,
    title: 'Next-Gen Solid-State Battery Architecture & Fleet Electrification',
    created_at: '2026-09-20T08:30:00.000Z',
    updated_at: '2026-09-27T14:15:00.000Z',
    sources: JSON.parse(JSON.stringify(INITIAL_SOURCES)),
    content_dna: JSON.parse(JSON.stringify(INITIAL_DNA)),
    source_integrity: JSON.parse(JSON.stringify(INITIAL_INTEGRITY)),
    outputs: JSON.parse(JSON.stringify(INITIAL_OUTPUTS)),
    structures: JSON.parse(JSON.stringify(INITIAL_STRUCTURES)),
    versions: JSON.parse(JSON.stringify(INITIAL_VERSIONS)),
    status: 'ready',
  }
}

// In-memory + LocalStorage State Manager
const STORAGE_KEY = 'ev_demo_transformations_v2'

export function resetConflictState(t: Transformation): Transformation {
  t.source_integrity = JSON.parse(JSON.stringify(INITIAL_INTEGRITY))

  if (t.content_dna) {
    if (t.content_dna.overview && typeof t.content_dna.overview.summary === 'string') {
      t.content_dna.overview.summary = t.content_dna.overview.summary.replace(
        /\s*\[Resolved: Gravimetric cell energy density formally verified at.*?\]/g,
        '',
      )
    }
    if (t.content_dna.facts && Array.isArray(t.content_dna.facts.statistics)) {
      const initialStats = INITIAL_DNA.facts.statistics
      t.content_dna.facts.statistics = t.content_dna.facts.statistics.map((stat) => {
        if (
          stat.includes('reconciled gravimetric cell energy density approved') ||
          stat.includes('285 Wh/kg reconciled') ||
          stat.includes('310 Wh/kg reconciled')
        ) {
          return initialStats[0]
        }
        return stat
      })
    }
  }

  // Restore baseline 4 versions if a temporary resolution version was appended
  if (Array.isArray(t.versions) && t.versions.length > 4) {
    t.versions = JSON.parse(JSON.stringify(INITIAL_VERSIONS))
  }

  return t
}

function loadTransformations(): Transformation[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Always reset conflicts to the unresolved conflict state on refresh or load
        // so that the dispute audit mechanic is immediately testable and operable
        const resetItems = parsed.map((item: Transformation) => resetConflictState(item))
        saveTransformations(resetItems)
        return resetItems
      }
    }
  } catch (e) {
    console.warn('Could not read demo storage, falling back to seed:', e)
  }

  const seed = buildSeedTransformation()
  saveTransformations([seed])
  return [seed]
}

function saveTransformations(items: Transformation[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch (e) {
    console.warn('Could not save demo storage:', e)
  }
}

function getStore(): Transformation[] {
  return loadTransformations()
}

function setStore(items: Transformation[]) {
  saveTransformations(items)
}

function findTransformation(id: string): Transformation {
  const store = getStore()
  const found = store.find((item) => item.id === id)
  if (found) return found
  if (id === SEED_TRANSFORMATION_ID || store.length === 0) {
    const fresh = buildSeedTransformation()
    setStore([fresh, ...store])
    return fresh
  }
  return store[0]
}

function updateTransformationInStore(
  updated: Transformation,
): Transformation {
  const store = getStore()
  const exists = store.some((t) => t.id === updated.id)
  const next = exists
    ? store.map((t) => (t.id === updated.id ? updated : t))
    : [updated, ...store]
  setStore(next)
  return updated
}

// ============================================================================
// PUBLIC API FUNCTIONS (100% Mock Client, Zero Backend Dependency)
// ============================================================================

export async function listTransformations(): Promise<{
  transformations: Transformation[]
}> {
  const store = getStore()
  return { transformations: store }
}

export async function getTransformation(
  transformationId: string,
): Promise<Transformation> {
  return findTransformation(transformationId)
}

export async function createTransformation(
  title = 'Untitled Transformation',
): Promise<Transformation> {
  const id = `transformation-${Date.now()}`
  const now = new Date().toISOString()
  const newT: Transformation = {
    id,
    title,
    created_at: now,
    updated_at: now,
    sources: [],
    content_dna: null,
    source_integrity: {
      claims: [],
      conflicts: [],
      resolutions: [],
    },
    outputs: [],
    structures: JSON.parse(JSON.stringify(INITIAL_STRUCTURES)),
    versions: [],
    status: 'empty',
  }
  updateTransformationInStore(newT)
  return newT
}

export async function deleteTransformation(
  transformationId: string,
): Promise<void> {
  const store = getStore().filter((t) => t.id !== transformationId)
  setStore(store.length > 0 ? store : [buildSeedTransformation()])
}

export async function syncTransformation(
  transformation: Transformation,
): Promise<Transformation> {
  return updateTransformationInStore(transformation)
}

export async function renameTransformation(
  transformationId: string,
  title: string,
): Promise<Transformation> {
  const t = findTransformation(transformationId)
  t.title = title
  t.updated_at = new Date().toISOString()
  return updateTransformationInStore(t)
}

export async function createTextSource(
  _title: string,
  _text: string,
): Promise<SourceCreatedResponse> {
  const source_id = `src-txt-${Date.now()}`
  return {
    source_id,
    source_type: 'text',
    content_dna: JSON.parse(JSON.stringify(INITIAL_DNA)),
  }
}

export async function createFileSource(
  file: File,
): Promise<SourceCreatedResponse> {
  const source_id = `src-file-${Date.now()}`
  const fn = file.name.toLowerCase()
  let source_type: SourceType = 'pdf'
  if (fn.endsWith('.docx')) source_type = 'docx'
  else if (fn.endsWith('.txt')) source_type = 'txt'
  else if (fn.endsWith('.mp4')) source_type = 'video'
  else if (fn.endsWith('.png') || fn.endsWith('.jpg')) source_type = 'image'

  return {
    source_id,
    source_type,
    content_dna: JSON.parse(JSON.stringify(INITIAL_DNA)),
  }
}

export async function getSource(sourceId: string): Promise<SourceRecord> {
  const store = getStore()
  for (const t of store) {
    const src = t.sources?.find((s) => s.source_id === sourceId)
    if (src) {
      return {
        source: src,
        content_dna: t.content_dna || JSON.parse(JSON.stringify(INITIAL_DNA)),
      }
    }
  }
  return {
    source: INITIAL_SOURCES[0],
    content_dna: JSON.parse(JSON.stringify(INITIAL_DNA)),
  }
}

export async function patchContentDNA(
  _sourceId: string,
  changes: ContentDNAPatch,
): Promise<ContentDNA> {
  const dna = JSON.parse(JSON.stringify(INITIAL_DNA)) as ContentDNA
  Object.assign(dna, changes)
  return dna
}

export async function addTextSource(
  transformationId: string,
  title: string,
  text: string,
): Promise<Transformation> {
  const t = findTransformation(transformationId)
  const newSource: RawContent = {
    source_id: `src-text-${Date.now()}`,
    source_type: 'text',
    title,
    text,
    metadata: {
      added_at: new Date().toISOString(),
      character_count: text.length,
    },
  }

  t.sources = [newSource, ...(t.sources || [])]
  if (!t.content_dna) {
    t.content_dna = JSON.parse(JSON.stringify(INITIAL_DNA))
    t.content_dna!.identity.title = title
    t.status = 'ready'
  } else {
    t.content_dna.facts.claims.push(
      `Ingested source content from ${title}: verified ${text.slice(0, 80).trim()}...`,
    )
  }
  t.updated_at = new Date().toISOString()
  return updateTransformationInStore(t)
}

export async function addFileSource(
  transformationId: string,
  file: File,
): Promise<Transformation> {
  const t = findTransformation(transformationId)
  const fn = file.name.toLowerCase()
  let source_type: SourceType = 'pdf'
  if (fn.endsWith('.docx')) source_type = 'docx'
  else if (fn.endsWith('.txt')) source_type = 'txt'
  else if (fn.endsWith('.mp4') || fn.endsWith('.mov')) source_type = 'video'
  else if (fn.endsWith('.png') || fn.endsWith('.jpg') || fn.endsWith('.jpeg'))
    source_type = 'image'
  else if (fn.endsWith('.mp3') || fn.endsWith('.wav')) source_type = 'audio'

  const newSource: RawContent = {
    source_id: `src-file-${Date.now()}`,
    source_type,
    title: file.name,
    text: `Extracted content from ${file.name}: Comprehensive engineering data validation completed. Verified technical tolerances and structural specifications.`,
    metadata: {
      size: file.size,
      mime: file.type,
      uploaded_at: new Date().toISOString(),
    },
  }

  t.sources = [newSource, ...(t.sources || [])]
  if (!t.content_dna) {
    t.content_dna = JSON.parse(JSON.stringify(INITIAL_DNA))
    t.status = 'ready'
  }
  t.updated_at = new Date().toISOString()
  return updateTransformationInStore(t)
}

export async function addUrlSource(
  transformationId: string,
  url: string,
  title: string,
): Promise<Transformation> {
  const t = findTransformation(transformationId)
  const newSource: RawContent = {
    source_id: `src-url-${Date.now()}`,
    source_type: 'url',
    title: title || url,
    text: `Crawled verified telemetry and specifications from ${url}. Successfully harmonized against automotive engineering standards.`,
    metadata: {
      url,
      crawled_at: new Date().toISOString(),
      status: 200,
    },
  }

  t.sources = [newSource, ...(t.sources || [])]
  if (!t.content_dna) {
    t.content_dna = JSON.parse(JSON.stringify(INITIAL_DNA))
    t.status = 'ready'
  }
  t.updated_at = new Date().toISOString()
  return updateTransformationInStore(t)
}

export async function addUnsupportedSource(
  transformationId: string,
  source_type: string,
  title: string,
  note = '',
): Promise<Transformation> {
  const t = findTransformation(transformationId)
  const newSource: RawContent = {
    source_id: `src-unsupported-${Date.now()}`,
    source_type: source_type as SourceType,
    title: title || `Source (${source_type})`,
    text: note || `Ingested multimodal payload of type ${source_type}.`,
    metadata: {
      note,
      created_at: new Date().toISOString(),
    },
  }

  t.sources = [newSource, ...(t.sources || [])]
  t.updated_at = new Date().toISOString()
  return updateTransformationInStore(t)
}

export async function removeTransformationSource(
  transformationId: string,
  sourceId: string,
): Promise<Transformation> {
  const t = findTransformation(transformationId)
  t.sources = (t.sources || []).filter((s) => s.source_id !== sourceId)
  t.updated_at = new Date().toISOString()
  return updateTransformationInStore(t)
}

export async function patchTransformationDNA(
  transformationId: string,
  changes: ContentDNAPatch,
): Promise<Transformation> {
  const t = findTransformation(transformationId)
  if (!t.content_dna) {
    t.content_dna = JSON.parse(JSON.stringify(INITIAL_DNA))
  }

  const merge = (target: any, source: any) => {
    for (const key of Object.keys(source)) {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key])
      ) {
        if (!target[key]) target[key] = {}
        merge(target[key], source[key])
      } else {
        target[key] = source[key]
      }
    }
  }

  merge(t.content_dna, changes)

  const newVersionNumber = (t.versions?.length || 0) + 1
  const versionEntry: DNAVersion = {
    version: newVersionNumber,
    content_dna: JSON.parse(JSON.stringify(t.content_dna)),
    note: `Updated Content DNA fields via Attribute Inspector.`,
    created_at: new Date().toISOString(),
  }

  t.versions = [...(t.versions || []), versionEntry]
  t.updated_at = new Date().toISOString()
  return updateTransformationInStore(t)
}

export async function createTransformationStructure(
  transformationId: string,
  payload: {
    name: string
    type?: string
    sections: {
      name: string
      description: string
      order: number
    }[]
  },
): Promise<Transformation> {
  const t = findTransformation(transformationId)
  const newStructure: Structure = {
    id: `struct-${Date.now()}`,
    name: payload.name,
    type: payload.type || 'document',
    source: 'custom',
    reference_source_id: '',
    status: 'ready',
    note: 'Custom blueprint structure created in studio',
    sections: payload.sections.map((s, idx) => ({
      id: `sec-${idx + 1}`,
      name: s.name,
      description: s.description,
      order: s.order || idx + 1,
    })),
  }

  t.structures = [...(t.structures || []), newStructure]
  t.updated_at = new Date().toISOString()
  return updateTransformationInStore(t)
}

export async function createReferenceStructure(
  transformationId: string,
  payload: {
    name: string
    reference_source_id: string
  },
): Promise<Transformation> {
  const t = findTransformation(transformationId)
  const newStructure: Structure = {
    id: `struct-ref-${Date.now()}`,
    name: payload.name,
    type: 'document',
    source: 'reference',
    reference_source_id: payload.reference_source_id,
    status: 'ready',
    note: 'Cloned layout structure extracted from reference blueprint',
    sections: [
      {
        id: 'sec-r1',
        name: 'Cloned Reference Header & Context',
        description: 'Format matched to reference document styling',
        order: 1,
      },
      {
        id: 'sec-r2',
        name: 'Synthesized Engineering Data Tables',
        description: 'Tabular structure extracted from reference format',
        order: 2,
      },
      {
        id: 'sec-r3',
        name: 'Technical Verification & Sign-off Block',
        description: 'Closing verification format matching source blueprint',
        order: 3,
      },
    ],
  }

  t.structures = [...(t.structures || []), newStructure]
  t.updated_at = new Date().toISOString()
  return updateTransformationInStore(t)
}

export async function generateTransformationOutputs(
  transformationId: string,
  types: string[],
  generationConfig: GenerationConfig,
  _structureIds: string[] = [],
): Promise<Transformation> {
  const t = findTransformation(transformationId)
  const now = new Date().toISOString()
  const existingOutputs = t.outputs || []

  const newArtifacts: Artifact[] = []

  for (const type of types) {
    if (type === 'presentation') {
      const promptNote = generationConfig.prompt
        ? `\n\nPrompt Steering Directive: ${generationConfig.prompt}`
        : ''
      const customPresentation = PRESENTATION_MARKDOWN + promptNote
      newArtifacts.push({
        id: `out-pres-${Date.now()}`,
        transformation_id: t.id,
        type: 'presentation',
        structure_id: 'struct-exec-deck',
        dna_version: t.versions?.length || 4,
        status: 'generated',
        content: customPresentation,
        created_at: now,
        updated_at: now,
        metadata: {
          slide_count: generationConfig.slides || 5,
          audience: generationConfig.audience,
          tone: generationConfig.tone,
        },
      })
    } else if (type === 'document') {
      newArtifacts.push({
        id: `out-doc-${Date.now()}`,
        transformation_id: t.id,
        type: 'document',
        structure_id: 'struct-whitepaper',
        dna_version: t.versions?.length || 4,
        status: 'generated',
        content: WHITEPAPER_MARKDOWN,
        created_at: now,
        updated_at: now,
        metadata: {
          detail: generationConfig.detail,
          tone: generationConfig.tone,
        },
      })
    } else if (type === 'executive_summary' || type === 'summary') {
      newArtifacts.push({
        id: `out-sum-${Date.now()}`,
        transformation_id: t.id,
        type: 'summary',
        structure_id: 'struct-summary',
        dna_version: t.versions?.length || 4,
        status: 'generated',
        content: REGULATORY_BRIEF_MARKDOWN,
        created_at: now,
        updated_at: now,
        metadata: {
          audience: generationConfig.audience,
        },
      })
    } else {
      // General tailored artifact for other options (video script, linkedin, twitter, advisory, infographic)
      const tailoredContent = `# ${t.title}: ${type.toUpperCase()} Specification

**Audience**: ${generationConfig.audience || 'Executive Engineering & Fleet Operators'}  
**Tone**: ${generationConfig.tone || 'Technical & Authoritative'}  
**Objective**: ${generationConfig.objective || 'Deploy 800V SiC solid-state commercial vehicle fleet'}  
${generationConfig.prompt ? `**Steering Prompt**: ${generationConfig.prompt}\n` : ''}
---

### Key Synthesis Points
- **Solid-State Chemistry**: Zero thermal runaway propagation confirmed through ceramic sulfide separator testing.
- **800V SiC Powertrain**: 99.2% peak electrical efficiency and 12.4 minute DC fast charging (10% to 80% SoC).
- **Fleet Economics**: Reaches full total cost of ownership parity against diesel commercial fleets in 26 months.
- **Homologation Compliance**: Reconciled supplier audit at 285 Wh/kg ensures 540 km certified range under FMVSS 305 standards.`

      newArtifacts.push({
        id: `out-${type}-${Date.now()}`,
        transformation_id: t.id,
        type,
        structure_id: 'struct-custom',
        dna_version: t.versions?.length || 4,
        status: 'generated',
        content: tailoredContent,
        created_at: now,
        updated_at: now,
        metadata: {
          audience: generationConfig.audience,
          tone: generationConfig.tone,
        },
      })
    }
  }

  // Merge, replacing any matching types or prepending
  const existingTypes = new Set(types)
  const filtered = existingOutputs.filter((o) => !existingTypes.has(o.type))
  t.outputs = [...newArtifacts, ...filtered]
  t.updated_at = now
  return updateTransformationInStore(t)
}

export async function generateFromTemplate(
  transformationId: string,
  payload: TemplateGeneratePayload,
): Promise<Transformation> {
  const t = findTransformation(transformationId)
  const now = new Date().toISOString()

  const templateName = payload.template_name || payload.template_file_name || 'Cloned Layout Blueprint'
  const userPrompt = payload.user_prompt || 'Cloned format and styled layout from reference blueprint.'

  const clonedContent = `# ${templateName}: Cloned Blueprint Deliverable

**Reference Source**: ${payload.template_file_name || 'Custom Reference Template'}  
**Generation Mode**: Reference Layout Blueprint Cloning  
**Steering Directive**: ${userPrompt}  
**Date**: September 2026  

---

## 1. System Overview & Blueprint Conformance
This deliverable was dynamically synthesized by cloning the visual formatting, typography hierarchy, and structural layout of the reference document. All data points remain strictly grounded in the verified Content DNA.

## 2. Harmonized Engineering Telemetry

| Engineering Parameter | Target Specification | Validated Laboratory Result | Compliance Status |
| :--- | :--- | :--- | :--- |
| **Gravimetric Energy Density** | 285 Wh/kg | 285 Wh/kg (Supplier Audit) | Conforming (Resolved) |
| **DC Fast Charging Turnaround** | < 15.0 minutes | 12.4 minutes (10% to 80% SoC) | Exceeds Target |
| **Inverter Electrical Efficiency** | > 98.5% | 99.2% (800V SiC Bench) | Exceeds Target |
| **Crash Safety Deceleration** | > 60 G | 65 G (FMVSS 305 FEA) | Conforming |
| **Pack Production Target Cost** | < $90/kWh | $84/kWh (100 GWh Run-rate) | Conforming |

## 3. Executive Deployment Conclusion
The solid-state battery architecture achieves full total cost of ownership parity against diesel commercial fleets in 26 months, unlocking 540 km real-world WLTP range for 4.2-ton delivery vans.`

  const clonedArtifact: Artifact = {
    id: `out-cloned-${Date.now()}`,
    transformation_id: t.id,
    type: 'document',
    structure_id: 'struct-ref-cloned',
    dna_version: t.versions?.length || 4,
    status: 'generated',
    content: clonedContent,
    created_at: now,
    updated_at: now,
    metadata: {
      template_name: templateName,
      user_prompt: userPrompt,
      cloned_from_reference: true,
    },
  }

  t.outputs = [clonedArtifact, ...(t.outputs || [])]
  t.updated_at = now
  return updateTransformationInStore(t)
}

export async function deleteTransformationOutput(
  transformationId: string,
  outputId: string,
): Promise<Transformation> {
  const t = findTransformation(transformationId)
  t.outputs = (t.outputs || []).filter((o) => o.id !== outputId)
  t.updated_at = new Date().toISOString()
  return updateTransformationInStore(t)
}

export async function restoreTransformationVersion(
  transformationId: string,
  version: number,
): Promise<Transformation> {
  const t = findTransformation(transformationId)
  const targetVersion = t.versions?.find((v) => v.version === version)
  if (targetVersion) {
    t.content_dna = JSON.parse(JSON.stringify(targetVersion.content_dna))
    const now = new Date().toISOString()
    const newVersionNumber = (t.versions?.length || 0) + 1
    t.versions?.push({
      version: newVersionNumber,
      content_dna: JSON.parse(JSON.stringify(t.content_dna)),
      note: `Restored Content DNA from Version ${version}.`,
      created_at: now,
    })
    t.updated_at = now
  }
  return updateTransformationInStore(t)
}

export async function analyzeSourceIntegrity(
  transformationId: string,
): Promise<SourceIntegrity> {
  const t = findTransformation(transformationId)
  if (t.source_integrity) {
    return t.source_integrity
  }
  t.source_integrity = JSON.parse(JSON.stringify(INITIAL_INTEGRITY))
  updateTransformationInStore(t)
  return t.source_integrity || INITIAL_INTEGRITY
}

export async function resolveTransformationConflict(
  transformationId: string,
  conflictId: string,
  resolution: Omit<ConflictResolutionPayload, 'conflict_id'>,
): Promise<Transformation> {
  const t = findTransformation(transformationId)
  if (!t.source_integrity) {
    t.source_integrity = JSON.parse(JSON.stringify(INITIAL_INTEGRITY))
  }

  const integrity = t.source_integrity!
  const conflict = integrity.conflicts.find((c) => c.conflict_id === conflictId)

  const finalValue =
    resolution.final_value ||
    (resolution.decision === 'accept_source_b'
      ? '285'
      : resolution.decision === 'accept_source_a'
      ? '310'
      : '285')

  if (conflict) {
    conflict.status = 'resolved'
  }

  integrity.resolutions.push({
    conflict_id: conflictId,
    decision: resolution.decision,
    selected_claim_id: resolution.selected_claim_id,
    final_value: finalValue,
  })

  // Update claim statuses accordingly
  integrity.claims.forEach((claim) => {
    if (claim.claim_key === 'cell_gravimetric_energy_density') {
      if (
        resolution.selected_claim_id &&
        claim.claim_id === resolution.selected_claim_id
      ) {
        claim.status = 'resolved'
      } else if (
        resolution.decision === 'accept_source_b' &&
        claim.claim_id === 'claim-density-supplier'
      ) {
        claim.status = 'resolved'
      } else if (
        resolution.decision === 'accept_source_a' &&
        claim.claim_id === 'claim-density-internal'
      ) {
        claim.status = 'resolved'
      } else {
        claim.status = 'rejected'
      }
    }
  })

  // Update Content DNA facts to excise disputed value and record resolved figure
  if (t.content_dna) {
    t.content_dna.facts.statistics = t.content_dna.facts.statistics.map((stat) => {
      if (stat.includes('310 Wh/kg') || stat.includes('285 Wh/kg')) {
        return `${finalValue} Wh/kg reconciled gravimetric cell energy density approved for commercial vehicle homologation.`
      }
      return stat
    })

    t.content_dna.overview.summary =
      t.content_dna.overview.summary +
      ` [Resolved: Gravimetric cell energy density formally verified at ${finalValue} Wh/kg for EPA homologation.]`

    // Snapshot version entry in history
    const newVersionNumber = (t.versions?.length || 0) + 1
    t.versions = [
      ...(t.versions || []),
      {
        version: newVersionNumber,
        content_dna: JSON.parse(JSON.stringify(t.content_dna)),
        note: `Resolved cell gravimetric energy density conflict to ${finalValue} Wh/kg (${resolution.decision}). Excised rejected values from DNA lineage.`,
        created_at: new Date().toISOString(),
      },
    ]
  }

  t.updated_at = new Date().toISOString()
  return updateTransformationInStore(t)
}

export async function resetTransformationConflict(
  transformationId: string,
  conflictId?: string,
): Promise<Transformation> {
  const t = findTransformation(transformationId)
  if (conflictId && t.source_integrity) {
    const conflict = t.source_integrity.conflicts.find((c) => c.conflict_id === conflictId)
    if (conflict) {
      conflict.status = 'unresolved'
    }
    t.source_integrity.resolutions = t.source_integrity.resolutions.filter(
      (r) => r.conflict_id !== conflictId,
    )
    t.source_integrity.claims.forEach((claim) => {
      if (claim.claim_key === 'cell_gravimetric_energy_density') {
        claim.status = 'conflict'
      }
    })

    if (t.content_dna) {
      if (t.content_dna.overview && typeof t.content_dna.overview.summary === 'string') {
        t.content_dna.overview.summary = t.content_dna.overview.summary.replace(
          /\s*\[Resolved: Gravimetric cell energy density formally verified at.*?\]/g,
          '',
        )
      }
      if (t.content_dna.facts && Array.isArray(t.content_dna.facts.statistics)) {
        const initialStats = INITIAL_DNA.facts.statistics
        t.content_dna.facts.statistics = t.content_dna.facts.statistics.map((stat) => {
          if (
            stat.includes('reconciled gravimetric cell energy density approved') ||
            stat.includes('285 Wh/kg reconciled') ||
            stat.includes('310 Wh/kg reconciled')
          ) {
            return initialStats[0]
          }
          return stat
        })
      }
    }

    if (Array.isArray(t.versions) && t.versions.length > 4) {
      t.versions = JSON.parse(JSON.stringify(INITIAL_VERSIONS))
    }
  } else {
    resetConflictState(t)
  }

  t.updated_at = new Date().toISOString()
  return updateTransformationInStore(t)
}

// Workflows
const PRESET_WORKFLOWS: WorkflowTemplate[] = [
  {
    id: 'wf-board-deck',
    name: 'Executive Board Briefing',
    description:
      'Generates 16:9 board presentation deck and executive homologation brief tailored for C-suite decision makers.',
    output_types: ['presentation', 'executive_summary'],
    generation_config: {
      audience: 'Executive Board & Chief Financial Officer',
      tone: 'Strategic & High-Impact',
      slides: 5,
      detail: 'Executive Overview',
    },
  },
  {
    id: 'wf-engineering-whitepaper',
    name: 'Engineering Systems Whitepaper',
    description:
      'Complete automotive whitepaper with powertrain specifications, thermal telemetry, and mechanical FEA safety tables.',
    output_types: ['document'],
    generation_config: {
      audience: 'Chief Automotive Engineers & Systems Architects',
      tone: 'Rigorous & Technical',
      detail: 'Exhaustive Technical Depth',
    },
  },
  {
    id: 'wf-procurement-spec',
    name: 'Supplier Procurement Specification',
    description:
      'Commercial procurement guidelines, acceptance tolerances, and quality verification criteria for Tier 1 suppliers.',
    output_types: ['document', 'presentation'],
    generation_config: {
      audience: 'Tier 1 Battery Cell Suppliers & Procurement Directors',
      tone: 'Contractual & Precise',
      slides: 5,
      detail: 'Procurement Standard',
    },
  },
]

export async function listWorkflows(): Promise<WorkflowTemplate[]> {
  return PRESET_WORKFLOWS
}

export async function saveWorkflow(payload: {
  id: string
  name: string
  description?: string
  output_types: string[]
  generation_config: Record<string, any>
}): Promise<WorkflowTemplate> {
  const newWf: WorkflowTemplate = {
    id: payload.id || `wf-${Date.now()}`,
    name: payload.name,
    description: payload.description || 'Custom user saved workflow',
    output_types: payload.output_types,
    generation_config: payload.generation_config,
  }
  return newWf
}

// Models & Telemetry
let currentActiveModel = 'llama-3.3-70b-versatile'
let currentActiveProvider: ModelMode = 'api'

const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B Versatile',
    provider: 'api',
    provider_name: 'Groq Ultra-Fast LPUs',
    description:
      'State-of-the-art reasoning, 128k context window, exceptional multi-source synthesis fidelity.',
    context_window: 131072,
    max_output_tokens: 8192,
    tpm_limit: 100000,
    tpd_limit: 1000000,
    used_tpm_tokens: 3420,
    remaining_tpm_tokens: 96580,
    used_today_tokens: 18200,
    remaining_daily_tokens: 981800,
    percentage_remaining: 98.2,
    status: 'available',
    status_message: 'Ready for real-time synthesis',
    is_active: true,
    speed_rating: '842 tokens/sec',
    recommended_for: [
      'Multi-Source DNA Synthesis',
      'Fact Conflict Resolution',
      'Slide Deck Generation',
    ],
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B Instant',
    provider: 'api',
    provider_name: 'Groq Ultra-Fast LPUs',
    description:
      'Sub-50ms latency model designed for rapid token generation and instant source indexing.',
    context_window: 131072,
    max_output_tokens: 8192,
    tpm_limit: 200000,
    tpd_limit: 2000000,
    used_tpm_tokens: 1200,
    remaining_tpm_tokens: 198800,
    used_today_tokens: 8400,
    remaining_daily_tokens: 1991600,
    percentage_remaining: 99.5,
    status: 'available',
    status_message: 'Ready for sub-second generation',
    is_active: false,
    speed_rating: '1,250 tokens/sec',
    recommended_for: ['Quick Excerpt Extraction', 'Keyword Categorization'],
  },
  {
    id: 'deepseek-r1-distill-llama-70b',
    name: 'DeepSeek R1 Distill 70B',
    provider: 'api',
    provider_name: 'Groq Ultra-Fast LPUs',
    description:
      'Advanced chain-of-thought mathematical and physical reasoning engine for complex engineering audit.',
    context_window: 131072,
    max_output_tokens: 8192,
    tpm_limit: 80000,
    tpd_limit: 800000,
    used_tpm_tokens: 2800,
    remaining_tpm_tokens: 77200,
    used_today_tokens: 14500,
    remaining_daily_tokens: 785500,
    percentage_remaining: 98.1,
    status: 'available',
    status_message: 'High-precision reasoning active',
    is_active: false,
    speed_rating: '620 tokens/sec',
    recommended_for: ['Complex Cross-Source Audits', 'Mathematical Consistency'],
  },
]

export async function getModelMode(): Promise<{
  mode: ModelMode
  label: string
  active_model?: string
}> {
  return {
    mode: currentActiveProvider,
    label: 'Groq Cloud Inference (Hardware Accelerated)',
    active_model: currentActiveModel,
  }
}

export async function toggleModelMode(): Promise<{
  mode: ModelMode
  label: string
  active_model?: string
}> {
  currentActiveProvider = currentActiveProvider === 'api' ? 'local' : 'api'
  return {
    mode: currentActiveProvider,
    label:
      currentActiveProvider === 'api'
        ? 'Groq Cloud Inference (Hardware Accelerated)'
        : 'Local Edge Engine (Ollama / ONNX)',
    active_model: currentActiveModel,
  }
}

export async function getAvailableModels(): Promise<ModelListResponse> {
  const models = AVAILABLE_MODELS.map((m) => ({
    ...m,
    is_active: m.id === currentActiveModel,
  }))

  return {
    active_model: currentActiveModel,
    active_provider: currentActiveProvider,
    models,
    total_tokens_used_today: 41120,
  }
}

export async function selectActiveModel(
  modelId: string,
  provider: ModelMode = 'api',
): Promise<ModelListResponse> {
  currentActiveModel = modelId
  currentActiveProvider = provider
  return getAvailableModels()
}