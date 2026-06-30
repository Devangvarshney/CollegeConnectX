import os
import re
import contextvars
import datetime
from pymongo import MongoClient, ReturnDocument

# Initialize MongoDB Connection
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
client = MongoClient(MONGODB_URI)
db = client[os.getenv("MONGODB_DB_NAME", "collegeconnectx")]

# Thread-safe ContextVar to manage current request's session
current_session_var = contextvars.ContextVar("current_session", default=None)

# Base class for the declarative base
class Base:
    metadata = None

def get_db_client():
    session = current_session_var.get()
    if session:
        return session.db
    return db

def get_fallback_db():
    return db

def get_next_sequence_value(db_instance, sequence_name):
    """
    Generates auto-incrementing integer IDs using a counters collection.
    """
    result = db_instance.counters.find_one_and_update(
        {"_id": sequence_name},
        {"$inc": {"sequence_value": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    return result["sequence_value"]

def init_db():
    """
    Sets up required unique indexes on collections.
    """
    # Unique indexes
    db.users.create_index("username", unique=True)
    db.users.create_index("email", unique=True)
    db.profiles.create_index("user_id", unique=True)
    db.otp_verifications.create_index("email", unique=True)
    db.followers.create_index([("user_id", 1), ("followed_id", 1)], unique=True)
    db.likes.create_index([("tweet_id", 1), ("user_id", 1)], unique=True)
    db.votes.create_index([("user_id", 1), ("position", 1)], unique=True)
    db.candidates.create_index("user_id", unique=True)

class QueryExpr:
    def __init__(self, query_dict):
        self.query_dict = query_dict

    def __or__(self, other):
        left = self.query_dict
        right = other.query_dict if isinstance(other, QueryExpr) else other
        return QueryExpr({"$or": [left, right]})

    def __and__(self, other):
        left = self.query_dict
        right = other.query_dict if isinstance(other, QueryExpr) else other
        return QueryExpr({"$and": [left, right]})

    def __invert__(self):
        q = self.query_dict
        if len(q) == 1:
            key, val = list(q.items())[0]
            if isinstance(val, dict) and "$in" in val:
                return QueryExpr({key: {"$nin": val["$in"]}})
            if isinstance(val, dict) and "$eq" in val:
                return QueryExpr({key: {"$ne": val["$eq"]}})
        return QueryExpr({"$nor": [q]})

class Field:
    def __init__(self, name, model_class=None):
        self.name = name
        self.model_class = model_class

    def __eq__(self, other):
        return QueryExpr({(self.model_class, self.name): other})

    def __ne__(self, other):
        return QueryExpr({(self.model_class, self.name): {"$ne": other}})

    def __lt__(self, other):
        return QueryExpr({(self.model_class, self.name): {"$lt": other}})

    def __le__(self, other):
        return QueryExpr({(self.model_class, self.name): {"$lte": other}})

    def __gt__(self, other):
        return QueryExpr({(self.model_class, self.name): {"$gt": other}})

    def __ge__(self, other):
        return QueryExpr({(self.model_class, self.name): {"$gte": other}})

    def in_(self, other):
        return QueryExpr({(self.model_class, self.name): {"$in": list(other)}})

    def icontains(self, other):
        return QueryExpr({(self.model_class, self.name): re.compile(re.escape(str(other)), re.IGNORECASE)})

    def desc(self):
        return (self.name, -1)

    def asc(self):
        return (self.name, 1)

class RelationshipField:
    def __init__(self, id_list_field_name, target_model="User"):
        self.id_list_field_name = id_list_field_name
        self.target_model_name = target_model

    def any(self, **kwargs):
        val = list(kwargs.values())[0]
        return QueryExpr({(None, self.id_list_field_name): val})

    def __get__(self, instance, owner):
        if instance is None:
            return self
            
        from . import models
        target_model_class = getattr(models, self.target_model_name)
        
        db_instance = get_db_client()
        ids = getattr(instance, self.id_list_field_name) or []
        
        # Load related documents from MongoDB
        collection_name = target_model_class.__tablename__
        docs = list(db_instance[collection_name].find({"id": {"$in": ids}}))
        
        # Construct model instances and map them
        model_map = {doc["id"]: target_model_class(**doc) for doc in docs}
        items = [model_map[uid] for uid in ids if uid in model_map]
        
        return RelationshipList(items, instance, self.id_list_field_name)

class RelationshipList(list):
    def __init__(self, items, owner, id_field_name, item_id_attr="id"):
        super().__init__(items)
        self.owner = owner
        self.id_field_name = id_field_name
        self.item_id_attr = item_id_attr

    def append(self, item):
        super().append(item)
        ids = getattr(self.owner, self.id_field_name)
        if ids is None:
            ids = []
        item_id = getattr(item, self.item_id_attr)
        if item_id not in ids:
            # We copy list to trigger setattr and dirty tracking
            new_ids = list(ids)
            new_ids.append(item_id)
            setattr(self.owner, self.id_field_name, new_ids)

class MongoModelBase:
    __tablename__ = None
    _fields = []
    _defaults = {}

    def __init__(self, **kwargs):
        self.__dict__["_dirty"] = False
        session = current_session_var.get()
        self.__dict__["_session"] = session
        for k, v in kwargs.items():
            self.__dict__[k] = v
        for f in self._fields:
            if f not in self.__dict__ or self.__dict__[f] is None:
                if f in self._defaults:
                    val = self._defaults[f]
                    self.__dict__[f] = val() if callable(val) else val
                else:
                    self.__dict__[f] = None

    def __setattr__(self, key, value):
        if key in self._fields:
            old_value = self.__dict__.get(key)
            if old_value != value:
                self.__dict__[key] = value
                self.__dict__["_dirty"] = True
                if self._session:
                    self._session._mark_dirty(self)
        else:
            self.__dict__[key] = value

    def to_dict(self):
        res = {}
        for f in self._fields:
            val = self.__dict__.get(f)
            if isinstance(val, datetime.datetime):
                res[f] = val
            elif val is not None:
                res[f] = val
            else:
                res[f] = None
        return res

def merge_queries(queries):
    merged = {}
    and_clauses = []
    for q in queries:
        q_dict = q.query_dict if isinstance(q, QueryExpr) else q
        if not q_dict:
            continue
        overlap = False
        for k in q_dict:
            if k in merged or k in ("$or", "$and", "$nor"):
                overlap = True
                break
        if overlap:
            and_clauses.append(q_dict)
        else:
            merged.update(q_dict)
    if and_clauses:
        if merged:
            and_clauses.append(merged)
        return {"$and": and_clauses}
    return merged

def translate_query(db_instance, q, target_model):
    if isinstance(q, QueryExpr):
        return translate_query(db_instance, q.query_dict, target_model)
    if isinstance(q, dict):
        new_dict = {}
        for k, v in q.items():
            if isinstance(k, tuple):
                model_class, field_name = k
                val = translate_query(db_instance, v, target_model)
                
                # Check for RelationshipField markers (model_class is None)
                if model_class is None:
                    new_dict[field_name] = val
                elif model_class == target_model:
                    new_dict[field_name] = val
                else:
                    # Lookup mappings across collections
                    other_col = db_instance[model_class.__tablename__]
                    other_docs = list(other_col.find({field_name: val}))
                    
                    if model_class.__name__ == "User" and target_model.__name__ == "Tweet":
                        user_ids = [d["id"] for d in other_docs]
                        new_dict["user_id"] = {"$in": user_ids}
                    elif model_class.__name__ == "Comment" and target_model.__name__ == "Tweet":
                        tweet_ids = [d["tweet_id"] for d in other_docs]
                        new_dict["id"] = {"$in": tweet_ids}
                    elif model_class.__name__ == "User" and target_model.__name__ == "Comment":
                        user_ids = [d["id"] for d in other_docs]
                        new_dict["user_id"] = {"$in": user_ids}
                    elif model_class.__name__ == "User" and target_model.__name__ == "Follower":
                        user_ids = [d["id"] for d in other_docs]
                        new_dict["user_id"] = {"$in": user_ids}
                    else:
                        # Catch-all empty list constraint if no match found
                        new_dict["id"] = {"$in": []}
            elif k in ("$or", "$and", "$nor"):
                new_dict[k] = [translate_query(db_instance, item, target_model) for item in v]
            else:
                new_dict[k] = translate_query(db_instance, v, target_model)
        return new_dict
    if isinstance(q, list):
        return [translate_query(db_instance, item, target_model) for item in q]
    return q

class MongoQuery:
    def __init__(self, db_instance, model_or_field):
        self.db = db_instance
        if isinstance(model_or_field, Field):
            self.model = model_or_field.model_class
            self.project_field = model_or_field.name
        else:
            self.model = model_or_field
            self.project_field = None
            
        self.collection = db_instance[self.model.__tablename__]
        self.filters = []
        self.sort_fields = []
        self.limit_val = None

    def filter(self, *args):
        for arg in args:
            if arg:
                self.filters.append(arg)
        return self

    def order_by(self, *args):
        for arg in args:
            if isinstance(arg, tuple):
                self.sort_fields.append(arg)
            elif isinstance(arg, Field):
                self.sort_fields.append((arg.name, 1))
        return self

    def limit(self, limit):
        self.limit_val = limit
        return self

    def distinct(self):
        return self

    def outerjoin(self, *args, **kwargs):
        # We handle joins implicitly during query translation
        return self

    def all(self):
        query_dict = merge_queries(self.filters)
        translated = translate_query(self.db, query_dict, self.model)
        cursor = self.collection.find(translated)
        
        if self.sort_fields:
            cursor = cursor.sort(self.sort_fields)
        if self.limit_val is not None:
            cursor = cursor.limit(self.limit_val)
            
        results = []
        for doc in cursor:
            if self.project_field:
                results.append((doc.get(self.project_field),))
            else:
                results.append(self.model(**doc))
        return results

    def first(self):
        results = self.all()
        return results[0] if results else None

    def count(self):
        query_dict = merge_queries(self.filters)
        translated = translate_query(self.db, query_dict, self.model)
        return self.collection.count_documents(translated)

    def update(self, values, synchronize_session=False):
        query_dict = merge_queries(self.filters)
        translated = translate_query(self.db, query_dict, self.model)
        result = self.collection.update_many(translated, {"$set": values})
        return result.modified_count

class MongoSession:
    def __init__(self, client_instance, db_instance):
        self.client = client_instance
        self.db = db_instance
        self.new_objects = []
        self.deleted_objects = []
        self.dirty_objects = []

    def query(self, model_or_field):
        return MongoQuery(self.db, model_or_field)

    def add(self, instance):
        instance._session = self
        if instance not in self.new_objects:
            self.new_objects.append(instance)

    def delete(self, instance):
        if instance in self.new_objects:
            self.new_objects.remove(instance)
        elif instance not in self.deleted_objects:
            self.deleted_objects.append(instance)

    def _mark_dirty(self, instance):
        if instance not in self.new_objects and instance not in self.dirty_objects:
            self.dirty_objects.append(instance)

    def commit(self):
        # Insert new objects
        for obj in self.new_objects:
            if not getattr(obj, "id", None):
                obj.id = get_next_sequence_value(self.db, obj.__tablename__)
            data = obj.to_dict()
            self.db[obj.__tablename__].insert_one(data)
            obj._dirty = False
            
        # Update modified objects
        for obj in self.dirty_objects:
            data = obj.to_dict()
            self.db[obj.__tablename__].update_one({"id": obj.id}, {"$set": data})
            obj._dirty = False
            
        # Delete marked objects
        for obj in self.deleted_objects:
            self.db[obj.__tablename__].delete_one({"id": obj.id})

        self.new_objects.clear()
        self.dirty_objects.clear()
        self.deleted_objects.clear()

    def refresh(self, instance):
        doc = self.db[instance.__tablename__].find_one({"id": instance.id})
        if doc:
            for k, v in doc.items():
                instance.__dict__[k] = v
            instance._dirty = False

    def close(self):
        self.new_objects.clear()
        self.dirty_objects.clear()
        self.deleted_objects.clear()

SessionLocal = lambda: MongoSession(client, db)

def get_db():
    session = SessionLocal()
    current_session_var.set(session)
    try:
        yield session
    finally:
        session.close()
        current_session_var.set(None)
