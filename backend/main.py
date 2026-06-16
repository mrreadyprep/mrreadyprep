from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import os

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

# Vocabulary verisi - JSON dosyasından yükleniyor
VOCAB_FILE = os.path.join(os.path.dirname(__file__), "toefl_vocab_list.json")
with open(VOCAB_FILE, "r", encoding="utf-8") as f:
    vocab_words = json.load(f)

@app.get("/api/dashboard")
def get_dashboard():
    return student_profile

@app.post("/api/profile/update")
def update_profile(data: DashboardData):
    global student_profile
    student_profile["username"] = data.username
    student_profile["target_score"] = data.target_score
    return {"status": "success", "message": "Profile updated successfully"}

@app.get("/api/vocab")
def get_vocab():
    return vocab_words

@app.post("/api/vocab/toggle/{word_id}")
def toggle_vocab(word_id: int):
    for w in vocab_words:
        if w["id"] == word_id:
            w["learned"] = not w["learned"]
            # vocab_level'i öğrenilen kelime sayısına göre güncelle
            learned_count = sum(1 for v in vocab_words if v["learned"])
            student_profile["vocab_level"] = 1 + learned_count // 5
            return {"status": "success", "learned": w["learned"]}
    return {"status": "error", "message": "Word not found"}
# Complete the Words verisi
import pathlib
CTW_FILE = pathlib.Path(__file__).parent / "complete_the_words_1.json"
with open(CTW_FILE, "r", encoding="utf-8") as f:
    ctw_exercises = json.load(f)

@app.get("/api/reading/complete-the-words")
def get_ctw_exercises():
    return ctw_exercises