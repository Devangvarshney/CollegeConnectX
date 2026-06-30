import os
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import or_
from ..database import get_db
from .. import models, schemas, auth
from ..cloudinary_utils import upload_to_cloudinary

router = APIRouter(prefix="/posts", tags=["Posts"])

UPLOAD_DIR = "media/posts"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("", response_model=List[schemas.TweetOut])
def get_posts(
    q: Optional[str] = None,
    current_user: Optional[models.User] = Depends(auth.get_current_user_optional),
    db: Session = Depends(get_db)
):
    query = db.query(models.Tweet)
    
    if q:
        # Match tweet text, username of creator, or comments text
        # Join User and Comment tables for filter
        query = query.outerjoin(models.User, models.Tweet.user_id == models.User.id)\
                     .outerjoin(models.Comment, models.Comment.tweet_id == models.Tweet.id)\
                     .filter(
                          models.Tweet.text.icontains(q) |
                          models.User.username.icontains(q) |
                          models.Comment.text.icontains(q)
                     ).distinct()
                     
    # Order by newest
    tweets = query.order_by(models.Tweet.created_at.desc()).all()
    
    # Process output (calculate likes, is_liked)
    out = []
    for t in tweets:
        likes_count = db.query(models.Like).filter(models.Like.tweet_id == t.id).count()
        is_liked = False
        if current_user:
            like_exists = db.query(models.Like).filter(
                models.Like.tweet_id == t.id,
                models.Like.user_id == current_user.id
            ).first()
            is_liked = like_exists is not None

        # Build comments
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
            
        out.append(schemas.TweetOut(
            id=t.id,
            user_id=t.user_id,
            text=t.text,
            photo=t.photo,
            video=t.video,
            created_at=t.created_at,
            updated_at=t.updated_at,
            user=schemas.UserSimple(
                id=t.user.id,
                username=t.user.username,
                avatar=t.user.profile.avatar if t.user.profile else None
            ),
            comments=comments_out,
            likes_count=likes_count,
            is_liked=is_liked
        ))
        
    return out

@router.post("", response_model=schemas.TweetOut)
def create_post(
    text: str = Form(...),
    photo: Optional[UploadFile] = File(None),
    video: Optional[UploadFile] = File(None),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    photo_path = None
    video_path = None
    
    if photo is not None:
        photo_path = upload_to_cloudinary(photo)
            
    if video is not None:
        video_path = upload_to_cloudinary(video)
            
    new_tweet = models.Tweet(
        user_id=current_user.id,
        text=text,
        photo=photo_path,
        video=video_path
    )
    db.add(new_tweet)
    db.commit()
    db.refresh(new_tweet)
    
    # Return serializable object
    return schemas.TweetOut(
        id=new_tweet.id,
        user_id=new_tweet.user_id,
        text=new_tweet.text,
        photo=new_tweet.photo,
        video=new_tweet.video,
        created_at=new_tweet.created_at,
        updated_at=new_tweet.updated_at,
        user=schemas.UserSimple(
            id=current_user.id,
            username=current_user.username,
            avatar=current_user.profile.avatar if current_user.profile else None
        ),
        comments=[],
        likes_count=0,
        is_liked=False
    )

@router.put("/{tweet_id}", response_model=schemas.TweetOut)
def edit_post(
    tweet_id: int,
    tweet_edit: schemas.TweetEdit,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    tweet = db.query(models.Tweet).filter(
        models.Tweet.id == tweet_id,
        models.Tweet.user_id == current_user.id
    ).first()
    
    if not tweet:
        raise HTTPException(
            status_code=404, 
            detail="Post not found or you are not authorized to edit it"
        )
        
    tweet.text = tweet_edit.text
    db.commit()
    db.refresh(tweet)
    
    # Process likes/comments for returned object
    likes_count = db.query(models.Like).filter(models.Like.tweet_id == tweet.id).count()
    is_liked = db.query(models.Like).filter(
        models.Like.tweet_id == tweet.id,
        models.Like.user_id == current_user.id
    ).first() is not None

    comments_out = []
    for c in tweet.comments:
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

    return schemas.TweetOut(
        id=tweet.id,
        user_id=tweet.user_id,
        text=tweet.text,
        photo=tweet.photo,
        video=tweet.video,
        created_at=tweet.created_at,
        updated_at=tweet.updated_at,
        user=schemas.UserSimple(
            id=current_user.id,
            username=current_user.username,
            avatar=current_user.profile.avatar if current_user.profile else None
        ),
        comments=comments_out,
        likes_count=likes_count,
        is_liked=is_liked
    )

@router.delete("/{tweet_id}")
def delete_post(
    tweet_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    tweet = db.query(models.Tweet).filter(
        models.Tweet.id == tweet_id,
        models.Tweet.user_id == current_user.id
    ).first()
    
    if not tweet:
        raise HTTPException(
            status_code=404, 
            detail="Post not found or you are not authorized to delete it"
        )
        
    db.delete(tweet)
    db.commit()
    return {"status": "deleted"}

@router.post("/{tweet_id}/like")
def toggle_like(
    tweet_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    tweet = db.query(models.Tweet).filter(models.Tweet.id == tweet_id).first()
    if not tweet:
        raise HTTPException(status_code=404, detail="Post not found")
        
    like = db.query(models.Like).filter(
        models.Like.tweet_id == tweet_id,
        models.Like.user_id == current_user.id
    ).first()
    
    if like:
        db.delete(like)
        status_msg = "unliked"
        liked = False
    else:
        new_like = models.Like(tweet_id=tweet_id, user_id=current_user.id)
        db.add(new_like)
        status_msg = "liked"
        liked = True
        
    db.commit()
    likes_count = db.query(models.Like).filter(models.Like.tweet_id == tweet_id).count()
    
    return {
        "status": status_msg,
        "liked": liked,
        "count": likes_count
    }

@router.post("/{tweet_id}/comment", response_model=schemas.CommentOut)
def add_comment(
    tweet_id: int,
    comment_data: schemas.CommentCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    tweet = db.query(models.Tweet).filter(models.Tweet.id == tweet_id).first()
    if not tweet:
        raise HTTPException(status_code=404, detail="Post not found")
        
    new_comment = models.Comment(
        tweet_id=tweet_id,
        user_id=current_user.id,
        text=comment_data.text
    )
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)
    
    return schemas.CommentOut(
        id=new_comment.id,
        tweet_id=new_comment.tweet_id,
        user_id=new_comment.user_id,
        text=new_comment.text,
        created_at=new_comment.created_at,
        user=schemas.UserSimple(
            id=current_user.id,
            username=current_user.username,
            avatar=current_user.profile.avatar if current_user.profile else None
        )
    )
