import { PublicKey } from '@solana/web3.js';

export const formatDate = (timestamp: number): string => {
  return new Date(timestamp * 1000).toISOString();
};

export const validatePublicKey = (key: string): boolean => {
  try {
    // Check length and base58 format
    if (key.length < 32 || key.length > 44 || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(key)) {
      console.warn(`Invalid public key format: ${key}`);
      return false;
    }
    // Attempt to create a PublicKey object to validate
    new PublicKey(key);
    return true;
  } catch (error) {
    console.warn(`Invalid public key: ${key}, error: ${error}`);
    return false;
  }
};
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};
export const debugLog = (message: string, data?: any) => {
  console.log(`[DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : '');
};