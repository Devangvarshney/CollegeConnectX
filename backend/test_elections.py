import sqlite3
import datetime

DB_FILE = "collegeconnectx.db"

def clean_up():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Get user ids
    cursor.execute("SELECT id FROM users WHERE username IN ('test_candidate', 'test_voter1', 'test_voter2')")
    user_ids = [row[0] for row in cursor.fetchall()]
    
    if user_ids:
        placeholders = ",".join("?" for _ in user_ids)
        cursor.execute(f"DELETE FROM profiles WHERE user_id IN ({placeholders})", user_ids)
        cursor.execute(f"DELETE FROM votes WHERE user_id IN ({placeholders})", user_ids)
        cursor.execute(f"DELETE FROM candidates WHERE user_id IN ({placeholders})", user_ids)
        cursor.execute(f"DELETE FROM users WHERE id IN ({placeholders})", user_ids)
        
    conn.commit()
    conn.close()
    print("🧹 Database cleaned up of mock election data.")

def run_tests():
    clean_up()
    
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    print("\n--- Step 1: Creating Test Users ---")
    # Insert test users
    users_data = [
        ('test_candidate', 'test_cand@example.com', 'hashed_pass'),
        ('test_voter1', 'test_v1@example.com', 'hashed_pass'),
        ('test_voter2', 'test_v2@example.com', 'hashed_pass'),
    ]
    cursor.executemany(
        "INSERT INTO users (username, email, hashed_password, created_at) VALUES (?, ?, ?, datetime('now'))",
        users_data
    )
    conn.commit()
    
    # Get created user IDs
    cursor.execute("SELECT id, username FROM users WHERE username IN ('test_candidate', 'test_voter1', 'test_voter2')")
    user_map = {row[1]: row[0] for row in cursor.fetchall()}
    print(f"Created users map: {user_map}")
    
    print("\n--- Step 2: Nominating a Candidate ---")
    # Nominate test_candidate for President
    cursor.execute(
        "INSERT INTO candidates (user_id, position, manifesto, photo, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
        (user_map['test_candidate'], 'President', 'Free coffee for everyone!', '/media/candidates/test.jpg')
    )
    conn.commit()
    print("Successfully nominated candidate.")
    
    print("\n--- Step 3: Asserting Candidate Uniqueness ---")
    # Trying to nominate the same user again should fail (due to UNIQUE user_id constraint)
    try:
        cursor.execute(
            "INSERT INTO candidates (user_id, position, manifesto, photo, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
            (user_map['test_candidate'], 'Secretary', 'Double coffee!', '/media/candidates/test2.jpg')
        )
        conn.commit()
        assert False, "FAILED: Allowed nominating a user twice!"
    except sqlite3.IntegrityError:
        print("PASS: Prevented candidate from nominating twice.")
        conn.rollback()

    # Get Candidate ID
    cursor.execute("SELECT id FROM candidates WHERE user_id = ?", (user_map['test_candidate'],))
    candidate_id = cursor.fetchone()[0]

    print("\n--- Step 4: Casting Votes ---")
    # Voter 1 votes for candidate (President)
    cursor.execute(
        "INSERT INTO votes (user_id, candidate_id, position, created_at) VALUES (?, ?, ?, datetime('now'))",
        (user_map['test_voter1'], candidate_id, 'President')
    )
    # Voter 2 votes for candidate (President)
    cursor.execute(
        "INSERT INTO votes (user_id, candidate_id, position, created_at) VALUES (?, ?, ?, datetime('now'))",
        (user_map['test_voter2'], candidate_id, 'President')
    )
    conn.commit()
    print("Votes cast successfully for Voter 1 and Voter 2.")

    print("\n--- Step 5: Asserting Voting Constraints (One vote per position) ---")
    # Voter 1 tries to vote again for President (should fail due to UniqueConstraint("user_id", "position"))
    try:
        cursor.execute(
            "INSERT INTO votes (user_id, candidate_id, position, created_at) VALUES (?, ?, ?, datetime('now'))",
            (user_map['test_voter1'], candidate_id, 'President')
        )
        conn.commit()
        assert False, "FAILED: Allowed duplicate vote from the same voter for President!"
    except sqlite3.IntegrityError:
        print("PASS: Database correctly prevented a voter from voting twice for the same position.")
        conn.rollback()

    print("\n--- Step 6: Verifying Vote Standings Tally ---")
    cursor.execute("SELECT COUNT(*) FROM votes WHERE candidate_id = ?", (candidate_id,))
    votes_count = cursor.fetchone()[0]
    print(f"Total votes received by candidate: {votes_count}")
    assert votes_count == 2, f"FAILED: Expected 2 votes, got {votes_count}"
    print("PASS: Votes tally is correct!")

    conn.close()
    
    print("\n🎉 SUCCESS: All database integrity tests passed successfully!")
    clean_up()

if __name__ == '__main__':
    run_tests()
