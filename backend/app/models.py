import datetime
from .database import Base, MongoModelBase, Field, RelationshipField, RelationshipList, get_db_client

class User(MongoModelBase):
    __tablename__ = "users"
    _fields = ["id", "username", "email", "hashed_password", "created_at"]
    _defaults = {
        "created_at": datetime.datetime.utcnow
    }

    id = Field("id")
    username = Field("username")
    email = Field("email")
    hashed_password = Field("hashed_password")
    created_at = Field("created_at")

    @property
    def profile(self):
        db = get_db_client()
        doc = db.profiles.find_one({"user_id": self.id})
        return Profile(**doc) if doc else None

    @property
    def tweets(self):
        db = get_db_client()
        docs = db.tweets.find({"user_id": self.id}).sort("created_at", -1)
        return [Tweet(**doc) for doc in docs]

    @property
    def comments(self):
        db = get_db_client()
        docs = db.comments.find({"user_id": self.id}).sort("created_at", -1)
        return [Comment(**doc) for doc in docs]

    @property
    def likes(self):
        db = get_db_client()
        docs = db.likes.find({"user_id": self.id})
        return [Like(**doc) for doc in docs]

    @property
    def conversations(self):
        db = get_db_client()
        docs = db.conversations.find({"participant_ids": self.id})
        return [Conversation(**doc) for doc in docs]

    @property
    def sent_messages(self):
        db = get_db_client()
        docs = db.messages.find({"sender_id": self.id}).sort("created_at", 1)
        return [Message(**doc) for doc in docs]


class Profile(MongoModelBase):
    __tablename__ = "profiles"
    _fields = ["id", "user_id", "bio", "location", "avatar"]
    _defaults = {
        "bio": "",
        "location": ""
    }

    id = Field("id")
    user_id = Field("user_id")
    bio = Field("bio")
    location = Field("location")
    avatar = Field("avatar")

    @property
    def user(self):
        db = get_db_client()
        doc = db.users.find_one({"id": self.user_id})
        return User(**doc) if doc else None


class Follower(MongoModelBase):
    __tablename__ = "followers"
    _fields = ["id", "user_id", "followed_id", "created_at"]
    _defaults = {
        "created_at": datetime.datetime.utcnow
    }

    id = Field("id")
    user_id = Field("user_id")
    followed_id = Field("followed_id")
    created_at = Field("created_at")

    @property
    def user(self):
        db = get_db_client()
        doc = db.users.find_one({"id": self.user_id})
        return User(**doc) if doc else None

    @property
    def followed(self):
        db = get_db_client()
        doc = db.users.find_one({"id": self.followed_id})
        return User(**doc) if doc else None


class Tweet(MongoModelBase):
    __tablename__ = "tweets"
    _fields = ["id", "user_id", "text", "photo", "video", "is_anonymous", "created_at", "updated_at"]
    _defaults = {
        "is_anonymous": False,
        "created_at": datetime.datetime.utcnow,
        "updated_at": datetime.datetime.utcnow
    }

    id = Field("id")
    user_id = Field("user_id")
    text = Field("text")
    photo = Field("photo")
    video = Field("video")
    is_anonymous = Field("is_anonymous")
    created_at = Field("created_at")
    updated_at = Field("updated_at")

    @property
    def user(self):
        db = get_db_client()
        doc = db.users.find_one({"id": self.user_id})
        return User(**doc) if doc else None

    @property
    def comments(self):
        db = get_db_client()
        docs = db.comments.find({"tweet_id": self.id}).sort("created_at", -1)
        return [Comment(**doc) for doc in docs]

    @property
    def likes(self):
        db = get_db_client()
        docs = db.likes.find({"tweet_id": self.id})
        return [Like(**doc) for doc in docs]


class Comment(MongoModelBase):
    __tablename__ = "comments"
    _fields = ["id", "tweet_id", "user_id", "text", "created_at"]
    _defaults = {
        "created_at": datetime.datetime.utcnow
    }

    id = Field("id")
    tweet_id = Field("tweet_id")
    user_id = Field("user_id")
    text = Field("text")
    created_at = Field("created_at")

    @property
    def tweet(self):
        db = get_db_client()
        doc = db.tweets.find_one({"id": self.tweet_id})
        return Tweet(**doc) if doc else None

    @property
    def user(self):
        db = get_db_client()
        doc = db.users.find_one({"id": self.user_id})
        return User(**doc) if doc else None


