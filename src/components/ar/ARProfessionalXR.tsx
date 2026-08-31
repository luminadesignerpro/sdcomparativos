import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { ARButton, XR, Controllers, useHitTest, useXR } from '@react-three/xr';
import { Html, Text, Box } from '@react-three/drei';
import * as THREE from 'three';
import { Sofa3D, Table3D, Plant3D, Rug3D } from './Furniture3DModels';
import { X, Ruler, Sofa, Paintbrush, Calculator, Check } from 'lucide-react';

interface ARProfessionalXRProps {
  onClose: () => void;
  onExportBudget: (data: any) => void;
}

type Mode = 'MEASURE' | 'FURNITURE' | 'PAINT';

interface FurnitureInstance {
  id: string;
  type: 'sofa' | 'table' | 'plant' | 'rug';
  position: THREE.Vector3;
  color: string;
}

interface MeasurePoint {
  id: string;
  position: THREE.Vector3;
}

// ─── Componente Interno que gerencia a Interação WebXR ─────────────────────
function XRScene({ 
  mode, 
  activeFurniture, 
  activeColor,
  onAddFurniture,
  onAddMeasure,
  onAddPaint
}: {
  mode: Mode;
  activeFurniture: 'sofa' | 'table' | 'plant' | 'rug';
  activeColor: string;
  onAddFurniture: (pos: THREE.Vector3) => void;
  onAddMeasure: (pos: THREE.Vector3) => void;
  onAddPaint: (pos: THREE.Vector3, isVertical: boolean) => void;
}) {
  const reticleRef = useRef<THREE.Mesh>(null);
  const { session } = useXR();
  const currentPos = useRef(new THREE.Vector3());
  const currentNormal = useRef(new THREE.Vector3(0, 1, 0));

  useHitTest((hitMatrix, hit) => {
    if (reticleRef.current) {
      reticleRef.current.visible = true;
      reticleRef.current.matrix.copy(hitMatrix);
      currentPos.current.setFromMatrixPosition(hitMatrix);
      
      // Determine se é plano vertical (parede) ou horizontal (chão)
      // A Normal Y próxima de 0 indica plano vertical. Próxima de 1 indica chão.
      // O HitTestResult não expõe a normal diretamente no react-three/xr v6 de forma trivial,
      // mas podemos assumir horizontal por padrão se não houver trackable.
    }
  });

  useEffect(() => {
    if (!session) return;
    const handleSelect = () => {
      if (!reticleRef.current || !reticleRef.current.visible) return;
      const pos = currentPos.current.clone();
      
      if (mode === 'MEASURE') onAddMeasure(pos);
      else if (mode === 'FURNITURE') onAddFurniture(pos);
      else if (mode === 'PAINT') onAddPaint(pos, true);
    };

    session.addEventListener('select', handleSelect);
    return () => session.removeEventListener('select', handleSelect);
  }, [session, mode, onAddFurniture, onAddMeasure, onAddPaint]);

  return (
    <mesh ref={reticleRef} matrixAutoUpdate={false} visible={false}>
      <ringGeometry args={[0.08, 0.1, 32]} />
      <meshBasicMaterial color={mode === 'PAINT' ? activeColor : "#D4AF37"} opacity={0.8} transparent />
    </mesh>
  );
}

// ─── Linha de Medição ────────────────────────────────────────────────────────
function MeasureLine({ points }: { points: MeasurePoint[] }) {
  if (points.length < 2) return null;
  const p1 = points[0].position;
  const p2 = points[1].position;
  const distance = p1.distanceTo(p2);
  const midPoint = p1.clone().lerp(p2, 0.5);

  const pointsArray = [p1, p2];
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(pointsArray);

  return (
    <group>
      <line geometry={lineGeometry}>
        <lineBasicMaterial color="#FF3366" linewidth={4} />
      </line>
      <Html position={[midPoint.x, midPoint.y + 0.1, midPoint.z]} center>
        <div className="bg-black/80 text-white px-3 py-1 rounded-full text-xs font-black border border-white/20 whitespace-nowrap shadow-xl">
          {(distance * 1000).toFixed(0)} mm
        </div>
      </Html>
    </group>
  );
}

