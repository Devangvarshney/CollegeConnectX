import random
import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas, auth
from ..email_utils import send_otp_email

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register")
def register(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    # Check if username or email exists in active users
    db_user = db.query(models.User).filter(
        (models.User.username == user_data.username) | 
        (models.User.email == user_data.email)
    ).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or Email already registered"
        )
    
    # Hash password
    hashed_password = auth.get_password_hash(user_data.password)
    
    # Create user
    new_user = models.User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Create profile
    new_profile = models.Profile(user_id=new_user.id)
    db.add(new_profile)
    db.commit()
    
    return {"detail": "Registration successful", "username": new_user.username}

@router.post("/verify-otp")
def verify_otp(verify_data: schemas.UserVerifyOTP, db: Session = Depends(get_db)):
    # Check if a pending registration exists
    db_otp = db.query(models.OTPVerification).filter(models.OTPVerification.email == verify_data.email).first()
    if not db_otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending registration found for this email"
        )
        
    # Check expiration
    if datetime.datetime.utcnow() > db_otp.expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Please request a new one."
        )
        
    # Check OTP match
    if db_otp.otp != verify_data.otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP code"
        )
        
    # Double-check username/email availability in final User table
    existing_user = db.query(models.User).filter(
        (models.User.username == db_otp.username) |
        (models.User.email == db_otp.email)
    ).first()
    if existing_user:
        db.delete(db_otp)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email has already been taken"
        )
        
    # Create the user
    new_user = models.User(
        username=db_otp.username,
        email=db_otp.email,
        hashed_password=db_otp.hashed_password
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Automatically create profile (mimics Django signal)
    new_profile = models.Profile(user_id=new_user.id)
    db.add(new_profile)
    
    # Delete the verification record
    db.delete(db_otp)
    db.commit()
    
    return {"detail": "Email verification successful", "username": new_user.username}

@router.post("/resend-otp")
def resend_otp(resend_data: schemas.OTPResend, db: Session = Depends(get_db)):
    db_otp = db.query(models.OTPVerification).filter(models.OTPVerification.email == resend_data.email).first()
    if not db_otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending registration found for this email"
        )
        
    # Generate new OTP and reset expiration
    otp = f"{random.randint(100000, 999999)}"
    db_otp.otp = otp
    db_otp.expires_at = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
    db_otp.created_at = datetime.datetime.utcnow()
    db.commit()
    
    # Send email with new OTP
    send_otp_email(db_otp.email, db_otp.username, otp)
    
    return {"detail": "New OTP sent to email"}

@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Authenticate user
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token = auth.create_access_token(data={"sub": user.username})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": user.username
    }

@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user
