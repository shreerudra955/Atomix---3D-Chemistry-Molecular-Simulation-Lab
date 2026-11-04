/**
 * Aufbau Order & Quantum Subshells Occupancy Engine
 * Handles electron filling rules (Aufbau principle, Pauli exclusion, Hund's rule)
 */

export interface SubshellDef {
  n: number;
  l: number;
  type: 's' | 'p' | 'd' | 'f';
  name: string;
  capacity: number;
}

export const AUFBAU_ORDER: SubshellDef[] = [
  { n: 1, l: 0, type: 's', name: '1s', capacity: 2 },
  { n: 2, l: 0, type: 's', name: '2s', capacity: 2 },
  { n: 2, l: 1, type: 'p', name: '2p', capacity: 6 },
  { n: 3, l: 0, type: 's', name: '3s', capacity: 2 },
  { n: 3, l: 1, type: 'p', name: '3p', capacity: 6 },
  { n: 4, l: 0, type: 's', name: '4s', capacity: 2 },
  { n: 3, l: 2, type: 'd', name: '3d', capacity: 10 },
  { n: 4, l: 1, type: 'p', name: '4p', capacity: 6 },
  { n: 5, l: 0, type: 's', name: '5s', capacity: 2 },
  { n: 4, l: 2, type: 'd', name: '4d', capacity: 10 },
  { n: 5, l: 1, type: 'p', name: '5p', capacity: 6 },
  { n: 6, l: 0, type: 's', name: '6s', capacity: 2 },
  { n: 4, l: 3, type: 'f', name: '4f', capacity: 14 },
  { n: 5, l: 2, type: 'd', name: '5d', capacity: 10 },
  { n: 6, l: 1, type: 'p', name: '6p', capacity: 6 },
  { n: 7, l: 0, type: 's', name: '7s', capacity: 2 },
  { n: 5, l: 3, type: 'f', name: '5f', capacity: 14 },
  { n: 6, l: 2, type: 'd', name: '6d', capacity: 10 },
  { n: 7, l: 1, type: 'p', name: '7p', capacity: 6 },
];

export interface SubshellOccupancy {
  name: string;
  n: number;
  l: number;
  type: 's' | 'p' | 'd' | 'f';
  capacity: number;
  electronCount: number;
  isFull: boolean;
  radialNodes: number;
  angularNodes: number;
  totalNodes: number;
  orbitals: Array<{
    name: string;
    subLabel: string;
    axis?: 'x' | 'y' | 'z';
    dType?: 'xy' | 'yz' | 'xz' | 'x2-y2' | 'z2';
    electrons: number; // 0, 1, or 2
    spinUp: boolean;
    spinDown: boolean;
  }>;
}

export function getAufbauConfiguration(electronCount: number): SubshellOccupancy[] {
  let remaining = Math.max(0, electronCount);
  const result: SubshellOccupancy[] = [];

  for (const sub of AUFBAU_ORDER) {
    if (remaining <= 0) break;
    const count = Math.min(remaining, sub.capacity);
    remaining -= count;

    let subOrbitals: SubshellOccupancy['orbitals'] = [];

    if (sub.type === 's') {
      subOrbitals = [
        {
          name: `${sub.name}`,
          subLabel: 's',
          electrons: count,
          spinUp: count >= 1,
          spinDown: count >= 2,
        },
      ];
    } else if (sub.type === 'p') {
      const axes: ('x' | 'y' | 'z')[] = ['x', 'y', 'z'];
      subOrbitals = axes.map((axis, i) => {
        const spinUp = count > i;
        const spinDown = count > 3 + i;
        const eCount = (spinUp ? 1 : 0) + (spinDown ? 1 : 0);
        return {
          name: `${sub.name}_${axis}`,
          subLabel: `p_${axis}`,
          axis,
          electrons: eCount,
          spinUp,
          spinDown,
        };
      });
    } else if (sub.type === 'd') {
      const dTypes: ('xy' | 'yz' | 'xz' | 'x2-y2' | 'z2')[] = ['xy', 'yz', 'xz', 'x2-y2', 'z2'];
      subOrbitals = dTypes.map((dType, i) => {
        const spinUp = count > i;
        const spinDown = count > 5 + i;
        const eCount = (spinUp ? 1 : 0) + (spinDown ? 1 : 0);
        return {
          name: `${sub.name}_${dType}`,
          subLabel: `d_${dType}`,
          dType,
          electrons: eCount,
          spinUp,
          spinDown,
        };
      });
    } else {
      // f orbitals
      subOrbitals = Array.from({ length: 7 }, (_, i) => {
        const spinUp = count > i;
        const spinDown = count > 7 + i;
        const eCount = (spinUp ? 1 : 0) + (spinDown ? 1 : 0);
        return {
          name: `${sub.name}_f${i + 1}`,
          subLabel: `f${i + 1}`,
          electrons: eCount,
          spinUp,
          spinDown,
        };
      });
    }

    result.push({
      ...sub,
      electronCount: count,
      isFull: count === sub.capacity,
      radialNodes: Math.max(0, sub.n - sub.l - 1),
      angularNodes: sub.l,
      totalNodes: sub.n - 1,
      orbitals: subOrbitals,
    });
  }

  return result;
}

export const formatElectronConfig = (subshells: SubshellOccupancy[]): string => {
  if (subshells.length === 0) return '0 e⁻ (Ionized Core)';
  const superscripts: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  };
  return subshells
    .map((s) => `${s.name}${String(s.electronCount).split('').map((c) => superscripts[c] || c).join('')}`)
    .join(' ');
};
