from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.ext.declarative import declarative_base
import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    
    # Oyunlaştırma (Gamification) Verileri
    vocab_level = Column(Integer, default=1)           # Sağ üstteki Vocab: Lvl 3 alanı için
    current_streak = Column(Integer, default=0)         # Sağ üstteki 5 Days Streak alevi için
    last_active_date = Column(DateTime, default=datetime.datetime.utcnow)

    # Hedef ve Puan Tahmin Verileri (1.0 - 6.0 Band Skalası)
    target_score = Column(Float, default=5.0)           # Ortadaki "Target Score: 5.5" alanı için
    
    # 4 Temel Bölümün Mevcut Tahmini Skorları
    reading_score = Column(Float, default=1.0)          # Reading barını besleyecek veri
    listening_score = Column(Float, default=1.0)         # Listening barını besleyecek veri
    speaking_score = Column(Float, default=1.0)          # Speaking barını besleyecek veri
    writing_score = Column(Float, default=1.0)           # Writing barını besleyecek veri

    @property
    def overall_score(self):
        # 4 bölümün ortalamasını alıp ortadaki büyük mor halkaya (4.5 / 6.0) göndereceğimiz matematiksel hesaplama
        return round((self.reading_score + self.listening_score + self.speaking_score + self.writing_score) / 4, 1)