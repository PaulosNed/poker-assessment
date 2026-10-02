"""
Real HTTP API + real PostgreSQL. Run with the backend-tests Compose
service.
"""

import os
from pathlib import Path
import socket
import subprocess
import sys
import time
from uuid import uuid4

import httpx
import psycopg
from psycopg import sql
from psycopg.conninfo import make_conninfo
import pytest


@pytest.fixture(scope="session")
def running_api(tmp_path_factory):
    database_url = os.environ["TEST_DATABASE_URL"]
    schema = f"poker_test_{uuid4().hex}"
    with psycopg.connect(database_url, autocommit=True) as connection:
        connection.execute(
            sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema))
        )
    test_url = make_conninfo(database_url, options=f"-c search_path={schema}")
    log_path = tmp_path_factory.mktemp("api") / "server.log"
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    with log_path.open("w") as log:
        process = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "main:app",
                "--host",
                "127.0.0.1",
                "--port",
                str(port),
            ],
            cwd=Path(__file__).resolve().parents[1],
            env={**os.environ, "DATABASE_URL": test_url},
            stdout=log,
            stderr=subprocess.STDOUT,
        )
        try:
            with httpx.Client(
                base_url=f"http://127.0.0.1:{port}", timeout=15
            ) as client:
                for _ in range(100):
                    if process.poll() is not None:
                        pytest.fail(log_path.read_text())
                    try:
                        if client.get("/health").status_code == 200:
                            break
                    except httpx.ConnectError:
                        pass
                    time.sleep(0.1)
                else:
                    pytest.fail("API did not start:\n" + log_path.read_text())
                yield client, test_url, log_path
        finally:
            process.terminate()
            process.wait(timeout=10)
            with psycopg.connect(database_url, autocommit=True) as connection:
                connection.execute(
                    sql.SQL("DROP SCHEMA {} CASCADE").format(
                        sql.Identifier(schema)
                    )
                )


@pytest.fixture
def api(running_api):
    client, database_url, log_path = running_api
    with psycopg.connect(database_url) as connection:
        connection.execute("TRUNCATE actions, player_hands, hands")
    return client, database_url, log_path
