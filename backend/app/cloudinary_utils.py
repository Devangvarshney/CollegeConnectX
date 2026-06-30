import os
import uuid
import cloudinary
import cloudinary.uploader
from fastapi import UploadFile

# Configure Cloudinary using credentials from environment
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

def upload_to_cloudinary(file: UploadFile) -> str:
    """
    Uploads a FastAPI UploadFile to Cloudinary and returns the secure URL.
    """
    if not file:
        return None
        
    try:
        # Read the file bytes
        file_bytes = file.file.read()
        # Reset the cursor of the file
        file.file.seek(0)
        
        # Upload using the Cloudinary SDK (resource_type="auto" automatically handles images & videos)
        upload_result = cloudinary.uploader.upload(
            file_bytes,
            resource_type="auto"
        )
        return upload_result.get("secure_url")
    except Exception as e:
        print(f"Cloudinary upload error: {e}")
        # Return fallback/None or re-raise
        raise e
