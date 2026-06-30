import os
from dotenv import load_dotenv

# Load .env file relative to the app/ directory
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
dotenv_path = os.path.join(backend_dir, ".env")
load_dotenv(dotenv_path)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import init_db
from .routers import auth, users, posts, messages, elections, trokai

# Initialize MongoDB indexes and collections
init_db()

app = FastAPI(title="CollegeConnectX API", version="1.0.0")

# Setup CORS to allow React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, specify frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure media folder exists and serve statically
os.makedirs("media", exist_ok=True)
os.makedirs("media/candidates", exist_ok=True)
app.mount("/media", StaticFiles(directory="media"), name="media")

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(posts.router, prefix="/api")
app.include_router(messages.router, prefix="/api")
app.include_router(elections.router, prefix="/api")
app.include_router(trokai.router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "Welcome to CollegeConnectX API. Access docs at /docs"}
