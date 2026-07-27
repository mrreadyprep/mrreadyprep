import asyncio, json, os
import edge_tts

# Mock Test - Choose a Response. Same voice mapping as generate_audio.py,
# but reads from the mock-only JSON and writes to a separate audio folder
# so it never overlaps with the practice audio files.
VOICES = {
    "female": "en-US-JennyNeural",
    "male": "en-US-GuyNeural",
}

with open('mock_listening_choose_response.json', 'r', encoding='utf-8') as f:
    exercises = json.load(f)

os.makedirs('audio/mock_listening_p1', exist_ok=True)


async def generate_all():
    for ex in exercises:
        for q in ex['questions']:
            path = f"audio/mock_listening_p1/{q['id']}.mp3"
            if os.path.exists(path):
                continue
            voice = VOICES.get(q.get('speaker'), VOICES['female'])
            communicate = edge_tts.Communicate(q['transcript'], voice)
            await communicate.save(path)
            print(f"✓ Question {q['id']} ({q.get('speaker', 'female')} -> {voice}) done")

asyncio.run(generate_all())
print("All done!")
