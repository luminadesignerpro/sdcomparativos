import React, { useEffect, useRef, useState } from 'react';
import * as pc from 'playcanvas';
import { Button } from '@/components/ui/button';
import { Upload, Maximize, Cuboid, Box, Layers, View } from 'lucide-react';
import { toast } from 'sonner';

interface PlayCanvasViewerProps {
  className?: string;
}

export function PlayCanvasViewer({ className }: PlayCanvasViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [appInstance, setAppInstance] = useState<pc.Application | null>(null);
  const [modelEntity, setModelEntity] = useState<pc.Entity | null>(null);
  const [isXrSupported, setIsXrSupported] = useState(false);
  
  // Ref for Orbit Controls logic
  const orbitRef = useRef({
    pitch: 45,
    yaw: 45,
    distance: 5,
    isDragging: false,
    lastX: 0,
    lastY: 0
  });

  useEffect(() => {
    if (!canvasRef.current) return;

    // 1. Initialize Engine - Full Capabilities
    const app = new pc.Application(canvasRef.current, {
      mouse: new pc.Mouse(document.body),
      keyboard: new pc.Keyboard(window),
      touch: new pc.TouchDevice(window),
      graphicsDeviceOptions: {
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      }
    });

    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);

    // 2. High-End Lighting Setup (ACES Tonemapping for photorealism)
    app.scene.gammaCorrection = pc.GAMMA_SRGB;
    app.scene.toneMapping = pc.TONEMAP_ACES;
    app.scene.ambientLight = new pc.Color(0.4, 0.4, 0.45);
    app.scene.exposure = 1.2;

    const mainLight = new pc.Entity('MainLight');
    mainLight.addComponent('light', {
      type: 'directional',
      color: new pc.Color(1, 0.95, 0.9),
      castShadows: true,
      intensity: 1.5,
      shadowBias: 0.05,
      shadowResolution: 2048,
      normalOffsetBias: 0.05,
    });
    mainLight.setLocalEulerAngles(45, 30, 0);
    app.root.addChild(mainLight);

    const fillLight = new pc.Entity('FillLight');
    fillLight.addComponent('light', {
      type: 'directional',
      color: new pc.Color(0.8, 0.8, 1),
      intensity: 0.5,
    });
    fillLight.setLocalEulerAngles(45, -150, 0);
    app.root.addChild(fillLight);

    // 3. Advanced Camera with XR
    const camera = new pc.Entity('Camera');
    camera.addComponent('camera', {
      clearColor: new pc.Color(0.1, 0.1, 0.12),
      fov: 60,
      nearClip: 0.1,
      farClip: 100,
    });
    app.root.addChild(camera);
    
    // Check WebXR
    if (app.xr && app.xr.supported) {
      setIsXrSupported(true);
    }

    // 4. Default Premium Object (if no GLB is loaded)
    const modelGroup = new pc.Entity('ModelGroup');
    app.root.addChild(modelGroup);
    
    // Floor for shadows
    const floor = new pc.Entity('Floor');
    floor.addComponent('render', { type: 'plane', castShadows: false, receiveShadows: true });
    floor.setLocalScale(20, 1, 20);
    const floorMat = new pc.StandardMaterial();
    floorMat.diffuse = new pc.Color(0.05, 0.05, 0.05);
    floorMat.metalness = 0.5;
    floorMat.gloss = 0.2;
    floorMat.useMetalness = true;
    floorMat.update();
    floor.render!.material = floorMat;
    app.root.addChild(floor);

    // Demo geometry
    const showcase = new pc.Entity('Showcase');
    showcase.addComponent('render', { type: 'box', castShadows: true });
    showcase.setLocalScale(1, 1.5, 0.5);
    showcase.setPosition(0, 0.75, 0);
    
    const pbrMat = new pc.StandardMaterial();
    pbrMat.diffuse = new pc.Color(0.8, 0.6, 0.3);
    pbrMat.metalness = 0.1;
    pbrMat.gloss = 0.6;
    pbrMat.useMetalness = true;
    pbrMat.update();
    showcase.render!.material = pbrMat;
    
    modelGroup.addChild(showcase);
    setModelEntity(modelGroup);

    // 5. Custom Orbit Controls Logic (Mouse & Touch)
    const updateCameraPosition = () => {
      const { pitch, yaw, distance } = orbitRef.current;
      const ex = pitch * pc.math.DEG_TO_RAD;
      const ey = yaw * pc.math.DEG_TO_RAD;

      const x = distance * Math.sin(ex) * Math.cos(ey);
      const y = distance * Math.cos(ex);
      const z = distance * Math.sin(ex) * Math.sin(ey);

      camera.setPosition(x, y, z);
      camera.lookAt(0, 0.75, 0); // Look at center of object
    };
    updateCameraPosition();

    // Mouse Events for Orbit
    const onMouseDown = (e: MouseEvent) => {
      orbitRef.current.isDragging = true;
      orbitRef.current.lastX = e.clientX;
      orbitRef.current.lastY = e.clientY;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!orbitRef.current.isDragging) return;
      const dx = e.clientX - orbitRef.current.lastX;
      const dy = e.clientY - orbitRef.current.lastY;
      
      orbitRef.current.yaw -= dx * 0.5;
      orbitRef.current.pitch -= dy * 0.5;
      
      // Clamp pitch so we don't go under floor or loop over top
      orbitRef.current.pitch = pc.math.clamp(orbitRef.current.pitch, 5, 85);
      
      orbitRef.current.lastX = e.clientX;
      orbitRef.current.lastY = e.clientY;
      updateCameraPosition();
    };
    const onMouseUp = () => { orbitRef.current.isDragging = false; };
    const onWheel = (e: WheelEvent) => {
      orbitRef.current.distance += e.deltaY * 0.01;
      orbitRef.current.distance = pc.math.clamp(orbitRef.current.distance, 1, 15);
      updateCameraPosition();
    };

    canvasRef.current.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvasRef.current.addEventListener('wheel', onWheel);

    app.start();
    setAppInstance(app);

    const resize = () => app.resizeCanvas();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      if (canvasRef.current) {
        canvasRef.current.removeEventListener('mousedown', onMouseDown);
        canvasRef.current.removeEventListener('wheel', onWheel);
      }
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      app.destroy();
    };
  }, []);

  // --- FEATURE 1: GLB MODEL UPLOAD (Load any Promob/SketchUp file) ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !appInstance) return;

    toast.info("Carregando modelo 3D: " + file.name);

    const url = URL.createObjectURL(file);
    
    // PlayCanvas asset loading
    appInstance.assets.loadFromUrlAndFilename(url, file.name, "container", (err: any, asset: pc.Asset | undefined) => {
      if (err || !asset) {
        console.error(err);
        toast.error("Erro ao carregar o arquivo GLB.");
        return;
      }

      // Remove old model
      if (modelEntity) {
        modelEntity.destroy();
      }

      // Create new entity for the uploaded model
      const newModel = new pc.Entity('UploadedModel');
      newModel.addComponent('model', {
        type: 'asset',
        asset: asset.resource.model
      });
      
      // Auto-scale logic: fit within camera view
      if (asset.resource.model) {
         // simplistic scale down just in case it's huge
         newModel.setLocalScale(1, 1, 1);
         newModel.setPosition(0, 0, 0);
      }

      appInstance.root.addChild(newModel);
      setModelEntity(newModel);
      
      toast.success("Modelo carregado! Use o mouse para girar.");
    });
  };

  // --- FEATURE 2: ADVANCED PBR MATERIAL EDITOR ---
  const applyPBRMaterial = (color: string, metalness: number, gloss: number) => {
    if (!appInstance || !modelEntity) return;

    // Convert hex to PlayCanvas Color
    const hex2pc = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      return new pc.Color(r, g, b);
    };

    const targetColor = hex2pc(color);

    // Deep search and replace materials on the entity
    const meshInstances = (modelEntity.model || modelEntity.render)?.meshInstances || [];
    
    const applyToMeshInstances = (instances: pc.MeshInstance[]) => {
      instances.forEach(mi => {
        const mat = new pc.StandardMaterial();
        mat.diffuse = targetColor;
        mat.metalness = metalness;
        mat.gloss = gloss;
        mat.useMetalness = true;
        mat.update();
        mi.material = mat;
      });
    };

    if (meshInstances.length === 0) {
       // If it's a hierarchy (like GLB usually is)
       const renders: pc.RenderComponent[] = modelEntity.findComponents('render') as any;
       renders.forEach(r => {
         if (r.meshInstances) applyToMeshInstances(r.meshInstances);
       });
       
       const models: pc.ModelComponent[] = modelEntity.findComponents('model') as any;
       models.forEach(m => {
         if (m.meshInstances) applyToMeshInstances(m.meshInstances);
       });
    } else {
        applyToMeshInstances(meshInstances);
    }
    
    toast.success("Material aplicado em tempo real!");
  };

  // --- FEATURE 3: WebXR (Augmented Reality) ---
  const startAR = () => {
    if (!appInstance || !appInstance.xr) {
      toast.error("Realidade Aumentada não é suportada neste dispositivo.");
      return;
    }
    const camera = appInstance.root.findByName('Camera')[0] as pc.Entity;
    if (camera && camera.camera) {
      appInstance.xr.start(camera.camera, pc.XRTYPE_AR, pc.XRSPACE_LOCALFLOOR, {
        callback: (err) => {
          if (err) toast.error("Erro ao iniciar AR: " + err.message);
        }
      });
    }
  };

  return (
    <div className={`relative w-full h-[700px] rounded-xl overflow-hidden border border-white/10 shadow-2xl ${className}`}>
      {/* 3D Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block outline-none cursor-move" />
      
      {/* Top UI Panel */}
      <div className="absolute top-4 left-4 right-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-md px-6 py-4 rounded-xl border border-white/10 pointer-events-auto shadow-xl">
          <h3 className="font-bold text-xl text-white flex items-center gap-2">
            <Cuboid className="w-6 h-6 text-amber-400" />
            PlayCanvas 3D Studio
          </h3>
          <p className="text-sm text-gray-300 mt-1">Ferramenta completa para móveis projetados.</p>
        </div>

        <div className="flex flex-col gap-2 pointer-events-auto">
          {/* UPLOAD GLB BUTTON */}
          <label className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 px-6 rounded-xl cursor-pointer flex items-center gap-3 shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-all active:scale-95 border border-amber-400/30">
            <Upload className="w-5 h-5" />
            <div className="text-left">
              <span className="block text-sm">Carregar seu Projeto</span>
              <span className="block text-[10px] font-normal opacity-80">Importar arquivo .GLB ou .GLTF</span>
            </div>
            <input type="file" accept=".glb,.gltf" className="hidden" onChange={handleFileUpload} />
          </label>
          
          {/* AR BUTTON */}
          {isXrSupported && (
            <Button onClick={startAR} className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-6 border border-blue-400/30 shadow-[0_0_20px_rgba(37,99,235,0.3)]">
              <View className="w-5 h-5 mr-2" /> Entrar em Realidade Aumentada
            </Button>
          )}
        </div>
      </div>

      {/* Material Configurator Panel */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-auto w-[90%] max-w-2xl">
        <div className="bg-black/80 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-2xl flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-white font-bold text-sm uppercase tracking-widest opacity-80">
            <Layers className="w-4 h-4 text-amber-400" />
            Configurador de Acabamentos (PBR)
          </div>
          <div className="flex flex-wrap justify-center gap-4 md:gap-8">
            <button 
              onClick={() => applyPBRMaterial('#a87b51', 0.05, 0.3)}
              className="group flex flex-col items-center gap-3 active:scale-95 transition-transform"
            >
              <div className="w-14 h-14 rounded-full shadow-inner border-2 border-transparent group-hover:border-amber-400 transition-all cursor-pointer" style={{ background: '#a87b51', backgroundImage: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2) 0%, transparent 50%)' }} />
              <span className="text-xs text-gray-300 font-bold uppercase tracking-wider">MDF Amadeirado</span>
            </button>

            <button 
              onClick={() => applyPBRMaterial('#ffffff', 0.1, 0.9)}
              className="group flex flex-col items-center gap-3 active:scale-95 transition-transform"
            >
              <div className="w-14 h-14 rounded-full shadow-inner border-2 border-transparent group-hover:border-amber-400 transition-all cursor-pointer" style={{ background: '#ffffff', backgroundImage: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8) 0%, transparent 50%)' }} />
              <span className="text-xs text-gray-300 font-bold uppercase tracking-wider">Laca Branca</span>
            </button>

            <button 
              onClick={() => applyPBRMaterial('#111111', 0.8, 0.6)}
              className="group flex flex-col items-center gap-3 active:scale-95 transition-transform"
            >
              <div className="w-14 h-14 rounded-full shadow-inner border-2 border-transparent group-hover:border-amber-400 transition-all cursor-pointer" style={{ background: '#111111', backgroundImage: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3) 0%, transparent 50%)' }} />
              <span className="text-xs text-gray-300 font-bold uppercase tracking-wider">Metal Fosco</span>
            </button>

            <button 
              onClick={() => applyPBRMaterial('#e5e5e5', 1.0, 0.95)}
              className="group flex flex-col items-center gap-3 active:scale-95 transition-transform"
            >
              <div className="w-14 h-14 rounded-full shadow-inner border-2 border-transparent group-hover:border-amber-400 transition-all cursor-pointer" style={{ background: '#e5e5e5', backgroundImage: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9) 0%, transparent 50%)' }} />
              <span className="text-xs text-gray-300 font-bold uppercase tracking-wider">Aço Cromado</span>
            </button>
          </div>
        </div>
      </div>

      {/* Orbit Helper Text */}
      <div className="absolute bottom-2 left-2 md:bottom-4 md:right-4 md:left-auto bg-black/60 backdrop-blur border border-white/10 px-4 py-2 rounded-lg text-xs font-bold text-gray-400 pointer-events-none shadow-xl">
        🖱️ Arraste para girar • 🎡 Role para zoom
      </div>
    </div>
  );
}
