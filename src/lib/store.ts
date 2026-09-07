/**
 * Глобальный UI-стейт проекта (Zustand).
 * Реальные данные узлов/рёбер живут в React Query;
 * здесь — только эфемерные пользовательские настройки сессии.
 */
import { create } from 'zustand';
import type { TreeKey } from './utils';

interface CanvasState {
  activeTree: TreeKey;
  focusedNodeId: string | null;
  selectedNodeIds: Set<string>;
  showMinimap: boolean;
  showHypothesisTracker: boolean;
  sidebarCollapsed: boolean;

  setActiveTree: (t: TreeKey) => void;
  setFocused: (id: string | null) => void;
  toggleSelect: (id: string, additive?: boolean) => void;
  clearSelection: () => void;
  setSelection: (ids: string[]) => void;
  toggleMinimap: () => void;
  toggleHypothesisTracker: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebar: () => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  activeTree: 'DEV',
  focusedNodeId: null,
  selectedNodeIds: new Set(),
  showMinimap: true,
  showHypothesisTracker: false,
  sidebarCollapsed: false,

  setActiveTree: (t) => set({ activeTree: t, focusedNodeId: null }),
  setFocused: (id) => set({ focusedNodeId: id }),
  toggleSelect: (id, additive) =>
    set((s) => {
      const next = additive ? new Set(s.selectedNodeIds) : new Set<string>();
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedNodeIds: next };
    }),
  clearSelection: () => set({ selectedNodeIds: new Set() }),
  setSelection: (ids) => set({ selectedNodeIds: new Set(ids) }),
  toggleMinimap: () => set((s) => ({ showMinimap: !s.showMinimap })),
  toggleHypothesisTracker: () => set((s) => ({ showHypothesisTracker: !s.showHypothesisTracker })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
