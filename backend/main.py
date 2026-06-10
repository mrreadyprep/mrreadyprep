from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="mrreadyprep API", version="2026")

# Frontend (localhost:5173) ile pürüzsüz veri akışı için CORS ayarları
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Öğrenci Veri Modeli (6.0 ölçeğine göre kalibre edildi)
class DashboardData(BaseModel):
    username: str
    target_score: float

# Geçici veri tabanı simülasyonu
student_profile = {
    "username": "mehmetdisbudak",
    "target_score": 5.5,
    "current_streak": 5,
    "vocab_level": 3,
    "reading_score": 5.0,
    "listening_score": 4.5,
    "writing_score": 4.5,
    "speaking_score": 4.0
}

@app.get("/api/dashboard")
def get_dashboard():
    return student_profile

@app.post("/api/profile/update")
def update_profile(data: DashboardData):
    global student_profile
    student_profile["username"] = data.username
    student_profile["target_score"] = data.target_score
    return {"status": "success", "message": "Profile updated successfully"}