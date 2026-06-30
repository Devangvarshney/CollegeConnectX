import urllib.request
import urllib.parse
import json
import sqlite3
import time

API_BASE = "http://localhost:8000"



def clean_up_user(username, email):
    conn = sqlite3.connect("collegeconnectx.db")
    cursor = conn.cursor()
    # Delete from profiles (user_id relation)
    cursor.execute("SELECT id FROM users WHERE username = ? OR email = ?", (username, email))
    user_row = cursor.fetchone()
    if user_row:
        user_id = user_row[0]
        cursor.execute("DELETE FROM profiles WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM users WHERE username = ? OR email = ?", (username, email))
    cursor.execute("DELETE FROM otp_verifications WHERE email = ?", (email,))
    conn.commit()
    conn.close()
    print(f"🧹 Cleaned up any existing/test data for username: {username}, email: {email}")

def make_post_request(url, data_dict):
    req = urllib.request.Request(
        url,
        data=json.dumps(data_dict).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req) as response:
            return response.status, json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8'))

def test_flow():
    test_user = "test_otp_user"
    test_email = "test_otp@example.com"
    test_pwd = "TestPassword123!"

    # 0. Cleanup first
    clean_up_user(test_user, test_email)

    print("\n--- Step 1: Register User ---")
    register_payload = {
        "username": test_user,
        "email": test_email,
        "password": test_pwd
    }
    status, res = make_post_request(f"{API_BASE}/api/auth/register", register_payload)
    print(f"Register status: {status}")
    print(f"Register response: {res}")
    
    assert status == 200, "Registration failed"
    assert "OTP sent to email" in res.get("detail", ""), "Unexpected response detail"

    print("\n--- Step 2: Retrieve OTP from database ---")
    otp = get_latest_otp(test_email)
    print(f"Retrieved OTP code: {otp}")
    assert otp is not None, "OTP not found in database table"

    print("\n--- Step 3: Verify OTP with incorrect code first ---")
    verify_payload_bad = {
        "email": test_email,
        "otp": "000000"
    }
    status_bad, res_bad = make_post_request(f"{API_BASE}/api/auth/verify-otp", verify_payload_bad)
    print(f"Verify (bad code) status: {status_bad}")
    print(f"Verify (bad code) response: {res_bad}")
    assert status_bad == 400, "Should fail with bad code"

    print("\n--- Step 4: Verify OTP with correct code ---")
    verify_payload_good = {
        "email": test_email,
        "otp": otp
    }
    status_good, res_good = make_post_request(f"{API_BASE}/api/auth/verify-otp", verify_payload_good)
    print(f"Verify (good code) status: {status_good}")
    print(f"Verify (good code) response: {res_good}")
    assert status_good == 200, "Verification should succeed"

    print("\n--- Step 5: Try to login with the verified user ---")
    # Login endpoint uses OAuth2PasswordRequestForm (form-encoded)
    login_data = urllib.parse.urlencode({
        "username": test_user,
        "password": test_pwd
    }).encode('utf-8')
    
    req = urllib.request.Request(
        f"{API_BASE}/api/auth/login",
        data=login_data,
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req) as response:
            login_status = response.status
            login_res = json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        login_status = e.code
        login_res = json.loads(e.read().decode('utf-8'))
        
    print(f"Login status: {login_status}")
    print(f"Login response: {login_res}")
    
    assert login_status == 200, "Login failed"
    assert "access_token" in login_res, "Access token not in login response"
    print("\n🎉 SUCCESS: All API integration tests passed!")

    # Cleanup afterwards
    clean_up_user(test_user, test_email)

if __name__ == '__main__':
    test_flow()
