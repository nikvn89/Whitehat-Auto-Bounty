import { createClient } from 'genlayer-js'
import { studionet } from 'genlayer-js/chains'
import { TransactionStatus } from 'genlayer-js/types'
import { getAddress } from 'viem'
import { CONTRACT_ADDRESS, STUDIO_RPC } from './config'

declare global {
  interface Window {
    ethereum?: {
      request: (args: {
        method: string
        params?: unknown[] | Record<string, unknown>
      }) => Promise<unknown>
    }
  }
}

export type BountyConfig = {
  owner: string
  docs_url: string
  bounty_critical_wei: number | string
  bounty_high_wei: number | string
  bounty_medium_wei: number | string
  bounty_low_wei: number | string
  is_active: boolean
  reports_count: number
  reserved_payouts_wei: number | string
}

export type PoolStatus = {
  balance_wei: number | string
  reserved_wei: number | string
  available_wei: number | string
}

export type BountyResult = {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INVALID'
  reason: string
  amount_wei: number | string
  payout_status: 'RESERVED' | 'UNDERFUNDED' | 'NO_PAYOUT'
}

const chain = {
  ...studionet,
  rpcUrls: {
    default: {
      http: [STUDIO_RPC],
    },
  },
}

const ensureContractAddress = () => {
  if (!CONTRACT_ADDRESS || !/^0x[a-fA-F0-9]{40}$/.test(CONTRACT_ADDRESS)) {
    throw new Error(
      'Set VITE_CONTRACT_ADDRESS in .env to the deployed Whitehat Auto Bounty contract address.',
    )
  }
  return CONTRACT_ADDRESS
}

export const normalizeAddress = (address: string) => getAddress(address)

const getClient = (account?: string) => {
  const provider = typeof window !== 'undefined' ? window.ethereum : undefined
  const checksummed = account ? normalizeAddress(account) : undefined

  return createClient({
    chain,
    account: checksummed as any,
    provider: provider as any,
  })
}

export async function connectWallet(): Promise<string> {
  if (!window.ethereum) {
    throw new Error('No browser wallet detected. Install MetaMask or a compatible wallet.')
  }

  const accounts = (await window.ethereum.request({
    method: 'eth_requestAccounts',
  })) as string[]

  if (!accounts?.[0]) {
    throw new Error('Wallet connection was not approved.')
  }

  return normalizeAddress(accounts[0])
}

const cleanString = (value: unknown) => String(value ?? '').replace(/^"|"$/g, '')

function parseJson<T>(value: unknown, fallback: T): T {
  try {
    if (typeof value === 'string') {
      let cleaned = value.trim()

      // GenLayer reads can sometimes return JSON encoded as a quoted string.
      if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
        try {
          cleaned = JSON.parse(cleaned)
        } catch {
          cleaned = cleaned.slice(1, -1).replace(/\\"/g, '"')
        }
      }

      return JSON.parse(cleaned) as T
    }

    return value as T
  } catch {
    return fallback
  }
}

async function read(functionName: string, args: Array<string> = []) {
  const client = getClient()

  return client.readContract({
    address: ensureContractAddress(),
    functionName,
    args,
    stateStatus: 'accepted',
  } as any)
}

async function writeAndWait(
  account: string,
  functionName: string,
  args: Array<string | boolean | number> = [],
  value: bigint = BigInt(0),
) {
  const client = getClient(account)

  // Official GenLayer browser-wallet flow requires connecting to Studionet
  // before sending the write transaction.
  await client.connect('studionet')

  const hash = await client.writeContract({
    address: ensureContractAddress(),
    functionName,
    args,
    value,
  })

  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    interval: 8_000,
    retries: 75,
  })

  return { hash, receipt }
}

export const parseGenToWei = (input: string): bigint => {
  const value = input.trim()

  if (!/^\d+(\.\d{0,18})?$/.test(value)) {
    throw new Error('Enter a valid GEN amount with at most 18 decimals.')
  }

  const [whole, fraction = ''] = value.split('.')
  const padded = (fraction + '0'.repeat(18)).slice(0, 18)

  return BigInt(whole) * BigInt('1000000000000000000') + BigInt(padded || '0')
}

export const formatWei = (raw: number | string | bigint | undefined): string => {
  let value: bigint

  try {
    value = BigInt(raw ?? 0)
  } catch {
    value = BigInt(0)
  }

  const unit = BigInt('1000000000000000000')
  const whole = value / unit
  const fraction = (value % unit).toString().padStart(18, '0').replace(/0+$/, '')

  return fraction ? `${whole}.${fraction.slice(0, 4)}` : whole.toString()
}

export const bounty = {
  getConfig: async (): Promise<BountyConfig> =>
    parseJson<BountyConfig>(
      await read('get_config'),
      {
        owner: '',
        docs_url: '',
        bounty_critical_wei: 0,
        bounty_high_wei: 0,
        bounty_medium_wei: 0,
        bounty_low_wei: 0,
        is_active: false,
        reports_count: 0,
        reserved_payouts_wei: 0,
      },
    ),

  getPoolStatus: async (): Promise<PoolStatus> =>
    parseJson<PoolStatus>(
      await read('get_pool_status'),
      {
        balance_wei: 0,
        reserved_wei: 0,
        available_wei: 0,
      },
    ),

  getPendingPayout: async (address: string): Promise<string> =>
    cleanString(await read('get_pending_payout', [normalizeAddress(address)])),

  getResult: async (address: string): Promise<BountyResult | null> => {
    const raw = cleanString(await read('get_result', [normalizeAddress(address)]))
    if (!raw) return null
    return parseJson<BountyResult | null>(raw, null)
  },

  hasSubmitted: async (address: string): Promise<boolean> =>
    Boolean(await read('has_submitted', [normalizeAddress(address)])),

  fundPool: (account: string, amountWei: bigint) =>
    writeAndWait(account, 'fund_pool', [], amountWei),

  submitReport: (account: string, bugDescription: string, evidenceUrl: string) =>
    writeAndWait(account, 'submit_report', [
      bugDescription.trim(),
      evidenceUrl.trim(),
    ]),

  withdraw: (account: string) =>
    writeAndWait(account, 'withdraw'),

  updateDocsUrl: (account: string, docsUrl: string) =>
    writeAndWait(account, 'update_docs_url', [docsUrl.trim()]),

  setActive: (account: string, active: boolean) =>
    writeAndWait(account, 'set_active', [active]),

  configureBounties: (
    account: string,
    criticalWei: number,
    highWei: number,
    mediumWei: number,
    lowWei: number,
  ) =>
    writeAndWait(account, 'configure_bounties', [
      criticalWei,
      highWei,
      mediumWei,
      lowWei,
    ]),
}
