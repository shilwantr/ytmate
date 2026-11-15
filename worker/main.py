import hmac
import os
import re
import secrets
import shutil
import subprocess
import tempfile
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import yt_dlp
from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, HttpUrl

app = FastAPI(title="Downly Media Worker", version="1.0.0")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
    "www.youtube-nocookie.com",
}

WORKER_SECRET = os.environ.get("WORKER_SECRET", "")
MAX_VIDEO_DURATION = int(os.environ.get("MAX_VIDEO_DURATION_SECONDS", 7200)) # 2 hours
MAX_FILE_SIZE_MB = int(os.environ.get("MAX_FILE_SIZE_MB", 1000)) # 1GB
JOB_TTL_MINUTES = int(os.environ.get("JOB_TTL_MINUTES", 30))
TEMP_DIR = Path(os.environ.get("TEMP_DIR", os.path.join(tempfile.gettempdir(), "downly")))
TEMP_DIR.mkdir(parents=True, exist_ok=True)

def get_ffmpeg_path() -> Optional[str]:
    system_ffmpeg = shutil.which("ffmpeg")
    if system_ffmpeg:
        return system_ffmpeg
    local_ffmpeg = Path(__file__).resolve().parent.parent / "node_modules" / "ffmpeg-static" / ("ffmpeg.exe" if os.name == "nt" else "ffmpeg")
    if local_ffmpeg.exists():
        return str(local_ffmpeg)
    return None

# In-memory thread-safe job store
jobs_lock = threading.Lock()
jobs: Dict[str, Dict[str, Any]] = {}

class AnalyzeRequest(BaseModel):
    url: str

class DownloadRequest(BaseModel):
    jobId: str
    type: str # "video" or "audio"
    formatId: Optional[str] = None
    audioBitrate: Optional[int] = 192 # 128, 192, 256, 320


def require_worker_auth(provided: Optional[str]) -> None:
    # If WORKER_SECRET is configured, strictly enforce authentication
    if WORKER_SECRET:
        if not provided or not hmac.compare_digest(provided, WORKER_SECRET):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized: invalid or missing worker secret")


def validate_youtube_url(url: str) -> None:
    if not url or not isinstance(url, str):
        raise HTTPException(status_code=400, detail="Invalid URL")
    
    parsed = urlparse(url.strip())
    hostname = (parsed.hostname or "").lower()

    if parsed.scheme != "https":
        raise HTTPException(status_code=400, detail="Only HTTPS URLs are supported")
    if hostname not in ALLOWED_HOSTS:
        raise HTTPException(status_code=400, detail=f"Unsupported host '{hostname}'. Only YouTube URLs are allowed.")
    if parsed.username or parsed.password or parsed.port:
        raise HTTPException(status_code=400, detail="Credentials and custom ports are not allowed")


def sanitize_filename(title: str, ext: str) -> str:
    clean = re.sub(r'[^\w\s\-]', '', title or "media").strip()
    clean = re.sub(r'\s+', '_', clean)[:60]
    return f"{clean or 'download'}.{ext}"


def cleanup_expired_jobs():
    """Periodic cleanup of expired jobs and temporary files."""
    now = datetime.now(timezone.utc)
    expired_ids = []

    with jobs_lock:
        for job_id, job in list(jobs.items()):
            expires_at = job.get("expiresAt")
            if expires_at and now > expires_at:
                expired_ids.append(job_id)

    for job_id in expired_ids:
        job_dir = TEMP_DIR / job_id
        if job_dir.exists():
            shutil.rmtree(job_dir, ignore_errors=True)
        with jobs_lock:
            jobs.pop(job_id, None)


# Start background cleanup thread
def background_cleanup_loop():
    while True:
        try:
            cleanup_expired_jobs()
        except Exception as e:
            print(f"[Cleanup Error] {e}")
        time.sleep(120)

cleanup_thread = threading.Thread(target=background_cleanup_loop, daemon=True)
cleanup_thread.start()


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "downly-worker",
        "active_jobs": len(jobs),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.post("/api/analyze")
