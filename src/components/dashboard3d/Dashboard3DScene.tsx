import React, { Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls, Text, RoundedBox, Float, ContactShadows, Environment, MeshTransmissionMaterial, PresentationControls } from "@react-three/drei";
import { FloatingCard } from "./FloatingCard";
import { ParticleField } from "./ParticleField";
import { ProjectBar } from "./ProjectBar";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useRef } from "react";

const db = supabase as any;

// FIX 3: statsCards removido pois nunca era utilizado

export function Dashboard3DScene() {
  const [stats, setStats] = useState({
    totalProjects: 0,
    activeClients: 0,
    revenue: 0,
    conversionRate: 0,
    monthlyData: [] as { label: string; value: number; color: string }[]
  });
  const [loading, setLoading] = useState(true);
  const orbitalRef = useRef<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projectsRes, clientsRes, ordersRes] = await Promise.all([
        db.from('client_projects').select('id', { count: 'exact' }),
        db.from('clients').select('id', { count: 'exact' }).eq('status', 'active'),
        db.from('service_orders').select('total_value'),
      ]);

      const totalRevenue = (ordersRes.data || []).reduce((acc: number, curr: any) => acc + (Number(curr.total_value) || 0), 0);
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];
      const processedMonthly = months.map((month, i) => ({
        label: month,
        value: 5 + Math.random() * 15,
        color: i % 2 === 0 ? "#6366f1" : "#10b981"
      }));

      setStats({
        totalProjects: projectsRes.count || 0,
        activeClients: clientsRes.count || 0,
        revenue: totalRevenue,
        conversionRate: 68,
        monthlyData: processedMonthly
      });
    } catch (error) {
      console.error("Error fetching 3D stats:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full relative bg-[#0a0a14] overflow-hidden rounded-3xl group">
      {/* Premium HUD Overlay */}
      <div className="absolute top-6 left-8 z-10 pointer-events-none transition-all group-hover:translate-x-1">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-1 h-8 bg-amber-500 rounded-full" />
          <h1 className="text-3xl font-black text-white tracking-tight uppercase italic">
            SD VISION <span className="text-amber-500">3D</span>
          </h1>
        </div>
        <p className="text-[10px] font-bold text-white/40 tracking-[0.3em] uppercase ml-4">
          Marcenaria Inteligente & Analytics
        </p>
      </div>

      {/* Floating Stats HUD (Glassmorphism) */}
      <div className="absolute top-6 right-8 z-10 hidden md:flex flex-col gap-4">
        {[
          { label: "Projetos", val: stats.totalProjects, color: "bg-blue-500" },
          { label: "Ganhos", val: `R$ ${(stats.revenue / 1000).toFixed(1)}k`, color: "bg-emerald-500" }
        ].map(item => (
          <div key={item.label} className="bg-white/5 backdrop-blur-xl border border-white/10 p-4 rounded-2xl min-w-[140px] shadow-2xl">
            <p className="text-[10px] font-black text-white/40 uppercase mb-1">{item.label}</p>
            <p className="text-xl font-black text-white">{item.val}</p>
            <div className={`mt-2 h-1 w-full rounded-full opacity-30 ${item.color}`} />
          </div>
        ))}
      </div>

      <Canvas
        shadows
        camera={{ position: [12, 10, 12], fov: 45 }}
        dpr={[1, 2]}
      >
        <color attach="background" args={["#050510"]} />
        <fog attach="fog" args={["#050510", 20, 60]} />

        <Suspense fallback={null}>
          <Environment preset="city" />
          <ambientLight intensity={0.5} />
          <spotLight position={[10, 15, 10]} angle={0.3} penumbra={1} intensity={2} castShadow />
          <directionalLight position={[-10, 10, 5]} intensity={1} color="#ffffff" />
          <pointLight position={[0, 5, 5]} color="#6366f1" intensity={2} />

          {/* Central Stylized Furniture (Modern Bookshelf/Cabinet) */}
          <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
            <group position={[0, 0, 0]}>
              {/* Back Panel */}
              <RoundedBox args={[7, 5, 0.2]} radius={0.05} position={[0, 0, -1.5]}>
                <meshPhysicalMaterial color="#1e1e2e" metalness={0.9} roughness={0.1} />
              </RoundedBox>

              {/* Shelves */}
              {[-1.5, 0.5, 2.5].map((y, i) => (
                <RoundedBox key={i} args={[7, 0.1, 3]} radius={0.02} position={[0, y - 1, 0]}>
                  <meshPhysicalMaterial color="#3a3a4a" metalness={0.5} roughness={0.5} />
                </RoundedBox>
              ))}

              {/* FIX 1: Data Modules movidos para z=2.8 e altura limitada a 2.5 para não atravessar prateleiras */}
              <group position={[0, 0, 2.8]}>
                <ProjectModule
                  position={[-2.4, -0.5, 0]}
                  height={Math.min(Math.max(stats.totalProjects / 12, 1.0), 2.5)}
                  color="#6366f1"
                  label="PROJETOS"
                  count={stats.totalProjects}
                  delay={0}
                />
                <ProjectModule
                  position={[0, -0.5, 0]}
                  height={Math.min(Math.max(stats.activeClients / 8, 1.0), 2.5)}
                  color="#22d3ee"
                  label="CLIENTES"
                  count={stats.activeClients}
                  delay={0.2}
                />
                <ProjectModule
                  position={[2.4, -0.5, 0]}
                  height={Math.min(Math.max(stats.revenue / 30000, 1.0), 2.5)}
                  color="#10b981"
                  label="RECEITA"
                  count={`R$${(stats.revenue / 1000).toFixed(0)}k`}
                  delay={0.4}
                />
              </group>

              {/* Decorative side pillars */}
              <RoundedBox args={[0.3, 5, 0.3]} radius={0.05} position={[-3.6, 0, -1.3]}>
                <meshPhysicalMaterial color="#f59e0b" metalness={0.8} />
              </RoundedBox>
              <RoundedBox args={[0.3, 5, 0.3]} radius={0.05} position={[3.6, 0, -1.3]}>
                <meshPhysicalMaterial color="#f59e0b" metalness={0.8} />
              </RoundedBox>
            </group>
          </Float>

          {/* Luxury Floor */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.5, 0]} receiveShadow>
            <planeGeometry args={[100, 100]} />
            <meshStandardMaterial color="#05050a" roughness={0.05} metalness={0.8} />
          </mesh>
          <gridHelper args={[60, 40, "#222233", "#111122"]} position={[0, -3.48, 0]} />

          <ParticleField count={400} />
          {/* FIX 2: ContactShadows alinhado ao chão em y=-3.49 */}
          <ContactShadows position={[0, -3.49, 0]} opacity={0.4} scale={20} blur={2} far={4.5} />
        </Suspense>

        <OrbitControls
          ref={orbitalRef}
          makeDefault
          autoRotate
          autoRotateSpeed={0.5}
          enableDamping
          dampingFactor={0.05}
          maxPolarAngle={Math.PI / 2.2}
          minPolarAngle={Math.PI / 4}
          minDistance={10}
          maxDistance={25}
        />

        <ResponsiveCamera />
      </Canvas>

      {/* Mobile Stats Controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex md:hidden gap-3 px-4 w-full justify-center">
        <div className="bg-white/10 backdrop-blur-xl p-3 rounded-2xl border border-white/20 flex-1 text-center">
          <p className="text-[8px] text-white/50 uppercase font-bold">Projetos</p>
          <p className="text-sm font-black text-white">{stats.totalProjects}</p>
        </div>
        <div className="bg-white/10 backdrop-blur-xl p-3 rounded-2xl border border-white/20 flex-1 text-center">
          <p className="text-[8px] text-white/50 uppercase font-bold">Faturamento</p>
          <p className="text-sm font-black text-emerald-400">R${(stats.revenue / 1000).toFixed(1)}k</p>
        </div>
      </div>
    </div>
  );
}

function ProjectModule({ position, height, color, label, count, delay }: any) {
  const [hovered, setHovered] = useState(false);
  const groupRef = useRef<THREE.Group>(null!);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime + delay;
    groupRef.current.position.y = position[1] + Math.sin(t * 1.5) * 0.1;
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <RoundedBox
        args={[1.1, height, 1.1]}
        radius={0.1}
        smoothness={4}
        castShadow
        scale={hovered ? 1.1 : 1}
      >
        <meshPhysicalMaterial
          color={color}
          metalness={0.9}
          roughness={0.1}
          clearcoat={1}
          transparent
          opacity={hovered ? 0.9 : 0.7}
          emissive={color}
          emissiveIntensity={hovered ? 0.5 : 0.2}
        />
      </RoundedBox>

      {/* Glow */}
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[1.2, height + 0.1, 1.2]} />
        <meshBasicMaterial color={color} transparent opacity={hovered ? 0.2 : 0.05} />
      </mesh>

      <Text
        position={[0, height / 2 + 0.6, 0.1]}
        fontSize={0.22}
        color="#a0a0b8"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
      <Text
        position={[0, height / 2 + 0.3, 0.1]}
        fontSize={0.45}
        color="white"
        fontWeight="black"
        anchorX="center"
        anchorY="middle"
      >
        {count}
      </Text>
    </group>
  );
}

function ResponsiveCamera() {
  useFrame((state) => {
    const isMobile = state.size.width < 768;
    const targetZ = isMobile ? 22 : 14;
    const currentZ = state.camera.position.z;
    state.camera.position.z = THREE.MathUtils.lerp(currentZ, targetZ, 0.05);
  });
  return null;
}

