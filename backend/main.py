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

# Vocabulary verisi (geçici - bellekte tutuluyor)
vocab_words = [
    {"id": 1, "word": "Proponent", "type": "NOUN", "meaning": "A person who advocates a theory, proposal, or project.", "learned": False},
    {"id": 2, "word": "Substantiate", "type": "VERB", "meaning": "Provide evidence to support or prove the truth of.", "learned": False},
    {"id": 3, "word": "Ambiguous", "type": "ADJECTIVE", "meaning": "Open to more than one interpretation.", "learned": False},
    {"id": 4, "word": "Prohibit", "type": "VERB", "meaning": "Formally forbid something by law or rule.", "learned": False},
    {"id": 5, "word": "Enhance", "type": "VERB", "meaning": "To intensify, increase, or further improve the quality, value, or extent of something.", "learned": False},
    {"id": 6, "word": "Inevitable", "type": "ADJECTIVE", "meaning": "Certain to happen; unable to be avoided or prevented.", "learned": False},
    {"id": 7, "word": "Hypothesis", "type": "NOUN", "meaning": "A proposed explanation made on the basis of limited evidence as a starting point for investigation.", "learned": False},
    {"id": 8, "word": "Derive", "type": "VERB", "meaning": "To obtain something from a specified source.", "learned": False},
    {"id": 9, "word": "Coherent", "type": "ADJECTIVE", "meaning": "Logical and consistent, forming a unified whole.", "learned": False},
    {"id": 10, "word": "Mitigate", "type": "VERB", "meaning": "To make less severe, serious, or painful.", "learned": False},
]

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