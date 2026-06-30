import os
import json
import urllib.request
import urllib.error
from fastapi import APIRouter, Depends, HTTPException, status
from .. import models, schemas, auth

router = APIRouter(prefix="/trokai", tags=["Trok AI"])

SYSTEM_INSTRUCTION = (
    "You are Trok, a helpful, friendly, and knowledgeable campus AI assistant for "
    "CollegeConnectX. Keep your answers clear, concise, and specific to university life, "
    "classes, sports, group projects, templates, and scheduling. Be polite and encouraging."
)

@router.post("/chat", response_model=schemas.TrokChatResponse)
def chat_with_trok(
    chat_data: schemas.TrokChatRequest,
    current_user: models.User = Depends(auth.get_current_user)
):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return schemas.TrokChatResponse(
            reply="Gemini API Key is not configured. Please add GEMINI_API_KEY to your backend .env file to enable live AI responses."
        )

    # Prepend the system instructions as the initial conversational context
    # to guarantee compatibility on the stable v1 endpoint.
    contents = [
        {
            "role": "user",
            "parts": [{"text": f"[System Instruction]\n{SYSTEM_INSTRUCTION}"}]
        },
        {
            "role": "model",
            "parts": [{"text": "Understood. I am Trok, your campus AI assistant. I will keep my answers clear, concise, and focused on college/campus life. How can I help you today?"}]
        }
    ]
    
    # Process history (skipping any default system greetings from client-side if they match)
    for msg in chat_data.history:
        # Avoid duplicating the initial greeting
        if "your campus AI assistant" in msg.text:
            continue
        role = "model" if msg.role == "assistant" else "user"
        contents.append({
            "role": role,
            "parts": [{"text": msg.text}]
        })
        
    # Append current message
    contents.append({
        "role": "user",
        "parts": [{"text": chat_data.message}]
    })

    payload = {
        "contents": contents
    }

    url = f"https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key={api_key}"
    
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
            
            return schemas.TrokChatResponse(reply="Sorry, I couldn't generate a response. Please try again.")

    except urllib.error.HTTPError as e:
        error_detail = e.read().decode("utf-8")
        print(f"Gemini API HTTP Error: {e.code} - {error_detail}")
        try:
            err_json = json.loads(error_detail)
            msg = err_json.get("error", {}).get("message", "API Error")
            return schemas.TrokChatResponse(reply=f"Gemini API Error: {msg}")
        except Exception:
            return schemas.TrokChatResponse(reply=f"Gemini API returned HTTP status {e.code}.")
    except Exception as e:
        print(f"Error contacting Gemini API: {e}")
        return schemas.TrokChatResponse(reply="I am having trouble connecting to my brain right now. Please try again later.")
