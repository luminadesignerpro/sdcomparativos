import { useState, useCallback, useRef } from 'react';
import { ModuleTemplate, FurnitureModule } from '@/types';

interface DragState {
  isDragging: boolean;
  template: ModuleTemplate | null;
  previewPosition: { x: number; y: number; z: number } | null;
}

interface DragModuleState {
  isDragging: boolean;
  moduleId: string | null;
  startPosition: { x: number; y: number; z: number } | null;
}

export function useDragAndDrop() {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    template: null,
    previewPosition: null,
  });

  const [dragModuleState, setDragModuleState] = useState<DragModuleState>({
    isDragging: false,
    moduleId: null,
    startPosition: null,
  });

  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Inicia o arrasto de um template da biblioteca
  const startDragTemplate = useCallback((template: ModuleTemplate) => {
    setDragState({
      isDragging: true,
      template,
      previewPosition: { x: 0, y: 0, z: 0 },
    });
  }, []);

  // Atualiza a posição do preview durante o arrasto
  const updateDragPosition = useCallback((x: number, y: number, z: number) => {
    setDragState(prev => ({
      ...prev,
      previewPosition: { x, y, z },
    }));
  }, []);

  // Finaliza o arrasto e retorna o template para criar
  const endDragTemplate = useCallback(() => {
    const result = dragState.template ? {
      template: dragState.template,
      position: dragState.previewPosition,
    } : null;

    setDragState({
      isDragging: false,
      template: null,
      previewPosition: null,
    });

    return result;
  }, [dragState]);

  // Cancela o arrasto
  const cancelDrag = useCallback(() => {
    setDragState({
      isDragging: false,
      template: null,
      previewPosition: null,
    });
    setDragModuleState({
      isDragging: false,
      moduleId: null,
      startPosition: null,
    });
  }, []);

  // Inicia o arrasto de um módulo existente
  const startDragModule = useCallback((moduleId: string, position: { x: number; y: number; z: number }) => {
    setDragModuleState({
      isDragging: true,
      moduleId,
      startPosition: position,
    });
  }, []);

  // Finaliza o arrasto do módulo
  const endDragModule = useCallback(() => {
    setDragModuleState({
      isDragging: false,
      moduleId: null,
      startPosition: null,
    });
  }, []);

  return {
    // Template drag (da biblioteca)
    dragState,
    startDragTemplate,
    updateDragPosition,
    endDragTemplate,
    cancelDrag,
    dropZoneRef,
    
    // Module drag (no canvas)
    dragModuleState,
    startDragModule,
    endDragModule,
  };
}
