import os
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas, auth
from ..cloudinary_utils import upload_to_cloudinary

router = APIRouter(prefix="/users", tags=["Users"])

UPLOAD_DIR = "media/avatars"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("/suggested", response_model=List[schemas.UserSimple])
def get_suggested_users(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # Get IDs of people the current user is following
    following_ids = db.query(models.Follower.followed_id).filter(
        models.Follower.user_id == current_user.id
    ).all()
    following_ids = [fid[0] for fid in following_ids]

    # Exclude current user and people they already follow
    users = db.query(models.User).filter(
        models.User.id != current_user.id,
        ~models.User.id.in_(following_ids)
    ).limit(7).all()
    
    # Format responses
    out_users = []
    for u in users:
        avatar = u.profile.avatar if u.profile else None
        out_users.append(schemas.UserSimple(id=u.id, username=u.username, avatar=avatar))
    return out_users

@router.get("/search", response_model=List[schemas.UserSimple])
def search_users(
    q: Optional[str] = "",
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    query = q.strip()
    if not query:
        return []
        
    # Find users whose username contains query (excluding the logged-in user)
    users = db.query(models.User).filter(
        models.User.username.icontains(query),
        models.User.id != current_user.id
    ).limit(10).all()
    
    out_users = []
    for u in users:
        avatar = u.profile.avatar if u.profile else None
        out_users.append(schemas.UserSimple(id=u.id, username=u.username, avatar=avatar))
    return out_users

@router.get("/profile/{username}", response_model=schemas.UserProfileDetails)
def get_user_profile(
    username: str,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(auth.get_current_user_optional)
):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    profile = user.profile
    if not profile:
        profile = models.Profile(user_id=user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)

    # Followers count (relations where followed_id is user.id)
    followers_count = db.query(models.Follower).filter(models.Follower.followed_id == user.id).count()
    # Following count (relations where user_id is user.id)
    following_count = db.query(models.Follower).filter(models.Follower.user_id == user.id).count()

    is_following = False
    is_mutual = False
    if current_user and current_user.id != user.id:
        # Check if current_user follows user
        follows_target = db.query(models.Follower).filter(
            models.Follower.user_id == current_user.id,
            models.Follower.followed_id == user.id
        ).first()
        is_following = follows_target is not None

        # Check if mutual
        follows_me = db.query(models.Follower).filter(
            models.Follower.user_id == user.id,
            models.Follower.followed_id == current_user.id
        ).first()
        is_mutual = is_following and (follows_me is not None)

    # Fetch user tweets/posts
    tweets = db.query(models.Tweet).filter(models.Tweet.user_id == user.id).order_by(models.Tweet.created_at.desc()).all()
    
    # Process tweets to compute likes/is_liked
    processed_tweets = []
    for t in tweets:
        likes_count = db.query(models.Like).filter(models.Like.tweet_id == t.id).count()
        is_liked_by_me = False
        if current_user:
            like_exists = db.query(models.Like).filter(
                models.Like.tweet_id == t.id,
                models.Like.user_id == current_user.id
            ).first()
            is_liked_by_me = like_exists is not None

        # Serialize comments
        comments_out = []
        for c in t.comments:
            comments_out.append(schemas.CommentOut(
                id=c.id,
                tweet_id=c.tweet_id,
                user_id=c.user_id,
                text=c.text,
                created_at=c.created_at,
                user=schemas.UserSimple(
                    id=c.user.id,
                    username=c.user.username,
                    avatar=c.user.profile.avatar if c.user.profile else None
                )
            ))
            
        processed_tweets.append(schemas.TweetOut(
            id=t.id,
            user_id=t.user_id,
            text=t.text,
            photo=t.photo,
            video=t.video,
            created_at=t.created_at,
            updated_at=t.updated_at,
            user=schemas.UserSimple(
                id=user.id,
                username=user.username,
                avatar=profile.avatar
            ),
            comments=comments_out,
            likes_count=likes_count,
            is_liked=is_liked_by_me
        ))

    return schemas.UserProfileDetails(
        profile=schemas.ProfileOut(
            id=profile.id,
            user_id=profile.user_id,
            bio=profile.bio,
            location=profile.location,
            avatar=profile.avatar
        ),
        username=user.username,
        tweets=processed_tweets,
        followers_count=followers_count,
        following_count=following_count,
        is_following=is_following,
        is_mutual=is_mutual
    )

@router.put("/profile", response_model=schemas.ProfileOut)
def update_profile(
    bio: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    avatar: Optional[UploadFile] = File(None),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    profile = current_user.profile
    if not profile:
        profile = models.Profile(user_id=current_user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)

    # Explicitly bind the profile to the active database session
    profile._session = db

    if bio is not None:
        profile.bio = bio
    if location is not None:
        profile.location = location
        
    if avatar is not None:
        profile.avatar = upload_to_cloudinary(avatar)

    db.commit()
    db.refresh(profile)
    return profile

@router.post("/follow/{username}")
def toggle_follow(
    username: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    target_user = db.query(models.User).filter(models.User.username == username).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if target_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    # Check relation
    relation = db.query(models.Follower).filter(
        models.Follower.user_id == current_user.id,
        models.Follower.followed_id == target_user.id
    ).first()

    if relation:
        db.delete(relation)
        status = "unfollowed"
        following = False
    else:
        new_relation = models.Follower(user_id=current_user.id, followed_id=target_user.id)
        db.add(new_relation)
        status = "followed"
        following = True
        
    db.commit()

    followers_count = db.query(models.Follower).filter(models.Follower.followed_id == target_user.id).count()
    
    return {
        "status": status,
        "following": following,
        "followers_count": followers_count
    }

@router.get("/followers/{username}", response_model=List[schemas.UserSimple])
def get_followers(username: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    followers = db.query(models.Follower).filter(models.Follower.followed_id == user.id).all()
    
    out = []
    for f in followers:
        follower_user = f.user
        out.append(schemas.UserSimple(
            id=follower_user.id,
            username=follower_user.username,
            avatar=follower_user.profile.avatar if follower_user.profile else None
        ))
    return out

@router.get("/following/{username}", response_model=List[schemas.UserSimple])
def get_following(username: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    following = db.query(models.Follower).filter(models.Follower.user_id == user.id).all()
    
    out = []
    for f in following:
        followed_user = f.followed
        out.append(schemas.UserSimple(
            id=followed_user.id,
            username=followed_user.username,
            avatar=followed_user.profile.avatar if followed_user.profile else None
        ))
    return out
