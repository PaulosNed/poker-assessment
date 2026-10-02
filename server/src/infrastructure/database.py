from pathlib import Path

import psycopg


def initialize_database(database_url: str) -> None:
    """
    Create the initial schema atomically, also for an existing Compose
    volume.
    """
    with psycopg.connect(database_url) as connection:
        connection.execute(
            Path(__file__).with_name("sql").joinpath("schema.sql").read_text()
        )
