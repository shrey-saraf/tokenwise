export interface WalletBalance {
  address: string;
  balance: number;
}

export interface Transaction {
  signature: string;
  wallet: string;
  amount: number;
  price: number;
  timestamp: number;
  type: string;
  protocol?: string;
  otherMint?:string;
}