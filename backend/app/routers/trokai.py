import os
import json
import urllib.request
import urllib.error
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(prefix="/trokai", tags=["Trok AI"])

@router.post("/chat", response_model=schemas.TrokChatResponse)
def chat_with_trok(
    chat_data: schemas.TrokChatRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch recent campus posts (tweets) to supply as context (RAG)
    try:
        recent_tweets = db.query(models.Tweet).order_by(models.Tweet.created_at.desc()).limit(15).all()
        posts_context = "Here are the most recent posts from the CollegeConnectX campus feed:\n"
        if recent_tweets:
            for t in recent_tweets:
                username = t.user.username if t.user else "Anonymous"
                posts_context += f"- Post by @{username} (ID: {t.id}): \"{t.text}\"\n"
        else:
            posts_context += "- No posts are currently on the feed.\n"
    except Exception as e:
        print("Error fetching post context for AI:", e)
        posts_context = "No campus posts context could be fetched at this time."

    SYSTEM_INSTRUCTION = (
        "You are Trok, the friendly, interactive and knowledgeable campus AI assistant for CollegeConnectX.\n\n"
        "You have direct real-time access to the database of campus feed posts. You can answer questions "
        "about what students are posting, campus discussions, classes, events, and other college activities.\n\n"
        f"{posts_context}\n"
        "Instructions:\n"
        "1. Answer user queries based on the posts context above if they ask about campus discussions or feed updates.\n"
        "2. Keep your replies concise, friendly, helpful, and natural. Do not mention technical JSON or internal fields.\n"
        "3. Encourage collaboration and campus life."
    )

    groq_key = os.getenv("GROQ_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY")

    # --- Choice 1: Groq API Integration ---
    if groq_key:
        messages = [
            {"role": "system", "content": SYSTEM_INSTRUCTION}
        ]
        
        # Format history for OpenAI compatible API (Groq)
        for msg in chat_data.history:
            if "your campus AI assistant" in msg.text:
                continue
            role = "assistant" if msg.role == "assistant" else "user"
            messages.append({"role": role, "content": msg.text})
            
        messages.append({"role": "user", "content": chat_data.message})
        
        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": messages,
            "temperature": 0.7
        }
        
        url = "https://api.groq.com/openai/v1/chat/completions"
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {groq_key}",
                    "Content-Type": "application/json"
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=15) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                reply_text = res_data["choices"][0]["message"]["content"]
                return schemas.TrokChatResponse(reply=reply_text)
        except urllib.error.HTTPError as e:
            error_detail = e.read().decode("utf-8")
            print(f"Groq API HTTP Error: {e.code} - {error_detail}")
        except Exception as e:
            print(f"Error contacting Groq API: {e}")

    # --- Choice 2: Gemini API Fallback ---
    if gemini_key:
        contents = [
            {
                "role": "user",
                "parts": [{"text": f"[System Instruction]\n{SYSTEM_INSTRUCTION}"}]
            },
            {
                "role": "model",
                "parts": [{"text": "Understood. I am Trok, your campus AI assistant. I have access to the campus feed context. How can I help you today?"}]
            }
        ]
        
        for msg in chat_data.history:
            if "your campus AI assistant" in msg.text:
                continue
            role = "model" if msg.role == "assistant" else "user"
            contents.append({
                "role": role,
                "parts": [{"text": msg.text}]
            })
            
        contents.append({
            "role": "user",
            "parts": [{"text": chat_data.message}]
        })

        payload = {"contents": contents}
        url = f"https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key={gemini_key}"
        
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=15) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                candidates = res_data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        reply_text = parts[0].get("text", "")
                        return schemas.TrokChatResponse(reply=reply_text)
        except urllib.error.HTTPError as e:
            error_detail = e.read().decode("utf-8")
            print(f"Gemini API HTTP Error: {e.code} - {error_detail}")
        except Exception as e:
            print(f"Error contacting Gemini API: {e}")

    # --- Error Fallback message if neither keys are configured ---
    return schemas.TrokChatResponse(
        reply="I am having trouble connecting to my brain right now. Please verify that GROQ_API_KEY or GEMINI_API_KEY is configured in the backend environment variables."
    )
