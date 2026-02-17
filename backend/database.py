"""SQLite database setup and operations for user profiles."""
import sqlite3
from contextlib import contextmanager
from typing import Optional
import os

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'instance', 'health_assistant.db')


def get_db_path():
    """Get database path, creating instance folder if needed."""
    instance_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'instance')
    os.makedirs(instance_path, exist_ok=True)
    return os.path.join(instance_path, 'health_assistant.db')


@contextmanager
def get_db():
    """Context manager for database connections."""
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row  # Return rows as dictionaries
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Initialize database tables."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.executescript('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                name TEXT NOT NULL,
                age INTEGER NOT NULL,
                gender TEXT,
                height_cm REAL,
                weight_kg REAL,
                existing_conditions TEXT,
                allergies TEXT,
                smoking_habit TEXT,
                alcohol_habit TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            );
        ''')
        conn.commit()


def create_user(username: str, password_hash: str) -> int:
    """Create a new user and return user ID."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO users (username, password_hash) VALUES (?, ?)',
            (username, password_hash)
        )
        return cursor.lastrowid


def get_user_by_username(username: str) -> Optional[dict]:
    """Get user by username."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM users WHERE username = ?', (username,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id: int) -> Optional[dict]:
    """Get user by ID."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def save_profile(user_id: int, profile_data: dict) -> None:
    """Save or update user profile."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO profiles (
                user_id, name, age, gender, height_cm, weight_kg,
                existing_conditions, allergies, smoking_habit, alcohol_habit
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                name = excluded.name,
                age = excluded.age,
                gender = excluded.gender,
                height_cm = excluded.height_cm,
                weight_kg = excluded.weight_kg,
                existing_conditions = excluded.existing_conditions,
                allergies = excluded.allergies,
                smoking_habit = excluded.smoking_habit,
                alcohol_habit = excluded.alcohol_habit,
                updated_at = CURRENT_TIMESTAMP
        ''', (
            user_id,
            profile_data.get('name', ''),
            profile_data.get('age', 0),
            profile_data.get('gender', ''),
            profile_data.get('height_cm'),
            profile_data.get('weight_kg'),
            profile_data.get('existing_conditions', ''),
            profile_data.get('allergies', ''),
            profile_data.get('smoking_habit', ''),
            profile_data.get('alcohol_habit', '')
        ))
        conn.commit()


def get_profile(user_id: int) -> Optional[dict]:
    """Get user profile by user ID."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM profiles WHERE user_id = ?', (user_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
