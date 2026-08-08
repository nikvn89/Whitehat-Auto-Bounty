import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';

export const CONTRACT_ADDRESS = '0xBB9503a2Df9A90561f8CD2679B25369980D7FfF3';

export const getClient = (account?: string) => {
  // @ts-ignore
  const provider = typeof window !== 'undefined' ? window.ethereum : undefined;
  if (account) {
    return createClient({
      chain: studionet,
      account: account as `0x${string}`,
      provider
    });
  }
  return createClient({ chain: studionet, provider });
};
