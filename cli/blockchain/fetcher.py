# fetcher.py
from storage.storage_service import DatabaseService

def fetch_and_store_top_holders(token_address):
    db = DatabaseService()

    # Simulated dummy holders — replace with actual on-chain call
    holders = [
        ("wallet1", 10000),
        ("wallet2", 9500),
        ("wallet3", 9000),
    ]
    db.update_top_token_holders(holders)
    print("Top holders updated.")

def fetch_wallet_transactions(wallet_address):
    db = DatabaseService()
    txs = db.get_wallet_transactions(wallet_address)
    for tx in txs:
        print(tx)
