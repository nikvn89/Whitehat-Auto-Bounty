import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';

export const CONTRACT_ADDRESS = '0xbcf9EE06A7Cb5bb74Da57b71F7dBfe4081BA09e3';

const chain = {
  ...studionet,
  rpcUrls: {
    default: { http: ['https://studio.genlayer.com/api'] },
  },
};

export const getClient = (account?: string) => {
  // @ts-ignore
  const provider = typeof window !== 'undefined' ? window.ethereum : undefined;
  return createClient({
    chain,
    account: account as any,
    provider,
  });
};
