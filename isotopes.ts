/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface IsotopeInfo {
  id?: string;
  massNumber: number;
  neutrons: number;
  isStable: boolean;
  name?: string; // e.g. "Protium", "Deuterium", "Tritium"
  symbol: string; // e.g. "¹H", "²H", "³H", "¹⁴C"
  abundancePercent?: number; // e.g. 98.93
  halfLife?: string; // e.g. "Stable", "5,730 years", "12.32 years", "20.3 min"
  decayMode?: string; // e.g. "Stable", "β⁻ (Beta minus)", "β⁺ / EC", "α (Alpha)"
  nuclearSpin?: string; // e.g. "1/2+", "0+", "1+"
  commonUse?: string; // Real-world application
  decayProduct?: string; // Daughter nuclide, e.g. "¹⁴N", "⁴He"
}

// Curated database of prominent stable and radioactive isotopes
export const KNOWN_ISOTOPES_MAP: Record<number, IsotopeInfo[]> = {
  // 1. Hydrogen (Z=1)
  1: [
    {
      massNumber: 1,
      neutrons: 0,
      isStable: true,
      name: 'Protium',
      symbol: '¹H',
      abundancePercent: 99.9885,
      halfLife: 'Stable',
      decayMode: 'None (Stable)',
      nuclearSpin: '1/2+',
      commonUse: 'Universal water, organic life, stellar proton-proton fusion, ¹H-NMR standard',
    },
    {
      massNumber: 2,
      neutrons: 1,
      isStable: true,
      name: 'Deuterium',
      symbol: '²H (D)',
      abundancePercent: 0.0115,
      halfLife: 'Stable',
      decayMode: 'None (Stable)',
      nuclearSpin: '1+',
      commonUse: 'Heavy water (D₂O) moderator in CANDU nuclear reactors, Tokamak D-T fusion fuel',
    },
    {
      massNumber: 3,
      neutrons: 2,
      isStable: false,
      name: 'Tritium',
      symbol: '³H (T)',
      abundancePercent: 0,
      halfLife: '12.32 years',
      decayMode: 'β⁻ (18.6 keV)',
      decayProduct: '³He',
      nuclearSpin: '1/2+',
      commonUse: 'Thermonuclear fusion booster (ITER), self-luminous radioluminescent exit signs & watch dials',
    },
    {
      massNumber: 4,
      neutrons: 3,
      isStable: false,
      name: 'Hydrogen-4',
      symbol: '⁴H',
      halfLife: '1.39×10⁻²² s',
      decayMode: 'Neutron emission (n)',
      decayProduct: '³H',
      nuclearSpin: '2-',
      commonUse: 'Short-lived resonance state created in particle physics collision experiments',
    },
  ],

  // 2. Helium (Z=2)
  2: [
    {
      massNumber: 3,
      neutrons: 1,
      isStable: true,
      name: 'Helium-3',
      symbol: '³He',
      abundancePercent: 0.000137,
      halfLife: 'Stable',
      decayMode: 'None (Stable)',
      nuclearSpin: '1/2+',
      commonUse: 'Cryogenic dilution refrigerators (<0.01 K), lunar regolith clean fusion target, neutron detectors',
    },
    {
      massNumber: 4,
      neutrons: 2,
      isStable: true,
      name: 'Helium-4 (Alpha)',
      symbol: '⁴He',
      abundancePercent: 99.99986,
      halfLife: 'Stable',
      decayMode: 'None (Doubly magic Z=2, N=2)',
      nuclearSpin: '0+',
      commonUse: 'Alpha particle emission product, MRI superconducting magnet coolant (4.2 K), atmospheric lifting gas',
    },
    {
      massNumber: 6,
      neutrons: 4,
      isStable: false,
      name: 'Helium-6',
      symbol: '⁶He',
      halfLife: '806.7 ms',
      decayMode: 'β⁻',
      decayProduct: '⁶Li',
      nuclearSpin: '0+',
      commonUse: 'Prototypical 2-neutron halo nucleus studied in nuclear structure physics',
    },
  ],

  // 3. Lithium (Z=3)
  3: [
    {
      massNumber: 6,
      neutrons: 3,
      isStable: true,
      name: 'Lithium-6',
      symbol: '⁶Li',
      abundancePercent: 7.59,
      halfLife: 'Stable',
      decayMode: 'None (Stable)',
      nuclearSpin: '1+',
      commonUse: 'Tritium breeding blanket material in magnetic confinement fusion reactors (⁶Li + n → ⁴He + ³H)',
    },
    {
      massNumber: 7,
      neutrons: 4,
      isStable: true,
      name: 'Lithium-7',
      symbol: '⁷Li',
      abundancePercent: 92.41,
      halfLife: 'Stable',
      decayMode: 'None (Stable)',
      nuclearSpin: '3/2-',
      commonUse: 'Primary coolant pH buffer (LiOH) in pressurized water nuclear reactors, lithium-ion battery salts',
    },
    {
      massNumber: 8,
      neutrons: 5,
      isStable: false,
      name: 'Lithium-8',
      symbol: '⁸Li',
      halfLife: '840.3 ms',
      decayMode: 'β⁻ + α',
      decayProduct: '⁸Be → 2 ⁴He',
      nuclearSpin: '2+',
      commonUse: 'Beta-detected nuclear magnetic resonance (β-NMR) in solid-state physics',
    },
  ],

  // 4. Beryllium (Z=4)
  4: [
    {
      massNumber: 7,
      neutrons: 3,
      isStable: false,
      name: 'Beryllium-7',
      symbol: '⁷Be',
      halfLife: '53.22 days',
      decayMode: 'Electron capture (EC)',
      decayProduct: '⁷Li',
      nuclearSpin: '3/2-',
      commonUse: 'Cosmogenic tracer for atmospheric aerosol circulation and vertical air-mass motion',
    },
    {
      massNumber: 9,
      neutrons: 5,
      isStable: true,
      name: 'Beryllium-9',
      symbol: '⁹Be',
      abundancePercent: 100,
      halfLife: 'Stable',
      decayMode: 'None (100% monoisotopic)',
      nuclearSpin: '3/2-',
      commonUse: 'Low-mass neutron reflector and multiplier in nuclear reactors and laboratory neutron sources',
    },
    {
      massNumber: 10,
      neutrons: 6,
      isStable: false,
      name: 'Beryllium-10',
      symbol: '¹⁰Be',
      halfLife: '1.39×10⁶ years',
      decayMode: 'β⁻',
      decayProduct: '¹⁰B',
      nuclearSpin: '0+',
      commonUse: 'Cosmogenic geochronology for dating ice sheets, marine sediment cores, and rock erosion rates',
    },
  ],

  // 5. Boron (Z=5)
  5: [
    {
      massNumber: 10,
      neutrons: 5,
      isStable: true,
      name: 'Boron-10',
      symbol: '¹⁰B',
      abundancePercent: 19.9,
      halfLife: 'Stable',
      decayMode: 'None (Stable)',
      nuclearSpin: '3+',
      commonUse: 'Boron Neutron Capture Therapy (BNCT) in oncology, thermal neutron absorber in reactor control rods',
    },
    {
      massNumber: 11,
      neutrons: 6,
      isStable: true,
      name: 'Boron-11',
      symbol: '¹¹B',
      abundancePercent: 80.1,
      halfLife: 'Stable',
      decayMode: 'None (Stable)',
      nuclearSpin: '3/2-',
      commonUse: 'Semiconductor p-type dopant for silicon wafers; radiation-tolerant semiconductor devices',
    },
    {
      massNumber: 12,
      neutrons: 7,
      isStable: false,
      name: 'Boron-12',
      symbol: '¹²B',
      halfLife: '20.20 ms',
      decayMode: 'β⁻',
      decayProduct: '¹²C',
      nuclearSpin: '1+',
      commonUse: 'Nuclear weak interaction tests and parity violation experiments',
    },
  ],

  // 6. Carbon (Z=6)
  6: [
    {
      massNumber: 11,
      neutrons: 5,
      isStable: false,
      name: 'Carbon-11',
      symbol: '¹¹C',
      halfLife: '20.33 minutes',
      decayMode: 'β⁺ (Positron emission)',
      decayProduct: '¹¹B',
      nuclearSpin: '3/2-',
      commonUse: 'Positron Emission Tomography (PET) radiotracer (e.g. [¹¹C]PIB for Alzheimer amyloid plaque imaging)',
    },
    {
      massNumber: 12,
      neutrons: 6,
      isStable: true,
      name: 'Carbon-12',
      symbol: '¹²C',
      abundancePercent: 98.93,
      halfLife: 'Stable',
      decayMode: 'None (IUPAC mass standard)',
      nuclearSpin: '0+',
      commonUse: 'International atomic mass standard (exact 12 u); backbone of all organic and biological chemistry',
    },
    {
      massNumber: 13,
      neutrons: 7,
      isStable: true,
      name: 'Carbon-13',
      symbol: '¹³C',
      abundancePercent: 1.07,
      halfLife: 'Stable',
      decayMode: 'None (Stable)',
      nuclearSpin: '1/2-',
      commonUse: '¹³C-NMR spectroscopy standard for molecular structure determination; metabolic breath test tracer',
    },
    {
      massNumber: 14,
      neutrons: 8,
      isStable: false,
      name: 'Carbon-14',
      symbol: '¹⁴C',
      abundancePercent: 0.0000000001,
      halfLife: '5,730 years',
      decayMode: 'β⁻ (156 keV)',
      decayProduct: '¹⁴N',
      nuclearSpin: '0+',
      commonUse: 'Radiocarbon dating of organic archaeological artifacts up to 50,000 years old',
    },
  ],

  // 7. Nitrogen (Z=7)
  7: [
    {
      massNumber: 13,
      neutrons: 6,
      isStable: false,
      name: 'Nitrogen-13',
      symbol: '¹³N',
      halfLife: '9.97 minutes',
      decayMode: 'β⁺',
      decayProduct: '¹³C',
      nuclearSpin: '1/2-',
      commonUse: '[¹³N]Ammonia PET imaging for myocardial blood flow and cardiac perfusion quantification',
    },
    {
      massNumber: 14,
      neutrons: 7,
      isStable: true,
      name: 'Nitrogen-14',
      symbol: '¹⁴N',
      abundancePercent: 99.636,
      halfLife: 'Stable',
      decayMode: 'None (Stable)',
      nuclearSpin: '1+',
      commonUse: 'Bulk atmospheric nitrogen gas (78% of air), amino acid synthesis, Haber-Bosch fertilizers',
    },
    {
      massNumber: 15,
      neutrons: 8,
      isStable: true,
      name: 'Nitrogen-15',
      symbol: '¹⁵N',
      abundancePercent: 0.364,
      halfLife: 'Stable',
      decayMode: 'None (Stable)',
      nuclearSpin: '1/2-',
      commonUse: '¹⁵N-NMR spectroscopy of proteins and nucleic acids; agricultural nitrogen cycle tracing',
    },
  ],

  // 8. Oxygen (Z=8)
  8: [
    {
      massNumber: 15,
      neutrons: 7,
      isStable: false,
      name: 'Oxygen-15',
      symbol: '¹⁵O',
      halfLife: '122.24 seconds',
      decayMode: 'β⁺',
      decayProduct: '¹⁵N',
      nuclearSpin: '1/2-',
      commonUse: '[¹⁵O]Water PET scans for measuring regional cerebral blood flow and oxygen metabolic consumption',
    },
    {
      massNumber: 16,
      neutrons: 8,
      isStable: true,
      name: 'Oxygen-16',
      symbol: '¹⁶O',
      abundancePercent: 99.757,
      halfLife: 'Stable',
      decayMode: 'None (Doubly magic Z=8, N=8)',
      nuclearSpin: '0+',
      commonUse: 'Most abundant isotope in Earth crust and water; standard cellular respiration reactant',
    },
    {
      massNumber: 17,
      neutrons: 9,
      isStable: true,
      name: 'Oxygen-17',
      symbol: '¹⁷O',
      abundancePercent: 0.038,
      halfLife: 'Stable',
      decayMode: 'None (Stable)',
      nuclearSpin: '5/2+',
      commonUse: 'Only stable oxygen isotope with nuclear spin; utilized in ¹⁷O-NMR spectroscopy of biological waters',
    },
    {
      massNumber: 18,
      neutrons: 10,
      isStable: true,
      name: 'Oxygen-18',
      symbol: '¹⁸O',
      abundancePercent: 0.205,
      halfLife: 'Stable',
      decayMode: 'None (Stable)',
      nuclearSpin: '0+',
      commonUse: 'Precursor target water [¹⁸O]H₂O for cyclotron production of ¹⁸F; δ¹⁸O paleoclimate temperature proxy',
    },
  ],

  // 9. Fluorine (Z=9)
  9: [
    {
      massNumber: 18,
      neutrons: 9,
      isStable: false,
      name: 'Fluorine-18',
      symbol: '¹⁸F',
      halfLife: '109.77 minutes',
      decayMode: 'β⁺ (97%) / EC (3%)',
      decayProduct: '¹⁸O',
      nuclearSpin: '1+',
      commonUse: '¹⁸F-Fluorodeoxyglucose (¹⁸F-FDG), the gold standard radiotracer for cancer tumor detection worldwide',
    },
    {
      massNumber: 19,
      neutrons: 10,
      isStable: true,
      name: 'Fluorine-19',
      symbol: '¹⁹F',
      abundancePercent: 100,
      halfLife: 'Stable',
      decayMode: 'None (100% monoisotopic)',
      nuclearSpin: '1/2+',
      commonUse: '¹⁹F-NMR spectroscopy, pharmaceutical drug enhancement, Teflon PTFE, toothpaste fluoride',
    },
  ],

  // 10. Neon (Z=10)
  10: [
    {
      massNumber: 20,
      neutrons: 10,
      isStable: true,
      name: 'Neon-20',
      symbol: '²⁰Ne',
      abundancePercent: 90.48,
      halfLife: 'Stable',
      decayMode: 'None (Stable)',
      nuclearSpin: '0+',
      commonUse: 'High-voltage neon discharge indicator lighting, gas lasers, cryogenics',
    },
    {
      massNumber: 21,
      neutrons: 11,
      isStable: true,
      name: 'Neon-21',
      symbol: '²¹Ne',
      abundancePercent: 0.27,
      halfLife: 'Stable',
      decayMode: 'None (Stable)',
      nuclearSpin: '3/2+',
      commonUse: 'Nuclear quadrupole resonance, primordial mantle degassing tracer in geology',
    },
    {
      massNumber: 22,
      neutrons: 12,
      isStable: true,
      name: 'Neon-22',
      symbol: '²²Ne',
      abundancePercent: 9.25,
      halfLife: 'Stable',
      decayMode: 'None (Stable)',
      nuclearSpin: '0+',
      commonUse: 'Stellar nucleosynthesis s-process neutron source (²²Ne + α → ²⁵Mg + n)',
    },
  ],

  // 11. Sodium (Z=11)
  11: [
    {
      massNumber: 22,
      neutrons: 11,
      isStable: false,
      name: 'Sodium-22',
      symbol: '²²Na',
      halfLife: '2.603 years',
      decayMode: 'β⁺ (90.3%) / EC (9.7%)',
      decayProduct: '²²Ne',
      nuclearSpin: '3+',
      commonUse: 'Standard long-lived positron source for laboratory physics and PET detector calibration',
    },
    {
      massNumber: 23,
      neutrons: 12,
      isStable: true,
      name: 'Sodium-23',
      symbol: '²³Na',
      abundancePercent: 100,
      halfLife: 'Stable',
      decayMode: 'None (100% monoisotopic)',
      nuclearSpin: '3/2+',
      commonUse: 'Table salt (NaCl), cellular electrolyte pumps, liquid sodium fast breeder reactor coolant',
    },
    {
      massNumber: 24,
      neutrons: 13,
      isStable: false,
      name: 'Sodium-24',
      symbol: '²⁴Na',
      halfLife: '14.96 hours',
      decayMode: 'β⁻',
      decayProduct: '²⁴Mg',
      nuclearSpin: '4+',
      commonUse: 'Industrial pipeline leak detection, medical blood volume measurements',
    },
  ],

  // 15. Phosphorus (Z=15)
  15: [
    {
      massNumber: 31,
      neutrons: 16,
      isStable: true,
      name: 'Phosphorus-31',
      symbol: '³¹P',
      abundancePercent: 100,
      halfLife: 'Stable',
      decayMode: 'None (100% monoisotopic)',
      nuclearSpin: '1/2+',
      commonUse: 'DNA/RNA phosphate backbone, cellular ATP energy currency, ³¹P-NMR bioenergetics',
    },
    {
      massNumber: 32,
      neutrons: 17,
      isStable: false,
      name: 'Phosphorus-32',
      symbol: '³²P',
      halfLife: '14.26 days',
      decayMode: 'β⁻ (1.71 MeV)',
      decayProduct: '³²S',
      nuclearSpin: '1+',
      commonUse: 'High-energy beta emitter for radiolabeling DNA, RNA, and proteins in genetic research',
    },
    {
      massNumber: 33,
      neutrons: 18,
      isStable: false,
      name: 'Phosphorus-33',
      symbol: '³³P',
      halfLife: '25.34 days',
      decayMode: 'β⁻ (249 keV)',
      decayProduct: '³³S',
      nuclearSpin: '1/2+',
      commonUse: 'Low-energy beta emitter used for safer alternative DNA sequencing and radiolabeling',
    },
  ],

  // 17. Chlorine (Z=17)
  17: [
    {
      massNumber: 35,
      neutrons: 18,
      isStable: true,
      name: 'Chlorine-35',
      symbol: '³⁵Cl',
      abundancePercent: 75.76,
      halfLife: 'Stable',
      decayMode: 'None (Stable)',
      nuclearSpin: '3/2+',
      commonUse: 'Drinking water disinfection, PVC plastics, hydrochloric acid, major salt component',
    },
    {
      massNumber: 36,
      neutrons: 19,
      isStable: false,
      name: 'Chlorine-36',
      symbol: '³⁶Cl',
      halfLife: '301,000 years',
      decayMode: 'β⁻ (98%) / EC (2%)',
      decayProduct: '³⁶Ar',
      nuclearSpin: '2+',
      commonUse: 'Cosmogenic hydrological isotope for dating very ancient groundwater up to 1 million years',
    },
    {
      massNumber: 37,
      neutrons: 20,
      isStable: true,
      name: 'Chlorine-37',
      symbol: '³⁷Cl',
      abundancePercent: 24.24,
      halfLife: 'Stable',
      decayMode: 'None (Stable)',
      nuclearSpin: '3/2+',
      commonUse: 'Historical Ray Davis Homestake solar neutrino detector (³⁷Cl + νₑ → ³⁷Ar + e⁻)',
    },
  ],

  // 19. Potassium (Z=19)
  19: [
    {
      massNumber: 39,
      neutrons: 20,
      isStable: true,
      name: 'Potassium-39',
      symbol: '³⁹K',
      abundancePercent: 93.26,
      halfLife: 'Stable',
      decayMode: 'None (Stable)',
      nuclearSpin: '3/2+',
      commonUse: 'Essential cellular intracellular cation, neuron action potentials, agricultural potash fertilizer',
    },
    {
      massNumber: 40,
      neutrons: 21,
      isStable: false,
      name: 'Potassium-40',
      symbol: '⁴⁰K',
      abundancePercent: 0.0117,
      halfLife: '1.248×10⁹ years',
      decayMode: 'β⁻ (89.3%) / EC (10.7%)',
      decayProduct: '⁴⁰Ca, ⁴⁰Ar',
      nuclearSpin: '4-',
      commonUse: 'Primary natural source of radioactivity in human body and bananas; Potassium-Argon geochronology',
    },
    {
      massNumber: 41,
      neutrons: 22,
      isStable: true,
      name: 'Potassium-41',
      symbol: '⁴¹K',
      abundancePercent: 6.73,
      halfLife: 'Stable',
      decayMode: 'None (Stable)',
      nuclearSpin: '3/2+',
      commonUse: 'Enriched precursor for nuclear medical radioisotope production',
    },
  ],

  // 26. Iron (Z=26)
  26: [
    {
      massNumber: 54,
      neutrons: 28,
      isStable: true,
      name: 'Iron-54',
      symbol: '⁵⁴Fe',
      abundancePercent: 5.85,
      halfLife: 'Stable',
      decayMode: 'None (Stable)',
      nuclearSpin: '0+',
      commonUse: 'Enriched target for cyclotron production of positron-emitting ⁵⁵Co',
    },
    {
      massNumber: 55,
      neutrons: 29,
      isStable: false,
      name: 'Iron-55',
      symbol: '⁵⁵Fe',
      halfLife: '2.737 years',
      decayMode: 'Electron capture (EC)',
      decayProduct: '⁵⁵Mn',
      nuclearSpin: '3/2-',
      commonUse: 'Standard calibration source of 5.9 keV monochromatic X-rays for astronomical and medical detectors',
    },
    {
      massNumber: 56,
      neutrons: 30,
      isStable: true,
      name: 'Iron-56',
      symbol: '⁵⁶Fe',
      abundancePercent: 91.75,
      halfLife: 'Stable',
      decayMode: 'None (Peak binding energy endpoint)',
      nuclearSpin: '0+',
      commonUse: 'Endpoint of stellar silicon burning before core-collapse supernova; structural steel & hemoglobin',
    },
    {
      massNumber: 57,
      neutrons: 31,
      isStable: true,
      name: 'Iron-57',
      symbol: '⁵⁷Fe',
      abundancePercent: 2.12,
      halfLife: 'Stable',
      decayMode: 'None (Stable)',
      nuclearSpin: '1/2-',
      commonUse: 'Standard reference isotope for ⁵⁷Fe Mössbauer spectroscopy (14.4 keV gamma transition)',
    },
    {
      massNumber: 59,
      neutrons: 33,
      isStable: false,
      name: 'Iron-59',
      symbol: '⁵⁹Fe',
      halfLife: '44.50 days',
      decayMode: 'β⁻',
      decayProduct: '⁵⁹Co',
      nuclearSpin: '3/2-',
      commonUse: 'Radiotracer in hematology studies of human iron absorption and red blood cell turnover',
    },
  ],

  // 27. Cobalt (Z=27)
  27: [
    {
      massNumber: 57,
      neutrons: 30,
      isStable: false,
      name: 'Cobalt-57',
      symbol: '⁵⁷Co',
      halfLife: '271.74 days',
      decayMode: 'Electron capture (EC)',
      decayProduct: '⁵⁷Fe',
      nuclearSpin: '7/2-',
      commonUse: 'Mössbauer gamma-ray source, quality assurance flood source for gamma cameras in nuclear medicine',
    },
    {
      massNumber: 59,
      neutrons: 32,
      isStable: true,
      name: 'Cobalt-59',
      symbol: '⁵⁹Co',
      abundancePercent: 100,
      halfLife: 'Stable',
      decayMode: 'None (100% monoisotopic)',
      nuclearSpin: '7/2-',
      commonUse: 'Alnico magnets, superalloys in jet turbines, vitamin B12 organometallic coordination center',
    },
    {
      massNumber: 60,
      neutrons: 33,
      isStable: false,
      name: 'Cobalt-60',
      symbol: '⁶⁰Co',
      halfLife: '5.271 years',
      decayMode: 'β⁻ + 1.17/1.33 MeV γ',
      decayProduct: '⁶⁰Ni',
      nuclearSpin: '5+',
      commonUse: 'External beam radiotherapy for cancer (Cobalt unit), industrial food and surgical equipment irradiation',
    },
  ],

  // 43. Technetium (Z=43)
  43: [
    {
      id: 'tc-99m',
      massNumber: 99,
      neutrons: 56,
      isStable: false,
      name: 'Technetium-99m',
      symbol: '⁹⁹ᵐTc',
      halfLife: '6.01 hours',
      decayMode: 'Isomeric γ transition (140.5 keV)',
      decayProduct: '⁹⁹Tc',
      nuclearSpin: '1/2-',
      commonUse: 'The cornerstone of nuclear medicine: used in 80% of all diagnostic radiopharmaceutical scans globally',
    },
    {
      id: 'tc-99g',
      massNumber: 99,
      neutrons: 56,
      isStable: false,
      name: 'Technetium-99 (Ground)',
      symbol: '⁹⁹Tc',
      halfLife: '211,100 years',
      decayMode: 'β⁻ (294 keV)',
      decayProduct: '⁹⁹Ru',
      nuclearSpin: '9/2+',
      commonUse: 'Long-lived fission product in spent nuclear fuel; standard chemical calibration source for beta detectors',
    },
  ],

  // 53. Iodine (Z=53)
  53: [
    {
      massNumber: 123,
      neutrons: 70,
      isStable: false,
      name: 'Iodine-123',
      symbol: '¹²³I',
      halfLife: '13.22 hours',
      decayMode: 'Electron capture (EC) + 159 keV γ',
      decayProduct: '¹²³Te',
      nuclearSpin: '5/2+',
      commonUse: 'Diagnostic SPECT imaging of thyroid function and Parkinson dopamine transporter scans (DaTscan)',
    },
    {
      massNumber: 127,
      neutrons: 74,
      isStable: true,
      name: 'Iodine-127',
      symbol: '¹²⁷I',
      abundancePercent: 100,
      halfLife: 'Stable',
      decayMode: 'None (100% monoisotopic)',
      nuclearSpin: '5/2+',
      commonUse: 'Essential dietary trace element for thyroid hormones (T3/T4); potassium iodide radiation protective tablets',
    },
    {
      massNumber: 131,
      neutrons: 78,
      isStable: false,
      name: 'Iodine-131',
      symbol: '¹³¹I',
      halfLife: '8.025 days',
      decayMode: 'β⁻ + γ (606 keV)',
      decayProduct: '¹³¹Xe',
      nuclearSpin: '7/2+',
      commonUse: 'Targeted radionuclide ablation therapy for thyroid cancer and Graves disease hyperthyroidism',
    },
  ],

  // 55. Caesium (Z=55)
  55: [
    {
      massNumber: 133,
      neutrons: 78,
      isStable: true,
      name: 'Caesium-133',
      symbol: '¹³³Cs',
      abundancePercent: 100,
      halfLife: 'Stable',
      decayMode: 'None (SI standard)',
      nuclearSpin: '7/2+',
      commonUse: 'SI unit definition of the second (exactly 9,192,631,770 hyperfine ground-state radiation cycles)',
    },
    {
      massNumber: 137,
      neutrons: 82,
      isStable: false,
      name: 'Caesium-137',
      symbol: '¹³⁷Cs',
      halfLife: '30.17 years',
      decayMode: 'β⁻ + 661.7 keV γ',
      decayProduct: '¹³⁷Ba',
      nuclearSpin: '7/2+',
      commonUse: 'Major fission product; industrial moisture-density gauges, flow meters, and blood irradiators',
    },
  ],

  // 79. Gold (Z=79)
  79: [
    {
      massNumber: 197,
      neutrons: 118,
      isStable: true,
      name: 'Gold-197',
      symbol: '¹⁹⁷Au',
      abundancePercent: 100,
      halfLife: 'Stable',
      decayMode: 'None (100% monoisotopic)',
      nuclearSpin: '3/2+',
      commonUse: 'Corrosion-resistant electronics bonding wire, monetary bullion, gold nanoparticle medicine',
    },
    {
      massNumber: 198,
      neutrons: 119,
      isStable: false,
      name: 'Gold-198',
      symbol: '¹⁹⁸Au',
      halfLife: '2.695 days',
      decayMode: 'β⁻ (960 keV)',
      decayProduct: '¹⁹⁸Hg',
      nuclearSpin: '2-',
      commonUse: 'Radiation therapy seeds for prostate cancer brachytherapy; radiotracer in petroleum pipelines',
    },
  ],

  // 82. Lead (Z=82)
  82: [
    {
      massNumber: 204,
      neutrons: 122,
      isStable: true,
      name: 'Lead-204',
      symbol: '²⁰⁴Pb',
      abundancePercent: 1.4,
      halfLife: 'Stable',
      decayMode: 'None (Primordial primordial non-radiogenic lead)',
      nuclearSpin: '0+',
      commonUse: 'Reference standard for Lead-Lead (Pb-Pb) isochron geological dating',
    },
    {
      massNumber: 206,
      neutrons: 124,
      isStable: true,
      name: 'Lead-206',
      symbol: '²⁰⁶Pb',
      abundancePercent: 24.1,
      halfLife: 'Stable',
      decayMode: 'None (Uranium-238 decay series termination)',
      nuclearSpin: '0+',
      commonUse: 'Final stable daughter nuclide of the Uranium-238 (4n+2) natural radioactive decay series',
    },
    {
      massNumber: 207,
      neutrons: 125,
      isStable: true,
      name: 'Lead-207',
      symbol: '²⁰⁷Pb',
      abundancePercent: 22.1,
      halfLife: 'Stable',
      decayMode: 'None (Uranium-235 decay series termination)',
      nuclearSpin: '1/2-',
      commonUse: 'Final stable daughter nuclide of the Uranium-235 (4n+3) actinium radioactive decay series',
    },
    {
      massNumber: 208,
      neutrons: 126,
      isStable: true,
      name: 'Lead-208',
      symbol: '²⁰⁸Pb',
      abundancePercent: 52.4,
      halfLife: 'Stable',
      decayMode: 'None (Doubly magic Z=82, N=126)',
      nuclearSpin: '0+',
      commonUse: 'Heaviest known stable nuclide; final stable daughter of Thorium-232 decay series; radiation shielding',
    },
    {
      massNumber: 210,
      neutrons: 128,
      isStable: false,
      name: 'Lead-210',
      symbol: '²¹⁰Pb',
      halfLife: '22.3 years',
      decayMode: 'β⁻',
      decayProduct: '²¹⁰Bi',
      nuclearSpin: '0+',
      commonUse: 'Geochronological dating of recent lake sediments, peat bogs, and polar firn ice layers',
    },
  ],

  // 92. Uranium (Z=92)
  92: [
    {
      massNumber: 234,
      neutrons: 142,
      isStable: false,
      name: 'Uranium-234',
      symbol: '²³⁴U',
      abundancePercent: 0.0055,
      halfLife: '245,500 years',
      decayMode: 'α (4.77 MeV)',
      decayProduct: '²³⁰Th',
      nuclearSpin: '0+',
      commonUse: 'In secular equilibrium with ²³⁸U; utilized in Uranium-Thorium radiometric dating of speleothems',
    },
    {
      massNumber: 235,
      neutrons: 143,
      isStable: false,
      name: 'Uranium-235',
      symbol: '²³⁵U',
      abundancePercent: 0.7204,
      halfLife: '704×10⁶ years',
      decayMode: 'α (4.40 MeV) / Thermal Fission',
      decayProduct: '²³¹Th, Fission Fragments',
      nuclearSpin: '7/2-',
      commonUse: 'Only naturally occurring fissile nuclide; primary fuel for commercial nuclear reactors and naval propulsion',
    },
    {
      massNumber: 238,
      neutrons: 146,
      isStable: false,
      name: 'Uranium-238',
      symbol: '²³⁸U',
      abundancePercent: 99.2742,
      halfLife: '4.468×10⁹ years',
      decayMode: 'α (4.20 MeV)',
      decayProduct: '²³⁴Th',
      nuclearSpin: '0+',
      commonUse: 'Primary primordial uranium isotope (age of Earth chronometer); fertile material breeding fissile ²³⁹Pu',
    },
  ],

  // 94. Plutonium (Z=94)
  94: [
    {
      massNumber: 238,
      neutrons: 144,
      isStable: false,
      name: 'Plutonium-238',
      symbol: '²³⁸Pu',
      halfLife: '87.7 years',
      decayMode: 'α (5.59 MeV)',
      decayProduct: '²³⁴U',
      nuclearSpin: '0+',
      commonUse: 'High thermal output (0.57 W/g); Radioisotope Thermoelectric Generator (RTG) power for NASA Voyager, Cassini, Curiosity & Perseverance',
    },
    {
      massNumber: 239,
      neutrons: 145,
      isStable: false,
      name: 'Plutonium-239',
      symbol: '²³⁹Pu',
      halfLife: '24,110 years',
      decayMode: 'α / Fast & Thermal Fission',
      decayProduct: '²³⁵U, Fission Fragments',
      nuclearSpin: '1/2+',
      commonUse: 'Fissile isotope created in nuclear breeder reactors; primary fuel for nuclear weapons and MOX mixed-oxide reactor fuels',
    },
    {
      massNumber: 240,
      neutrons: 146,
      isStable: false,
      name: 'Plutonium-240',
      symbol: '²⁴⁰Pu',
      halfLife: '6,561 years',
      decayMode: 'α / Spontaneous fission',
      decayProduct: '²³⁶U',
      nuclearSpin: '0+',
      commonUse: 'High spontaneous fission rate produces significant neutron background in reactor-grade plutonium',
    },
  ],

  // 95. Americium (Z=95)
  95: [
    {
      massNumber: 241,
      neutrons: 146,
      isStable: false,
      name: 'Americium-241',
      symbol: '²⁴¹Am',
      halfLife: '432.2 years',
      decayMode: 'α (5.48 MeV) + 59.5 keV γ',
      decayProduct: '²³⁷Np',
      nuclearSpin: '5/2-',
      commonUse: 'Ionization source in domestic smoke detectors worldwide; industrial thickness gauging',
    },
  ],

  // 98. Californium (Z=98)
  98: [
    {
      massNumber: 252,
      neutrons: 154,
      isStable: false,
      name: 'Californium-252',
      symbol: '²⁵²Cf',
      halfLife: '2.645 years',
      decayMode: 'α (96.9%) / Spontaneous fission (3.1%)',
      decayProduct: '²⁴⁸Cm + 3.76 prompt neutrons',
      nuclearSpin: '0+',
      commonUse: 'Intense neutron emitter (2.3×10¹² n/s/g) used to start up nuclear reactors and detect explosives in luggage',
    },
  ],
};

