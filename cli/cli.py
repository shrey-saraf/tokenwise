# cli.py
import argparse
from services import token_service
import datetime
import pytz
from zoneinfo import ZoneInfo
from solders.pubkey import Pubkey
from solana.rpc.api import Client
from solana.rpc.types import TokenAccountOpts
from decimal import Decimal
import requests
# import base58
import struct

# Initialize Solana RPC client
solana_client = Client("https://api.mainnet-beta.solana.com")

# Metaplex metadata program ID
METAPLEX_PROGRAM_ID = Pubkey.from_string("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")

# Cache for mint address to symbol mapping
mint_to_symbol = {
    "So11111111111111111111111111111111111111112": "SOL",
    "Es9vMFrzaCERWk5aZ8c9avH75CA1aE34zRHJfF5uX3bD": "USDT",
    "7XSgghYt92nA8AXtLxLqTTCFFuR1EK4gEG7mpyx3zWZp": "JUP",
    "None": "",
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v":"USDC",
    "WEmjxPMGXEW1Nvc4rCgRKiWHj1H1tvhPsKMw2yvpump":"Digimon",
}

def get_metadata_pda(mint_address: Pubkey) -> Pubkey:
    """Derive the metadata PDA for a given mint address."""
    seeds = [
        b"metadata",
        bytes(METAPLEX_PROGRAM_ID),
        bytes(mint_address),
    ]
    return Pubkey.find_program_address(seeds, METAPLEX_PROGRAM_ID)[0]

def get_token_symbol(mint_address: str) -> str:
    """Resolve the token symbol for a given mint address."""
    # Check cache first
    if mint_address in mint_to_symbol:
        return mint_to_symbol[mint_address]

    try:
        # Validate mint address
        mint_pubkey = Pubkey.from_string(mint_address)
    except ValueError:
        mint_to_symbol[mint_address] = f"INV({mint_address[:4]})"
        return mint_to_symbol[mint_address]

    try:
        # Get the metadata account PDA
        metadata_pda = get_metadata_pda(mint_pubkey)

        # Fetch account info for the metadata PDA
        resp = solana_client.get_account_info(metadata_pda)
        if not resp.value:
            # No metadata found
            symbol = f"UNK({mint_address[:4]})"
            mint_to_symbol[mint_address] = symbol
            return symbol

        # Parse metadata (simplified, assumes Metaplex metadata format)
        account_data = resp.value.data
        if len(account_data) < 100:  # Basic length check
            symbol = f"ERR({mint_address[:4]})"
            mint_to_symbol[mint_address] = symbol
            return symbol

        # Extract symbol from metadata (Metaplex format)
        # Symbol is at offset 33 + name_length (variable-length strings)
        name_length = struct.unpack("<I", account_data[32:36])[0]
        symbol_offset = 36 + name_length
        symbol_length = struct.unpack("<I", account_data[symbol_offset:symbol_offset + 4])[0]
        symbol = account_data[symbol_offset + 4:symbol_offset + 4 + symbol_length].decode("utf-8").strip()

        if not symbol:
            symbol = f"TOK({mint_address[:4]})"

        # Cache and return the symbol
        mint_to_symbol[mint_address] = symbol
        return symbol

    except Exception as e:
        # Log specific errors for debugging
        print(f"Error fetching metadata for {mint_address}: {str(e)}")
        symbol = f"ERR({mint_address[:4]})"
        mint_to_symbol[mint_address] = symbol
        return symbol


def main():
    parser = argparse.ArgumentParser(description="TokenWise CLI")
    subparsers = parser.add_subparsers(dest="command")

    # Top wallets command
    subparsers.add_parser("top_wallets", help="Show top 30 token holders")

    # Wallet transactions command
    wallet_parser = subparsers.add_parser("wallet_transactions", help="Show recent transactions for a wallet")
    wallet_parser.add_argument("wallet_position", type=int, help="Position of the wallet in the table")

    # Refresh command
    subparsers.add_parser("refresh", help="Refresh top 30 wallets")

    #Summary command
    summary_parser=subparsers.add_parser("summarize",help="Give summary report for a wallet in a given time frame")
    summary_parser.add_argument("wallet_position", type=int, help="Position of the wallet in the table")
    summary_parser.add_argument("--start_date", type=str, help="Start date in YYYY-MM-DD format")
    summary_parser.add_argument("--end_date", type=str, help="End date in YYYY-MM-DD format")

    args = parser.parse_args()

    if args.command == "top_wallets":
        wallets = token_service.get_top_wallets()
        for i, wallet in enumerate(wallets, 1):
            print(f"{i}. {wallet[0]} - {wallet[1]} tokens")

    elif args.command == "wallet_transactions":
        txs = token_service.get_wallet_transactions(args.wallet_position)
        for tx in txs:
            # Accessing by index positions
            timestamp = tx[1]  # timestamp is the second field (index 1)
            
            # Convert timestamp to a human-readable format
            readable_timestamp = datetime.datetime.fromtimestamp(timestamp, ZoneInfo("Asia/Kolkata"))

            tx_type = tx[2]  # type is the third field (index 2)
            amount = tx[3]  # amount is the fourth field (index 3)
            price = tx[4]  # price is the fifth field (index 4)
            protocol = tx[5]  # protocol is the sixth field (index 5)
            counter_token_mint = tx[6]  # counter_token_mint is the seventh field (index 6)
            token_symbol = get_token_symbol(counter_token_mint) if counter_token_mint else "?"
            # Building the output string
            output = f"{readable_timestamp} - {tx_type} {amount}"
            # print(price,protocol)
            # Add price if it's not None or empty

            if price not in [None, 'None', '']:
                price_decimal = Decimal(price).quantize(Decimal('1.00000'))
                output += f" at {price_decimal} {token_symbol}"

        # Add protocol if it's not None or empty
            if protocol !='Unknown':
                output += f" via {protocol}"
            GREEN = '\033[92m'
            RED = '\033[91m'
            RESET = '\033[0m'

            color = GREEN if tx_type == "BUY" else RED
            print(f"{color}{output}{RESET}")

            # print(output)

    elif args.command == "refresh":
        response = requests.post("http://localhost:3000/api/refresh")
        if response.ok:
            print("✅ Refresh successful:", response.json())
        else:
            print("❌ Refresh failed:", response.status_code, response.text)
        # print("Top wallets refreshed.")

    elif args.command == "summarize":
        ist = pytz.timezone('Asia/Kolkata')
        
        start_dt = datetime.datetime.strptime(args.start_date, "%Y-%m-%d")
        start_ts=ist.localize(start_dt)
        end_dt=datetime.datetime.strptime(args.end_date, "%Y-%m-%d")
        end_ds=ist.localize(end_dt)
        # print(start_dt,end_dt)
        token_service.summarize(args.wallet_position,start_ts.timestamp(),end_ds.timestamp())

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
