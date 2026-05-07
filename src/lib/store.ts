import { create } from 'zustand'
import type { MeshNode, Channel } from '@/lib/types'

interface DashboardState {
  nodes: MeshNode[]
  channels: Channel[]
  isLoading: boolean
  selectedTab: string
  setSelectedTab: (tab: string) => void
  setNodes: (nodes: MeshNode[]) => void
  setChannels: (channels: Channel[]) => void
  setLoading: (loading: boolean) => void
  updateNode: (id: string, data: Partial<MeshNode>) => void
  updateChannel: (id: string, data: Partial<Channel>) => void
}

export const useDashboardStore = create<DashboardState>((set) => ({
  nodes: [],
  channels: [],
  isLoading: true,
  selectedTab: 'status',
  setSelectedTab: (tab) => set({ selectedTab: tab }),
  setNodes: (nodes) => set({ nodes }),
  setChannels: (channels) => set({ channels }),
  setLoading: (loading) => set({ isLoading: loading }),
  updateNode: (id, data) =>
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...data } : n)),
    })),
  updateChannel: (id, data) =>
    set((state) => ({
      channels: state.channels.map((c) => (c.id === id ? { ...c, ...data } : c)),
    })),
}))