def analyze(
    request: AnalyzeRequest,
    x_worker_secret: Optional[str] = Header(default=None),
):
    require_worker_auth(x_worker_secret)
    url = request.url.strip()
    validate_youtube_url(url)

    options = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
        "socket_timeout": 20,
    }

    try:
        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(url, download=False)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"This video could not be analyzed: {str(e)}")

    duration = info.get("duration") or 0
    if duration > MAX_VIDEO_DURATION:
        raise HTTPException(
            status_code=400,
            detail=f"Video duration ({duration}s) exceeds maximum allowed limit of {MAX_VIDEO_DURATION}s"
        )

    formats = []
    seen_resolutions = set()

    for item in info.get("formats", []):
        vcodec = item.get("vcodec")
        if vcodec in (None, "none"):
            continue

        height = item.get("height")
        res_label = f"{height}p" if height else item.get("format_note") or "Unknown"
        key = (res_label, item.get("ext"))

        if key not in seen_resolutions and height:
            seen_resolutions.add(key)
            formats.append({
                "formatId": str(item.get("format_id", "")),
                "resolution": res_label,
                "width": item.get("width"),
                "height": height,
                "ext": item.get("ext", "mp4"),
                "filesize": item.get("filesize") or item.get("filesize_approx"),
                "hasAudio": item.get("acodec") not in (None, "none"),
                "fps": item.get("fps")
            })

    # Sort formats from highest to lowest resolution
    formats.sort(key=lambda x: x.get("height") or 0, reverse=True)

    job_id = secrets.token_urlsafe(16)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=JOB_TTL_MINUTES)

    job_data = {
        "jobId": job_id,
        "url": url,
        "title": info.get("title", "YouTube Video"),
        "thumbnail": info.get("thumbnail"),
        "duration": duration,
        "uploader": info.get("uploader"),
        "formats": formats,
        "status": "analyzed",
        "createdAt": datetime.now(timezone.utc),
        "expiresAt": expires_at,
        "outputFile": None,
        "stage": "Ready for download",
        "error": None
    }

    with jobs_lock:
        jobs[job_id] = job_data

    return {
        "jobId": job_id,
        "title": job_data["title"],
        "thumbnail": job_data["thumbnail"],
        "duration": duration,
        "uploader": job_data["uploader"],
        "formats": formats,
        "expiresAt": expires_at.isoformat()
    }


def process_download_job(job_id: str, req_type: str, format_id: Optional[str], bitrate: Optional[int]):
    """Background execution of media download and FFmpeg conversion."""
    with jobs_lock:
        job = jobs.get(job_id)
        if not job:
            return
        job["status"] = "processing"
        job["stage"] = "Allocating processing buffer"

    job_dir = TEMP_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    title = job.get("title", f"video_{job_id}")
    url = job["url"]

    try:
        if req_type == "audio":
            with jobs_lock:
                job["stage"] = f"Extracting {bitrate or 192}kbps MP3 audio with FFmpeg"

            filename = sanitize_filename(title, "mp3")
            out_template = str(job_dir / "%(title)s.%(ext)s")

            ffmpeg_loc = get_ffmpeg_path()
            ydl_opts = {
                "format": "ba[ext=m4a]/ba/best",
                "outtmpl": out_template,
                "quiet": True,
                "no_warnings": True,
                "remote_components": ["ejs:github"],
                "js_runtimes": {"node": {}},
                "postprocessors": [{
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": str(bitrate or 192),
                }],
            }
            if ffmpeg_loc:
                ydl_opts["ffmpeg_location"] = ffmpeg_loc

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])

            # Locate created mp3 file
            files = list(job_dir.glob("*.mp3"))
            if not files:
                raise RuntimeError("Audio post-processing failed to produce an MP3 file")

            output_file = files[0]
            final_file = job_dir / filename
            if output_file != final_file:
                shutil.move(output_file, final_file)

        else: # video
            with jobs_lock:
                job["stage"] = "Merging video & high-bitrate audio stream"

            filename = sanitize_filename(title, "mp4")
            out_template = str(job_dir / "%(title)s.%(ext)s")

            # Format selector: if format_id provided, merge with best audio
            format_spec = f"{format_id}+bestaudio/best" if format_id else "bestvideo+bestaudio/best"

            ffmpeg_loc = get_ffmpeg_path()
            ydl_opts = {
                "format": format_spec,
                "outtmpl": out_template,
                "quiet": True,
                "no_warnings": True,
                "remote_components": ["ejs:github"],
                "js_runtimes": {"node": {}},
                "merge_output_format": "mp4",
            }
            if ffmpeg_loc:
                ydl_opts["ffmpeg_location"] = ffmpeg_loc

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])

            files = list(job_dir.glob("*.mp4")) or list(job_dir.glob("*.*"))
            if not files:
                raise RuntimeError("Video processing failed to produce output file")

            output_file = files[0]
            final_file = job_dir / filename
            if output_file != final_file:
                shutil.move(output_file, final_file)

        with jobs_lock:
            job["status"] = "ready"
            job["stage"] = "Completed"
            job["outputFile"] = str(final_file)
            job["filename"] = filename
            job["fileSize"] = final_file.stat().st_size
            job["downloadUrl"] = f"/api/jobs/{job_id}/download"

    except Exception as e:
        print(f"[Worker Error] Job {job_id} failed: {e}")
        with jobs_lock:
            job["status"] = "failed"
            job["stage"] = "Processing failed"
            job["error"] = str(e)


