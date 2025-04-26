# storage_service.py
import sqlite3

class DatabaseService:
    def __init__(self, db_path="/home/sarafshrey/tokenwise/backend/database/tokenwise.db"):
        self.conn = sqlite3.connect(db_path)
        self.cursor = self.conn.cursor()
    def get_wallet_address_by_position(self, position: int) -> str | None:
        query = """
            SELECT address
            FROM wallets
            ORDER BY balance DESC
            LIMIT 1 OFFSET ?
        """
        self.cursor.execute(query, (position-1,))
        result = self.cursor.fetchone()
        print("wallet address:",result[0])
        return result[0] if result else None

    def get_top_token_holders(self, limit=30):
        query = """
            SELECT address,balance
            FROM wallets
            ORDER BY balance DESC
            LIMIT ?
        """
        self.cursor.execute(query, (limit,))
        return self.cursor.fetchall()

    def get_wallet_transactions(self, wallet_position):
        wallet_address=self.get_wallet_address_by_position(wallet_position)
        query = """
            SELECT signature, timestamp, type, amount, price, protocol, counter_token_mint
            FROM transactions
            WHERE wallet = ?
            ORDER BY timestamp DESC
            LIMIT 30
        """
        self.cursor.execute(query, (wallet_address,))
        return self.cursor.fetchall()
    def get_wallet_transactions_in_range(self, wallet_position, start_timestamp, end_timestamp):
        wallet_address = self.get_wallet_address_by_position(wallet_position)
        # print(start_timestamp,end_timestamp)
        query = """
            SELECT signature, timestamp, type, amount, price, protocol, counter_token_mint
            FROM transactions
            WHERE wallet = ?
            AND timestamp BETWEEN ? AND ?
            ORDER BY timestamp DESC
        """
        self.cursor.execute(query, (wallet_address, start_timestamp, end_timestamp))
        return self.cursor.fetchall()

    def update_top_token_holders(self, holders):
        self.cursor.execute("DELETE FROM top_token_holders")
        self.cursor.executemany("""
            INSERT INTO top_token_holders (owner, token_balance)
            VALUES (?, ?)
        """, holders)
        self.conn.commit()
