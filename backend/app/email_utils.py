import os
import smtplib
import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
load_dotenv()
# Log file for local development testing
OTP_LOG_FILE = "otp_emails.log"

def send_otp_email(email: str, username: str, otp: str):
    # Retrieve SMTP settings from environment variables
    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME", "")

    smtp_password = os.getenv("SMTP_PASSWORD", "")
    smtp_sender = os.getenv("SMTP_SENDER", "")
    print("SMTP_SERVER =", os.getenv("SMTP_SERVER"))
    print("SMTP_PORT =", os.getenv("SMTP_PORT"))
    print("SMTP_USERNAME =", os.getenv("SMTP_USERNAME"))
    print("SMTP_PASSWORD =", "Loaded" if os.getenv("SMTP_PASSWORD") else None)
    print("SMTP_SENDER =", os.getenv("SMTP_SENDER"))
    # Generate HTML content
    html_content = f"""
    <html>
        <head>
            <style>
                .container {{
                    font-family: Arial, sans-serif;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    background-color: #ffffff;
                }}
                .header {{
                    text-align: center;
                    border-bottom: 2px solid #6366f1;
                    padding-bottom: 15px;
                }}
                .logo {{
                    font-size: 24px;
                    font-weight: bold;
                    color: #4f46e5;
                }}
                .content {{
                    padding: 20px 0;
                    color: #334155;
                }}
                .otp-box {{
                    text-align: center;
                    margin: 30px 0;
                }}
                .otp-code {{
                    font-size: 32px;
                    font-weight: bold;
                    letter-spacing: 5px;
                    color: #4f46e5;
                    background-color: #f1f5f9;
                    padding: 15px 30px;
                    border-radius: 8px;
                    display: inline-block;
                }}
                .footer {{
                    text-align: center;
                    font-size: 12px;
                    color: #94a3b8;
                    border-top: 1px solid #e2e8f0;
                    padding-top: 15px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <span class="logo">CollegeConnectX</span>
                </div>
                <div class="content">
                    <p>Hello <strong>{username}</strong>,</p>
                    <p>Thank you for registering at CollegeConnectX! To complete your registration, please verify your email address using the One-Time Password (OTP) below:</p>
                    <div class="otp-box">
                        <span class="otp-code">{otp}</span>
                    </div>
                    <p>This OTP is valid for 10 minutes. If you did not request this, you can safely ignore this email.</p>
                </div>
                <div class="footer">
                    <p>&copy; 2026 CollegeConnectX. All rights reserved.</p>
                </div>
            </div>
        </body>
    </html>
    """

    # Always log the OTP to a local file and console for easy development
    log_msg = f"[{datetime.datetime.utcnow().isoformat()}] To: {email} ({username}) | OTP: {otp}\n"
    try:
        with open(OTP_LOG_FILE, "a") as f:
            f.write(log_msg)
    except Exception as e:
        print(f"Failed to write OTP to log file: {e}")

    print("\n" + "="*50)
    print(f"✉️  EMAIL SENT TO: {email}")
    print(f"👤  USERNAME: {username}")
    print(f"🔑  OTP CODE: {otp}")
    print("="*50 + "\n")

    # If SMTP settings are not fully configured, log it and return (mock mode)
    if not smtp_server or not smtp_username or not smtp_password:
        print("ℹ️  SMTP is not fully configured. Email was simulated and logged to terminal and otp_emails.log.")
        return True

    # Try sending via real SMTP
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"CollegeConnectX Email Verification - OTP: {otp}"
        msg["From"] = smtp_sender
        msg["To"] = email

        part = MIMEText(html_content, "html")
        msg.attach(part)

        # Connect and send
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(smtp_username, smtp_password)
            server.sendmail(smtp_sender, email, msg.as_string())
        print(f"✅ Email successfully sent via SMTP to {email}")
        return True
    except Exception as e:
        print(f"❌ Error sending email via SMTP to {email}: {e}")
        return False