class Like(MongoModelBase):
    __tablename__ = "likes"
    _fields = ["id", "tweet_id", "user_id", "created_at"]
    _defaults = {
        "created_at": datetime.datetime.utcnow
    }

    id = Field("id")
    tweet_id = Field("tweet_id")
    user_id = Field("user_id")
    created_at = Field("created_at")

    @property
    def tweet(self):
        db = get_db_client()
        doc = db.tweets.find_one({"id": self.tweet_id})
        return Tweet(**doc) if doc else None

    @property
    def user(self):
        db = get_db_client()
        doc = db.users.find_one({"id": self.user_id})
        return User(**doc) if doc else None


class Conversation(MongoModelBase):
    __tablename__ = "conversations"
    _fields = ["id", "name", "is_group", "created_at", "participant_ids"]
    _defaults = {
        "is_group": False,
        "created_at": datetime.datetime.utcnow
    }

    id = Field("id")
    name = Field("name")
    is_group = Field("is_group")
    created_at = Field("created_at")
    participant_ids = Field("participant_ids")

    participants = RelationshipField("participant_ids")

    @property
    def messages(self):
        db = get_db_client()
        docs = db.messages.find({"conversation_id": self.id}).sort("created_at", 1)
        return [Message(**doc) for doc in docs]


class Message(MongoModelBase):
    __tablename__ = "messages"
    _fields = ["id", "conversation_id", "sender_id", "text", "is_read", "created_at"]
    _defaults = {
        "is_read": False,
        "created_at": datetime.datetime.utcnow
    }

    id = Field("id")
    conversation_id = Field("conversation_id")
    sender_id = Field("sender_id")
    text = Field("text")
    is_read = Field("is_read")
    created_at = Field("created_at")

    @property
    def conversation(self):
        db = get_db_client()
        doc = db.conversations.find_one({"id": self.conversation_id})
        return Conversation(**doc) if doc else None

    @property
    def sender(self):
        db = get_db_client()
        doc = db.users.find_one({"id": self.sender_id})
        return User(**doc) if doc else None





class Candidate(MongoModelBase):
    __tablename__ = "candidates"
    _fields = ["id", "user_id", "position", "manifesto", "photo", "created_at"]
    _defaults = {
        "created_at": datetime.datetime.utcnow
    }

    id = Field("id")
    user_id = Field("user_id")
    position = Field("position")
    manifesto = Field("manifesto")
    photo = Field("photo")
    created_at = Field("created_at")

    @property
    def user(self):
        db = get_db_client()
        doc = db.users.find_one({"id": self.user_id})
        return User(**doc) if doc else None

    @property
    def votes(self):
        db = get_db_client()
        docs = db.votes.find({"candidate_id": self.id})
        return [Vote(**doc) for doc in docs]


class Vote(MongoModelBase):
    __tablename__ = "votes"
    _fields = ["id", "user_id", "candidate_id", "position", "created_at"]
    _defaults = {
        "created_at": datetime.datetime.utcnow
    }

    id = Field("id")
    user_id = Field("user_id")
    candidate_id = Field("candidate_id")
    position = Field("position")
    created_at = Field("created_at")

    @property
    def candidate(self):
        db = get_db_client()
        doc = db.candidates.find_one({"id": self.candidate_id})
        return Candidate(**doc) if doc else None

    @property
    def voter(self):
        db = get_db_client()
        doc = db.users.find_one({"id": self.user_id})
        return User(**doc) if doc else None


# Bind model classes dynamically to their Field descriptors
for model_cls in [User, Profile, Follower, Tweet, Comment, Like, Conversation, Message,  Candidate, Vote]:
    for name, attr in list(model_cls.__dict__.items()):
        if isinstance(attr, Field):
            attr.model_class = model_cls
