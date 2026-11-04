/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Header, LabTab } from './Header';
import { AtomSimulator3D } from './AtomSimulator3D';
import { MoleculeSimulator3D } from './MoleculeSimulator3D';
import { ReactionSimulator3D } from './ReactionSimulator3D';
import { MoleculeBuilderSandbox } from './MoleculeBuilderSandbox';
import { VirtualLabWorkbench } from './VirtualLabWorkbench';
import { PeriodicTableExplorer } from './PeriodicTableExplorer';
import { ElementData } from './types/chemistry';
import { ELEMENTS } from './data/elements';

export default function App() {
  const [currentTab, setCurrentTab] = useState<LabTab>('atoms');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Shared exploration state between tabs
  const [activeElement, setActiveElement] = useState<ElementData>(ELEMENTS[5]); // Carbon (C)
  const [activeMoleculeId, setActiveMoleculeId] = useState<string>('water');

  const handleSimulateAtom = (el: ElementData) => {
    setActiveElement(el);
    setCurrentTab('atoms');
  };

  const handleExploreMolecules = (moleculeId?: string) => {
    if (moleculeId) setActiveMoleculeId(moleculeId);
    setCurrentTab('molecules');
  };

  const handleThemeToggle = () => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div className={`w-full min-h-[100dvh] h-[100dvh] max-h-[100dvh] flex flex-col overflow-hidden ${theme === 'dark' ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Top Laboratory Navigation Header */}
      <Header
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        theme={theme}
        onThemeToggle={handleThemeToggle}
      />

      {/* Main Dynamic Viewport */}
      <main className="flex-1 min-h-0 relative w-full overflow-hidden">
        {currentTab === 'atoms' && (
          <AtomSimulator3D
            initialElement={activeElement}
            theme={theme}
            onSelectElementForMolecule={handleExploreMolecules}
          />
        )}

        {currentTab === 'molecules' && (
          <MoleculeSimulator3D
            initialMoleculeId={activeMoleculeId}
            theme={theme}
          />
        )}

        {currentTab === 'reactions' && (
          <ReactionSimulator3D
            theme={theme}
          />
        )}

        {currentTab === 'virtual_lab' && (
          <VirtualLabWorkbench
            theme={theme}
          />
        )}

        {currentTab === 'builder' && (
          <MoleculeBuilderSandbox
            theme={theme}
          />
        )}

        {currentTab === 'periodic_table' && (
          <PeriodicTableExplorer
            onSimulateAtom={handleSimulateAtom}
            onExploreMolecules={handleExploreMolecules}
          />
        )}
      </main>
    </div>
  );
}