@app.post("/api/download")
def create_download_job(
    request: DownloadRequest,
    background_tasks: BackgroundTasks,
    x_worker_secret: Optional[str] = Header(default=None),
):
    require_worker_auth(x_worker_secret)
    job_id = request.jobId

    with jobs_lock:
        job = jobs.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found or expired. Please analyze again.")

    # Validate audio bitrate
    if request.type == "audio":
        if request.audioBitrate not in (128, 192, 256, 320):
            raise HTTPException(status_code=400, detail="Allowed audio bitrates are 128, 192, 256, or 320 kbps")
    elif request.type == "video":
        # Validate formatId belongs to analyzed formats
        valid_format_ids = [f["formatId"] for f in job.get("formats", [])]
        if request.formatId and request.formatId not in valid_format_ids:
            # If not exact formatId, permit fallback to best
            request.formatId = None

    with jobs_lock:
        job["status"] = "queued"
        job["stage"] = "Queued in worker"

    background_tasks.add_task(
        process_download_job,
        job_id,
        request.type,
        request.formatId,
        request.audioBitrate
    )

    return {
        "jobId": job_id,
        "status": "queued",
        "stage": "Queued in worker"
    }


@app.get("/api/jobs/{job_id}")
def get_job_status(job_id: str):
    with jobs_lock:
        job = jobs.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found or expired")

        return {
            "jobId": job_id,
            "status": job["status"],
            "stage": job.get("stage", "Unknown"),
            "progressPercent": None, # Do not fabricate percentage
            "filename": job.get("filename"),
            "fileSize": job.get("fileSize"),
            "downloadUrl": job.get("downloadUrl"),
            "expiresAt": job["expiresAt"].isoformat(),
            "error": job.get("error")
        }


@app.get("/api/jobs/{job_id}/download")
def download_completed_file(job_id: str):
    with jobs_lock:
        job = jobs.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Download expired or not found")

        if job["status"] != "ready" or not job.get("outputFile"):
            raise HTTPException(status_code=400, detail=f"Job is not ready (status: {job['status']})")

        file_path = Path(job["outputFile"])
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Target media file was removed or expired")

        filename = job.get("filename", file_path.name)
        is_audio = filename.endswith(".mp3") or filename.endswith(".m4a")
        media_type = "audio/mpeg" if is_audio else "video/mp4"

        return FileResponse(
            path=str(file_path),
            filename=filename,
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Cache-Control": "no-cache",
            }
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
