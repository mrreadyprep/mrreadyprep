import asyncio, json, os
import edge_tts

# gTTS only ever produces one (female-sounding) voice, so every question sounded
# like the same woman regardless of the "speaker" field. edge-tts (free, uses
# Microsoft's neural voices) gives us a real male voice and a real female voice,
# so audio now matches the speaker/photo gender per question.
VOICES = {
    "female": "en-US-JennyNeural",
    "male": "en-US-GuyNeural",
}

with open('listening_part1.json', 'r', encoding='utf-8') as f:
    exercises = json.load(f)

os.makedirs('audio/listening_p1', exist_ok=True)


async def generate_all():
    # exercises = [ {id, questions: [ {id, transcript, speaker, ...}, ... ] }, ... ]
    for ex in exercises:
        for q in ex['questions']:
            path = f"audio/listening_p1/{q['id']}.mp3"
            if os.path.exists(path):
                continue
            voice = VOICES.get(q.get('speaker'), VOICES['female'])
            communicate = edge_tts.Communicate(q['transcript'], voice)
            await communicate.save(path)
            print(f"✓ Question {q['id']} ({q.get('speaker', 'female')} -> {voice}) done")

asyncio.run(generate_all())
print("All done!")