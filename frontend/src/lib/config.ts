export const CONTRACT_ADDRESS =
  (import.meta.env.VITE_CONTRACT_ADDRESS as `0x${string}` | undefined) ??
  ('' as `0x${string}`)

export const STUDIO_RPC =
  (import.meta.env.VITE_STUDIO_RPC as string | undefined) ??
  'https://studio.genlayer.com/api'

export const EXPLORER_BASE =
  (import.meta.env.VITE_EXPLORER_BASE as string | undefined) ??
  'https://explorer-studio.genlayer.com'
