import asyncio, json, os
import edge_tts

# Listen to an Academic Talk: one lecturer per talk, gender-matched voice.
# Talks are longer (~90 seconds of speech) than the other listening parts.

VOICES = {
    "female": "en-US-JennyNeural",
    "male": "en-US-GuyNeural",
}

with open('listening_part4.json', 'r', encoding='utf-8') as f:
    talks = json.load(f)

os.makedirs('audio/listening_p4', exist_ok=True)


async def generate_all():
    for t in talks:
        path = f"audio/listening_p4/{t['id']}.mp3"
        if os.path.exists(path):
            continue
        voice = VOICES.get(t.get('speaker'), VOICES['female'])
        communicate = edge_tts.Communicate(t['transcript'], voice)
        await communicate.save(path)
        print(f"✓ Talk {t['id']} ({t.get('speaker', 'female')} -> {voice}) done")

asyncio.run(generate_all())
print("All done!")
