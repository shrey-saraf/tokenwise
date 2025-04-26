# services/token_service.py
from storage.storage_service import DatabaseService
from collections import Counter, defaultdict
from decimal import Decimal, InvalidOperation
from zoneinfo import ZoneInfo
from datetime import datetime
# from blockchain import BlockchainService

db = DatabaseService()
# bc = BlockchainService()

def get_top_wallets():
    return db.get_top_token_holders()

def get_wallet_transactions(wallet):
    return db.get_wallet_transactions(wallet)

def summarize(wallet_position, start_time, end_time):
    transactions=db.get_wallet_transactions_in_range(wallet_position,start_time,end_time)
    # print(transactions)
    total_buys = Decimal(0)
    total_sells = Decimal(0)
    buy_prices = []
    sell_prices = []
    protocols = Counter()
    tx_types = Counter()

    if not transactions:
        print("No transactions to summarize.")
        return

    for tx in transactions:
        _, timestamp, tx_type, amount, price, protocol, _ = tx
        amount = Decimal(str(amount))
        try:
            price = Decimal(str(price)) if price is not None else None
        except InvalidOperation:
            price = None

        if tx_type == "BUY":
            total_buys += amount
            if price is not None:
                buy_prices.append(price)
        elif tx_type == "SELL":
            total_sells += amount
            if price is not None:
                sell_prices.append(price)

        protocols[protocol or "Unknown"] += 1
        tx_types[tx_type] += 1

    avg_buy_price = sum(buy_prices) / len(buy_prices) if buy_prices else None
    avg_sell_price = sum(sell_prices) / len(sell_prices) if sell_prices else None
    most_used_protocol = protocols.most_common(1)[0][0]

    first_ts = transactions[-1][1]
    last_ts = transactions[0][1]

    def to_ist(ts):
        return datetime.fromtimestamp(ts, ZoneInfo("Asia/Kolkata")).strftime('%Y-%m-%d %H:%M:%S')

    print("\n=== Wallet Transaction Summary ===")
    print(f"Total Transactions: {len(transactions)}")
    print(f"Buys: {tx_types['BUY']} | Sells: {tx_types['SELL']}")
    print(f"Total Buy Volume: {total_buys}")
    print(f"Total Sell Volume: {total_sells}")
    if avg_buy_price:
        print(f"Average Buy Price: {avg_buy_price:.6f}")
    if avg_sell_price:
        print(f"Average Sell Price: {avg_sell_price:.6f}")
    # print(f"Most Used Protocol: {most_used_protocol}")
    print(f"First Transaction: {to_ist(first_ts)}")
    print(f"Last Transaction: {to_ist(last_ts)}")
    print("==================================\n")

# def refresh_top_wallets():
#     holders = bc.fetch_top_token_holders()
#     db.update_top_token_holders(holders)
