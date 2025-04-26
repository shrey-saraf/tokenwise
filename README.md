# TokenWise

TokenWise is a tool for monitoring the top wallets by volume for a token hosted on the Solana blockchain.

## Prerequisites

- Node.js (>= 18.x)
- npm
- Python 3
- Solana RPC endpoint (e.g., [QuickNode Free Tier](https://www.quicknode.com/))

## Setup Instructions

1. **Clone the repository:**

```bash
git clone https://github.com/shrey-saraf/tokenwise.git
cd tokenwise
```

2. **Start the backend API server:**

```bash
cd backend
npm install
npm run dev
```

3. **Use the CLI:**

Open a new terminal, then:

```bash
cd tokenwise/cli
```

Here you can run various commands:

### Commands

- **Display the top 30 wallets:**

```bash
python3 cli.py top_wallets
```

- **Display recent transactions for a specific wallet:**

```bash
python3 cli.py wallet_transactions <wallet_position>
```

Replace `<wallet_position>` with the wallet's rank (e.g., `3` for the third-largest wallet).

Example:

```bash
python3 cli.py wallet_transactions 3
```

- **Refresh the list of top wallets:**

```bash
python3 cli.py refresh
```

- **Generate a summary report for a wallet within a time frame:**

```bash
python3 cli.py summarize <wallet_position> --start_date <YYYY-MM-DD> --end_date <YYYY-MM-DD>
```

Example:

```bash
python3 cli.py summarize 5 --start_date 2025-04-01 --end_date 2025-04-10
```

This generates a report covering all transactions from 12 AM of the start date to 12 AM of the end date.

---



