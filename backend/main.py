import sys
import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Add backend directory to sys.path so imports work cleanly
backend_dir = str(Path(__file__).resolve().parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from database import init_db
from routes.auth_routes import router as auth_router
from routes.patient_routes import router as patient_router
from routes.assessment_routes import router as assessment_router
from routes.ai_routes import router as ai_router
from routes.doctor_routes import router as doctor_router
from routes.admin_routes import router as admin_router
from routes.notification_routes import router as notification_router

# Initialize database schema and initial seed records
init_db()

app = FastAPI(
    title="AI Early-Risk Detection & Patient Triage System",
    description="Explainable, safety-first clinical decision support API conforming to PRD v1.0 specifications.",
    version="1.0.0"
)

# Enable CORS for local Vite dev server and external clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all API route groups
app.include_router(auth_router)
app.include_router(patient_router)
app.include_router(assessment_router)
app.include_router(ai_router)
app.include_router(doctor_router)
app.include_router(admin_router)
app.include_router(notification_router)

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "AI Early-Risk Detection & Triage System",
        "version": "1.0.0",
        "ai_model": "rf-0.1.0",
        "safety_engine": "v1.2-cardiac-neuro"
    }

# Mount Frontend static build
dist_dir = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if dist_dir.exists():
    assets_dir = dist_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Don't intercept API routes or documentation
        if full_path.startswith("api") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            return None
        file_path = dist_dir / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        # index.html must not be cached, or browsers keep loading an old build
        return FileResponse(dist_dir / "index.html", headers={"Cache-Control": "no-cache"})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
