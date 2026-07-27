import asyncio, json, os
import edge_tts

# Listen to an Announcement: one speaker per announcement, gender-matched voice.

VOICES = {
    "female": "en-US-JennyNeural",
    "male": "en-US-GuyNeural",
}

with open('listening_part3.json', 'r', encoding='utf-8') as f:
    announcements = json.load(f)

os.makedirs('audio/listening_p3', exist_ok=True)


async def generate_all():
    for a in announcements:
        path = f"audio/listening_p3/{a['id']}.mp3"
        if os.path.exists(path):
            continue
        voice = VOICES.get(a.get('speaker'), VOICES['female'])
        communicate = edge_tts.Communicate(a['transcript'], voice)
        await communicate.save(path)
        print(f"✓ Announcement {a['id']} ({a.get('speaker', 'female')} -> {voice}) done")

asyncio.run(generate_all())
print("All done!")