import { createXRStore } from '@react-three/xr';

const store = createXRStore();

// ─── Componente Principal ──────────────────────────────────────────────────
export default function ARProfessionalXR({ onClose, onExportBudget }: ARProfessionalXRProps) {
  const [mode, setMode] = useState<Mode>('MEASURE');
  const [activeFurniture, setActiveFurniture] = useState<'sofa' | 'table' | 'plant' | 'rug'>('sofa');
  const [activeColor, setActiveColor] = useState<string>('#FFFFFF');
  
  const [measures, setMeasures] = useState<MeasurePoint[]>([]);
  const [furnitureList, setFurnitureList] = useState<FurnitureInstance[]>([]);
  const [panels, setPanels] = useState<{ id: string, pos: THREE.Vector3, color: string }[]>([]);

  const handleAddFurniture = (pos: THREE.Vector3) => {
    setFurnitureList(prev => [...prev, { id: `f_${Date.now()}`, type: activeFurniture, position: pos, color: activeColor }]);
  };

  const handleAddMeasure = (pos: THREE.Vector3) => {
    setMeasures(prev => {
      if (prev.length >= 2) return [{ id: `m_${Date.now()}`, position: pos }];
      return [...prev, { id: `m_${Date.now()}`, position: pos }];
    });
  };

  const handleAddPaint = (pos: THREE.Vector3) => {
    setPanels(prev => [...prev, { id: `p_${Date.now()}`, pos, color: activeColor }]);
  };

  const calculateTotal = () => {
    let total = 0;
    furnitureList.forEach(f => {
      if (f.type === 'sofa') total += 1500;
      if (f.type === 'table') total += 800;
      if (f.type === 'rug') total += 300;
      if (f.type === 'plant') total += 150;
    });
    panels.forEach(() => { total += 250; }); 
    return total;
  };

  const handleExport = () => {
    onExportBudget({
      furniture: furnitureList,
      panels,
      measures,
      estimatedTotal: calculateTotal()
    });
  };

  const overlayRef = useRef<HTMLDivElement>(null);

  return (
    <div className="fixed inset-0 z-[9999] bg-black">
      <button 
        onClick={() => store.enterAR()}
        className="absolute bottom-32 left-1/2 -translate-x-1/2 z-[100] bg-amber-500 text-black font-black px-8 py-4 rounded-full border-2 border-white shadow-2xl animate-bounce"
      >
        ENTRAR NO MODO AR
      </button>

      <Canvas camera={{ position: [0, 1.5, 0] }}>
        <XR store={store}>
          <ambientLight intensity={1} />
          <directionalLight position={[5, 10, 5]} intensity={1.5} />
          <Controllers />

          <XRScene 
            mode={mode} 
            activeFurniture={activeFurniture} 
            activeColor={activeColor}
            onAddFurniture={handleAddFurniture}
            onAddMeasure={handleAddMeasure}
            onAddPaint={handleAddPaint}
          />

          {/* Renderização dos elementos adicionados */}
          {measures.map((m, i) => (
            <mesh key={m.id} position={m.position}>
              <sphereGeometry args={[0.02, 16, 16]} />
              <meshBasicMaterial color="#FF3366" />
            </mesh>
          ))}
          <MeasureLine points={measures} />

          {furnitureList.map(f => (
            <group key={f.id} position={f.position}>
              {f.type === 'sofa' && <Sofa3D color={f.color} />}
              {f.type === 'table' && <Table3D color={f.color} />}
              {f.type === 'plant' && <Plant3D />}
              {f.type === 'rug' && <Rug3D color={f.color} />}
            </group>
          ))}

          {panels.map(p => (
            <mesh key={p.id} position={[p.pos.x, p.pos.y + 1, p.pos.z]} rotation={[0, 0, 0]}>
              <planeGeometry args={[2, 2]} />
              <meshStandardMaterial color={p.color} side={THREE.DoubleSide} transparent opacity={0.8} />
            </mesh>
          ))}

        </XR>
      </Canvas>

      {/* Interface Fixa 2D no DOM Overlay */}
      <div id="ar-overlay-ui" ref={overlayRef} className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent pt-6 pb-12 px-6 flex justify-between items-start pointer-events-none z-[50]">
          <div>
            <h2 className="text-white font-black text-xl tracking-tighter">SD AR Visualizer</h2>
            <p className="text-amber-500 font-bold text-xs uppercase tracking-widest">WebXR Studio</p>
          </div>
          <button onClick={onClose} className="pointer-events-auto p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="absolute bottom-4 left-4 right-4 z-[50] pointer-events-none flex flex-col gap-4">
          
          {/* Orçamento Flutuante */}
          <div className="self-end bg-black/60 backdrop-blur-xl border border-white/20 p-4 rounded-2xl pointer-events-auto w-64 shadow-2xl">
            <div className="flex items-center gap-2 mb-2 text-amber-500">
              <Calculator className="w-4 h-4" />
              <span className="font-black text-xs uppercase tracking-widest">Orçamentista</span>
            </div>
            <div className="flex justify-between items-end mb-4">
              <span className="text-gray-400 text-xs">Total Parcial:</span>
              <span className="text-white font-black text-xl">R$ {calculateTotal().toFixed(2)}</span>
            </div>
            <button onClick={handleExport} className="w-full bg-amber-500 text-black py-2 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 hover:bg-amber-400">
              <Check className="w-4 h-4" /> Exportar Pedido
            </button>
          </div>

          {/* Barra de Ferramentas */}
          <div className="bg-black/80 backdrop-blur-md p-2 rounded-2xl flex justify-around pointer-events-auto border border-white/10">
            <button onClick={() => setMode('MEASURE')} className={`p-4 rounded-xl flex flex-col items-center gap-1 transition-all ${mode === 'MEASURE' ? 'bg-amber-500 text-black' : 'text-gray-400'}`}>
              <Ruler className="w-5 h-5" />
              <span className="text-[10px] uppercase font-black">Trena</span>
            </button>
            <button onClick={() => setMode('FURNITURE')} className={`p-4 rounded-xl flex flex-col items-center gap-1 transition-all ${mode === 'FURNITURE' ? 'bg-amber-500 text-black' : 'text-gray-400'}`}>
              <Sofa className="w-5 h-5" />
              <span className="text-[10px] uppercase font-black">Móveis</span>
            </button>
            <button onClick={() => setMode('PAINT')} className={`p-4 rounded-xl flex flex-col items-center gap-1 transition-all ${mode === 'PAINT' ? 'bg-amber-500 text-black' : 'text-gray-400'}`}>
              <Paintbrush className="w-5 h-5" />
              <span className="text-[10px] uppercase font-black">Cores</span>
            </button>
          </div>

          {/* Sub-menu de Móveis/Cores */}
          {mode === 'FURNITURE' && (
            <div className="bg-black/80 backdrop-blur-md p-3 rounded-2xl flex gap-2 pointer-events-auto overflow-x-auto border border-white/10">
              {['sofa', 'table', 'plant', 'rug'].map(f => (
                <button key={f} onClick={() => setActiveFurniture(f as any)} className={`px-4 py-2 rounded-lg text-xs font-bold capitalize whitespace-nowrap ${activeFurniture === f ? 'bg-white/20 text-white' : 'text-gray-400'}`}>
                  {f}
                </button>
              ))}
            </div>
          )}

          {mode === 'PAINT' && (
            <div className="bg-black/80 backdrop-blur-md p-3 rounded-2xl flex gap-2 pointer-events-auto overflow-x-auto border border-white/10">
              {['#FFFFFF', '#D4AF37', '#8B4513', '#2F4F4F'].map(c => (
                <button key={c} onClick={() => setActiveColor(c)} className={`w-10 h-10 rounded-full border-2 flex-shrink-0 ${activeColor === c ? 'border-amber-500 scale-110' : 'border-white/20'}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
