from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# Profile schemas
class ProfileBase(BaseModel):
    bio: Optional[str] = ""
    location: Optional[str] = ""
    avatar: Optional[str] = None

class ProfileOut(ProfileBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True

# User schemas
class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserSimple(BaseModel):
    id: int
    username: str
    avatar: Optional[str] = None

    class Config:
        from_attributes = True

class UserOut(UserBase):
    id: int
    created_at: datetime
    profile: Optional[ProfileOut] = None

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    username: str

class UserVerifyOTP(BaseModel):
    email: EmailStr
    otp: str

class OTPResend(BaseModel):
    email: EmailStr

# Comment schemas
class CommentBase(BaseModel):
    text: str

class CommentCreate(CommentBase):
    pass

class CommentOut(BaseModel):
    id: int
    tweet_id: int
    user_id: int
    text: str
    created_at: datetime
    user: UserSimple

    class Config:
        from_attributes = True

# Like schemas
class LikeOut(BaseModel):
    id: int
    tweet_id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Post / Tweet schemas
class TweetOut(BaseModel):
    id: int
    user_id: int
    text: str
    photo: Optional[str] = None
    video: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    user: UserSimple
    comments: List[CommentOut] = []
    likes_count: int = 0
    is_liked: bool = False

    class Config:
        from_attributes = True

class TweetEdit(BaseModel):
    text: str

# Follow stats & relationships
class FollowStats(BaseModel):
    followers_count: int
    following_count: int

class UserProfileDetails(BaseModel):
    profile: ProfileOut
    username: str
    tweets: List[TweetOut] = []
    followers_count: int
    following_count: int
    is_following: bool = False
    is_mutual: bool = False

    class Config:
        from_attributes = True

# Messaging schemas
class MessageCreate(BaseModel):
    text: str

class MessageOut(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    text: str
    is_read: bool
    created_at: datetime
    sender_username: str

    class Config:
        from_attributes = True

class ConversationOut(BaseModel):
    id: int
    title: str
    avatar_letter: str
    last_message: str
    is_group: bool
    created_at: datetime
    participants: List[UserSimple] = []
    unread_count: int = 0

    class Config:
        from_attributes = True

class GroupCreate(BaseModel):
    name: str
    users: List[int]

class CandidateOut(BaseModel):
    id: int
    user_id: int
    username: str
    avatar: Optional[str] = None
    position: str
    manifesto: str
    photo: Optional[str] = None
    created_at: datetime
    votes_count: int
    has_voted_for_this: bool
    has_voted_for_position: bool

    class Config:
        from_attributes = True

class CandidateCompactStats(BaseModel):
    candidate_id: int
    username: str
    votes_count: int

class ElectionPositionStats(BaseModel):
    position: str
    total_votes: int
    candidates: List[CandidateCompactStats]


# Trok AI schemas
class ChatMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    text: str

class TrokChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []

class TrokChatResponse(BaseModel):
    reply: str


