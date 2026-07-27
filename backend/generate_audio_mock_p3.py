import asyncio, json, os
import edge_tts

# Mock Test - Listen to an Announcement.

VOICES = {
    "female": "en-US-JennyNeural",
    "male": "en-US-GuyNeural",
}

with open('mock_listening_announcement.json', 'r', encoding='utf-8') as f:
    announcements = json.load(f)

os.makedirs('audio/mock_listening_p3', exist_ok=True)


async def generate_all():
    for a in announcements:
        path = f"audio/mock_listening_p3/{a['id']}.mp3"
        if os.path.exists(path):
            continue
        voice = VOICES.get(a.get('speaker'), VOICES['female'])
        communicate = edge_tts.Communicate(a['transcript'], voice)
        await communicate.save(path)
        print(f"✓ Announcement {a['id']} ({a.get('speaker', 'female')} -> {voice}) done")

asyncio.run(generate_all())
print("All done!")
