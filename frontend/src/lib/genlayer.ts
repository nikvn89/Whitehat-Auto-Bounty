import { createClient } from 'genlayer-js';
import { simulator } from 'genlayer-js/chains';

export const CONTRACT_ADDRESS = '0xbcf9EE06A7Cb5bb74Da57b71F7dBfe4081BA09e3';

export const getClient = (account?: string) => {
  if (account) {
    return createClient({
      chain: simulator,
      account: account as `0x${string}`,
    });
  }
  return createClient({ chain: simulator });
};
