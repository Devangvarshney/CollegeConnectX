from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas, auth

class ConnectionManager:
    def __init__(self):
        # Maps convo_id -> list of WebSockets
        self.active_connections = {}

    async def connect(self, websocket: WebSocket, convo_id: int):
        await websocket.accept()
        if convo_id not in self.active_connections:
            self.active_connections[convo_id] = []
        self.active_connections[convo_id].append(websocket)

    def disconnect(self, websocket: WebSocket, convo_id: int):
        if convo_id in self.active_connections:
            if websocket in self.active_connections[convo_id]:
                self.active_connections[convo_id].remove(websocket)
            if not self.active_connections[convo_id]:
                del self.active_connections[convo_id]

    async def broadcast(self, convo_id: int, message: dict):
        if convo_id in self.active_connections:
            for connection in self.active_connections[convo_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

manager = ConnectionManager()

router = APIRouter(prefix="/messages", tags=["Messages"])

@router.get("/inbox")
def get_inbox(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # Find mutual friends
    # follows_me: users who follow current_user (relation followed_id == current_user.id)
    follows_me_ids = db.query(models.Follower.user_id).filter(
        models.Follower.followed_id == current_user.id
    ).all()
    follows_me_ids = [f[0] for f in follows_me_ids]

    # i_follow: users current_user follows (relation user_id == current_user.id)
    i_follow_ids = db.query(models.Follower.followed_id).filter(
        models.Follower.user_id == current_user.id
    ).all()
    i_follow_ids = [f[0] for f in i_follow_ids]

    # Mutual = intersection of both lists
    mutual_ids = set(follows_me_ids).intersection(set(i_follow_ids))
    mutual_users = db.query(models.User).filter(models.User.id.in_(mutual_ids)).all()
    
    # Format mutual friends list
    suggested_friends = []
    for u in mutual_users:
        avatar = u.profile.avatar if u.profile else None
        suggested_friends.append(schemas.UserSimple(id=u.id, username=u.username, avatar=avatar))

    # Fetch user's conversations
    conversations = current_user.conversations
    
    convo_data = []
    for convo in conversations:
        # Determine title and avatar letter
        if convo.is_group:
            title = convo.name if convo.name else "Group Chat"
            avatar_letter = "G"
            participants_list = convo.participants
        else:
            # Get the other participant
            other_participants = [p for p in convo.participants if p.id != current_user.id]
            if other_participants:
                other = other_participants[0]
                title = other.username
                avatar_letter = other.username[0].upper() if other.username else "U"
                participants_list = [other]
            else:
                title = "Unknown User"
                avatar_letter = "U"
                participants_list = []

        # Get last message
        last_msg_obj = db.query(models.Message).filter(
            models.Message.conversation_id == convo.id
        ).order_by(models.Message.created_at.desc()).first()
        last_message = last_msg_obj.text if last_msg_obj else ""

        # Unread count
        unread_count = db.query(models.Message).filter(
            models.Message.conversation_id == convo.id,
            models.Message.sender_id != current_user.id,
            models.Message.is_read == False
        ).count()

        # Format participants list to simple schemas
        simple_participants = []
        for p in participants_list:
            simple_participants.append(schemas.UserSimple(
                id=p.id,
                username=p.username,
                avatar=p.profile.avatar if p.profile else None
            ))

        convo_data.append({
            "id": convo.id,
            "title": title,
            "avatar_letter": avatar_letter,
            "last_message": last_message,
            "is_group": convo.is_group,
            "created_at": convo.created_at,
            "participants": simple_participants,
            "unread_count": unread_count
        })

    # Sort conversations by newest created or last message (if any)
    convo_data.sort(key=lambda x: x["created_at"], reverse=True)

    return {
        "conversations": convo_data,
        "mutual_friends": suggested_friends
    }

@router.post("/start/{username}")
def get_or_create_dm(
    username: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    other_user = db.query(models.User).filter(models.User.username == username).first()
    if not other_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if other_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot DM yourself")

    # Find existing direct conversation between current_user and other_user
    # by checking participant_ids list to prevent duplicates
    convo = None
    all_convos = db.query(models.Conversation).filter(models.Conversation.is_group == False).all()
    for c in all_convos:
        ids = c.participant_ids or []
        if current_user.id in ids and other_user.id in ids:
            convo = c
            break

    if not convo:
        # Create a new conversation
        convo = models.Conversation(is_group=False, creator_id=current_user.id)
        db.add(convo)
        db.commit()
        db.refresh(convo)
        # Add participants
        convo.participants.append(current_user)
        convo.participants.append(other_user)
        db.commit()
        db.refresh(convo)

    return {"convo_id": convo.id}

@router.get("/room/{convo_id}")
def get_dm_room(
    convo_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    convo = db.query(models.Conversation).filter(models.Conversation.id == convo_id).first()
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    # Verify participant
    is_part = db.query(models.Conversation).filter(
        models.Conversation.id == convo_id,
        models.Conversation.participants.any(id=current_user.id)
    ).first()
    
    if not is_part:
        raise HTTPException(status_code=403, detail="Not authorized to access this conversation")

    # Fetch messages
    messages = db.query(models.Message).filter(
        models.Message.conversation_id == convo_id
    ).order_by(models.Message.created_at.asc()).all()

    # Determine other user if not group
    other_user = None
    if not convo.is_group:
        others = [p for p in convo.participants if p.id != current_user.id]
        if others:
            ou = others[0]
            other_user = schemas.UserSimple(
                id=ou.id,
                username=ou.username,
                avatar=ou.profile.avatar if ou.profile else None
            )

    # Format participants
    participants_out = []
    for p in convo.participants:
        participants_out.append(schemas.UserSimple(
            id=p.id,
            username=p.username,
            avatar=p.profile.avatar if p.profile else None
        ))

    # Format messages
    messages_out = []
    for msg in messages:
        messages_out.append(schemas.MessageOut(
            id=msg.id,
            conversation_id=msg.conversation_id,
            sender_id=msg.sender_id,
            text=msg.text,
            is_read=msg.is_read,
            created_at=msg.created_at,
            sender_username=msg.sender.username
        ))

    return {
        "convo": {
            "id": convo.id,
            "name": convo.name,
            "is_group": convo.is_group,
            "created_at": convo.created_at,
        },
        "messages": messages_out,
        "other_user": other_user,
        "participants": participants_out
    }

@router.post("/room/{convo_id}/send", response_model=schemas.MessageOut)
def send_message(
    convo_id: int,
    message_data: schemas.MessageCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    convo = db.query(models.Conversation).filter(models.Conversation.id == convo_id).first()
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Verify participant
    is_part = db.query(models.Conversation).filter(
        models.Conversation.id == convo_id,
        models.Conversation.participants.any(id=current_user.id)
    ).first()
    if not is_part:
        raise HTTPException(status_code=403, detail="Not authorized")

    text = message_data.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Cannot send empty message")

    new_msg = models.Message(
        conversation_id=convo_id,
        sender_id=current_user.id,
        text=text
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)

    # Broadcast to WebSocket clients in the background
    payload = {
        "type": "new_message",
        "message": {
            "id": new_msg.id,
            "conversation_id": new_msg.conversation_id,
            "sender_id": new_msg.sender_id,
            "text": new_msg.text,
            "is_read": new_msg.is_read,
            "created_at": new_msg.created_at.isoformat(),
            "sender_username": current_user.username
        }
    }
    
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.run_coroutine_threadsafe(manager.broadcast(convo_id, payload), loop)
        else:
            asyncio.run(manager.broadcast(convo_id, payload))
    except Exception as e:
        print("WS Broadcast from REST failed:", e)

    return schemas.MessageOut(
        id=new_msg.id,
        conversation_id=new_msg.conversation_id,
        sender_id=new_msg.sender_id,
        text=new_msg.text,
        is_read=new_msg.is_read,
        created_at=new_msg.created_at,
        sender_username=current_user.username
    )

@router.websocket("/ws/{convo_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    convo_id: int,
    token: Optional[str] = None
):
    from ..database import SessionLocal
    db = SessionLocal()
    
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        db.close()
        return

    try:
        user = auth.get_current_user(token, db)
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        db.close()
        return

    # Verify participant of convo_id
    convo = db.query(models.Conversation).filter(models.Conversation.id == convo_id).first()
    if not convo:
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        db.close()
        return

    is_part = db.query(models.Conversation).filter(
        models.Conversation.id == convo_id,
        models.Conversation.participants.any(id=user.id)
    ).first()
    
    if not is_part:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        db.close()
        return

    # Add to manager
    await manager.connect(websocket, convo_id)
    try:
        while True:
            data = await websocket.receive_text()
            import json
            try:
                msg_data = json.loads(data)
                text = msg_data.get("text", "").strip()
                if text:
                    new_msg = models.Message(
                        conversation_id=convo_id,
                        sender_id=user.id,
                        text=text
                    )
                    db.add(new_msg)
                    db.commit()
                    db.refresh(new_msg)
                    
                    # Broadcast
                    payload = {
                        "type": "new_message",
                        "message": {
                            "id": new_msg.id,
                            "conversation_id": new_msg.conversation_id,
                            "sender_id": new_msg.sender_id,
                            "text": new_msg.text,
                            "is_read": new_msg.is_read,
                            "created_at": new_msg.created_at.isoformat(),
                            "sender_username": user.username
                        }
                    }
                    await manager.broadcast(convo_id, payload)
            except Exception as e:
                print("WS Parse Error:", e)
    except WebSocketDisconnect:
        manager.disconnect(websocket, convo_id)
    finally:
        db.close()

@router.post("/room/{convo_id}/read")
def mark_read(
    convo_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    convo = db.query(models.Conversation).filter(models.Conversation.id == convo_id).first()
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Verify participant
    is_part = db.query(models.Conversation).filter(
        models.Conversation.id == convo_id,
        models.Conversation.participants.any(id=current_user.id)
    ).first()
    if not is_part:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Update messages
    db.query(models.Message).filter(
        models.Message.conversation_id == convo_id,
        models.Message.sender_id != current_user.id,
        models.Message.is_read == False
    ).update({"is_read": True}, synchronize_session=False)
    
    db.commit()
    return {"status": "read"}

@router.delete("/room/{convo_id}")
def delete_conversation(
    convo_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    convo = db.query(models.Conversation).filter(models.Conversation.id == convo_id).first()
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Verify participant
    is_part = db.query(models.Conversation).filter(
        models.Conversation.id == convo_id,
        models.Conversation.participants.any(id=current_user.id)
    ).first()
    if not is_part:
        raise HTTPException(status_code=403, detail="Not authorized")

    db.delete(convo)
    db.commit()
    return {"status": "deleted"}

@router.delete("/message/{message_id}")
def delete_message(
    message_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    msg = db.query(models.Message).filter(models.Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
        
    if msg.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this message")

    db.delete(msg)
    db.commit()
    return {"status": "deleted"}

@router.put("/message/{message_id}")
def edit_message(
    message_id: int,
    message_data: schemas.MessageCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    msg = db.query(models.Message).filter(models.Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
        
    if msg.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this message")

    new_text = message_data.text.strip()
    if not new_text:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    msg.text = new_text
    db.commit()
    db.refresh(msg)
    
    return {"status": "updated", "new_text": new_text}

@router.post("/group/create")
def create_group_chat(
    group_data: schemas.GroupCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    name = group_data.name.strip()
    user_ids = group_data.users

    if not name:
        raise HTTPException(status_code=400, detail="Group name is required")
        
    if len(user_ids) < 1:
        raise HTTPException(status_code=400, detail="Must select at least one mutual friend")

    # Verify that selected users are mutual friends
    follows_me_ids = db.query(models.Follower.user_id).filter(
        models.Follower.followed_id == current_user.id
    ).all()
    follows_me_ids = [f[0] for f in follows_me_ids]

    # i_follow
    i_follow_ids = db.query(models.Follower.followed_id).filter(
        models.Follower.user_id == current_user.id
    ).all()
    i_follow_ids = [f[0] for f in i_follow_ids]

    mutual_ids = set(follows_me_ids).intersection(set(i_follow_ids))

    valid_user_ids = [uid for uid in user_ids if uid in mutual_ids]
    if len(valid_user_ids) < 1:
         raise HTTPException(status_code=400, detail="Select mutual friends only")

    # Enforce only one group with a specific name per user creator
    existing_groups = db.query(models.Conversation).filter(
        models.Conversation.is_group == True,
        models.Conversation.creator_id == current_user.id
    ).all()
    for g in existing_groups:
        if g.name and g.name.strip().lower() == name.lower():
            raise HTTPException(
                status_code=400, 
                detail=f"You have already created a group named '{name}'"
            )

    # Create Group Conversation
    convo = models.Conversation(name=name, is_group=True, creator_id=current_user.id)
    db.add(convo)
    db.commit()
    db.refresh(convo)

    # Add participants
    convo.participants.append(current_user)
    for uid in valid_user_ids:
        friend_user = db.query(models.User).filter(models.User.id == uid).first()
        if friend_user:
            convo.participants.append(friend_user)
            
    db.commit()
    return {"group_id": convo.id}
