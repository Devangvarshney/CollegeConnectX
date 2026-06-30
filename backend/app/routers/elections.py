import os
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas, auth
from ..cloudinary_utils import upload_to_cloudinary

router = APIRouter(prefix="/elections", tags=["Elections"])

UPLOAD_DIR = "media/candidates"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# List of allowed positions to standardise the elections
ALLOWED_POSITIONS = ["President", "Vice President", "Secretary", "Treasurer"]

@router.post("/nominate", response_model=schemas.CandidateOut)
def nominate(
    position: str = Form(...),
    manifesto: str = Form(...),
    photo: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if position not in ALLOWED_POSITIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid election position. Allowed positions: {', '.join(ALLOWED_POSITIONS)}"
        )

    # Check if user is already a candidate for ANY position
    existing_candidate = db.query(models.Candidate).filter(models.Candidate.user_id == current_user.id).first()
    if existing_candidate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already running as a candidate in this election."
        )

    # Save campaign photo
    file_ext = os.path.splitext(photo.filename)[1]
    if file_ext.lower() not in [".jpg", ".jpeg", ".png", ".gif", ".webp"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image format. Allowed formats: PNG, JPG, JPEG, GIF, WEBP."
        )

    photo_path = upload_to_cloudinary(photo)

    # Create candidate
    new_candidate = models.Candidate(
        user_id=current_user.id,
        position=position,
        manifesto=manifesto,
        photo=photo_path
    )
    db.add(new_candidate)
    db.commit()
    db.refresh(new_candidate)

    return schemas.CandidateOut(
        id=new_candidate.id,
        user_id=new_candidate.user_id,
        username=current_user.username,
        avatar=current_user.profile.avatar if current_user.profile else None,
        position=new_candidate.position,
        manifesto=new_candidate.manifesto,
        photo=new_candidate.photo,
        created_at=new_candidate.created_at,
        votes_count=0,
        has_voted_for_this=False,
        has_voted_for_position=False
    )


@router.get("/candidates", response_model=List[schemas.CandidateOut])
def get_candidates(
    current_user: Optional[models.User] = Depends(auth.get_current_user_optional),
    db: Session = Depends(get_db)
):
    candidates = db.query(models.Candidate).all()
    out = []

    for c in candidates:
        votes_count = db.query(models.Vote).filter(models.Vote.candidate_id == c.id).count()
        
        has_voted_for_this = False
        has_voted_for_position = False

        if current_user:
            # Check if voted for this specific candidate
            voted_this = db.query(models.Vote).filter(
                models.Vote.candidate_id == c.id,
                models.Vote.user_id == current_user.id
            ).first()
            has_voted_for_this = voted_this is not None

            # Check if voted for any candidate for this position
            voted_pos = db.query(models.Vote).filter(
                models.Vote.position == c.position,
                models.Vote.user_id == current_user.id
            ).first()
            has_voted_for_position = voted_pos is not None

        out.append(schemas.CandidateOut(
            id=c.id,
            user_id=c.user_id,
            username=c.user.username,
            avatar=c.user.profile.avatar if c.user.profile else None,
            position=c.position,
            manifesto=c.manifesto,
            photo=c.photo,
            created_at=c.created_at,
            votes_count=votes_count,
            has_voted_for_this=has_voted_for_this,
            has_voted_for_position=has_voted_for_position
        ))

    return out


@router.delete("/candidates/{candidate_id}")
def withdraw_nomination(
    candidate_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    candidate = db.query(models.Candidate).filter(models.Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found."
        )

    if candidate.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only withdraw your own nomination."
        )

    # Delete photo file if exists
    if candidate.photo:
        relative_photo_path = candidate.photo.lstrip("/")
        if os.path.exists(relative_photo_path):
            try:
                os.remove(relative_photo_path)
            except Exception as e:
                print(f"Error removing file {relative_photo_path}: {e}")

    db.delete(candidate)
    db.commit()

    return {"detail": "Nomination withdrawn successfully."}


@router.post("/candidates/{candidate_id}/vote")
def cast_vote(
    candidate_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # Find candidate
    candidate = db.query(models.Candidate).filter(models.Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found."
        )

    # Check if voter has already voted for this position
    existing_vote = db.query(models.Vote).filter(
        models.Vote.user_id == current_user.id,
        models.Vote.position == candidate.position
    ).first()
    
    if existing_vote:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You have already voted for a candidate for the position of {candidate.position}."
        )

    # Cast vote
    new_vote = models.Vote(
        user_id=current_user.id,
        candidate_id=candidate.id,
        position=candidate.position
    )
    db.add(new_vote)
    db.commit()

    votes_count = db.query(models.Vote).filter(models.Vote.candidate_id == candidate.id).count()

    return {
        "detail": "Vote cast successfully",
        "candidate_id": candidate_id,
        "position": candidate.position,
        "votes_count": votes_count
    }


@router.get("/stats", response_model=List[schemas.ElectionPositionStats])
def get_stats(db: Session = Depends(get_db)):
    out = []
    
    for pos in ALLOWED_POSITIONS:
        candidates = db.query(models.Candidate).filter(models.Candidate.position == pos).all()
        total_votes = db.query(models.Vote).filter(models.Vote.position == pos).count()
        
        candidates_stats = []
        for c in candidates:
            votes_count = db.query(models.Vote).filter(models.Vote.candidate_id == c.id).count()
            candidates_stats.append(schemas.CandidateCompactStats(
                candidate_id=c.id,
                username=c.user.username,
                votes_count=votes_count
            ))
            
        # Sort candidates by votes_count descending (highest votes first)
        candidates_stats.sort(key=lambda x: x.votes_count, reverse=True)
        
        out.append(schemas.ElectionPositionStats(
            position=pos,
            total_votes=total_votes,
            candidates=candidates_stats
        ))
        
    return out