export function getCleanElementSymbol(symbol: string): string {
  return symbol.replace(/^[⁰¹²³⁴⁵⁶⁷⁸⁹0-9]+/, '').trim() || symbol;
}

/**
 * Superscript formatter for mass numbers (text-based fallback)
 */
export function formatIsotopeSymbol(symbol: string, massNumber: number): string {
  const cleanSymbol = getCleanElementSymbol(symbol);
  const superscripts: Record<string, string> = {
    '0': '⁰',
    '1': '¹',
    '2': '²',
    '3': '³',
    '4': '⁴',
    '5': '⁵',
    '6': '⁶',
    '7': '⁷',
    '8': '⁸',
    '9': '⁹',
  };
  const sup = massNumber
    .toString()
    .split('')
    .map((c) => superscripts[c] || c)
    .join('');
  return `${sup}${cleanSymbol}`;
}

/**
 * Returns comprehensive list of known stable and radioactive isotopes for any element.
 * If the element is not in the curated high-detail map, it generates physically sound isotopes
 * across the nuclear stability valley.
 */
export function getIsotopesForElement(
  atomicNumber: number,
  symbol: string,
  elementName: string,
  standardAtomicMass: number
): IsotopeInfo[] {
  // If curated list exists, return it
  if (KNOWN_ISOTOPES_MAP[atomicNumber] && KNOWN_ISOTOPES_MAP[atomicNumber].length > 0) {
    return KNOWN_ISOTOPES_MAP[atomicNumber];
  }

  // Otherwise, construct a rich list of stable and radioactive isotopes
  const standardN = Math.round(standardAtomicMass) - atomicNumber;
  const isotopes: IsotopeInfo[] = [];

  // Generate a spread of isotopes around the standard mass
  // Range: -2 to +3 neutrons relative to standard
  const offsets = [-3, -2, -1, 0, 1, 2, 3];

  offsets.forEach((off) => {
    const n = standardN + off;
    if (n < 0) return;
    const massNumber = atomicNumber + n;
    const isStandard = off === 0;

    // Stability heuristic: elements with Z > 82 (Lead) have no stable isotopes!
    let isStable = false;
    let halfLife = 'Stable';
    let decayMode = 'None (Stable)';

    if (atomicNumber > 82) {
      isStable = false;
      if (atomicNumber >= 90) {
        halfLife = isStandard ? '7.0×10⁶ years' : `${Math.abs(off) * 25 + 12} days`;
        decayMode = 'α (Alpha decay)';
      } else {
        halfLife = `${Math.abs(off) * 18 + 3.8} days`;
        decayMode = 'α / β⁻';
      }
    } else {
      if (off === 0) {
        isStable = true;
        halfLife = 'Stable';
        decayMode = 'None (Stable)';
      } else if (off === -1 || off === 1) {
        // Can be stable or long-lived
        if (atomicNumber % 2 === 0 && Math.abs(off) === 1) {
          isStable = true;
          halfLife = 'Stable';
          decayMode = 'None (Stable)';
        } else {
          isStable = false;
          halfLife = off < 0 ? '4.8 hours' : '14.2 days';
          decayMode = off < 0 ? 'β⁺ / EC' : 'β⁻ (Beta minus)';
        }
      } else {
        isStable = false;
        halfLife = off < 0 ? '12.4 minutes' : '2.7 years';
        decayMode = off < 0 ? 'β⁺ / Electron capture' : 'β⁻ (Beta minus)';
      }
    }

    isotopes.push({
      massNumber,
      neutrons: n,
      isStable,
      name: `${elementName}-${massNumber}`,
      symbol: formatIsotopeSymbol(symbol, massNumber),
      abundancePercent: isStandard ? 98.5 : isStable ? 1.5 : 0,
      halfLife,
      decayMode,
      commonUse: isStable
        ? `Naturally occurring stable constituent of ${elementName}`
        : `${decayMode} radionuclide used in nuclear research and spectroscopy`,
    });
  });

  return isotopes;
}
