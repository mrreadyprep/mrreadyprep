import asyncio, json, os
import edge_tts

# Mock Test - Speaking Part 2: Take an Interview.

VOICES = {
    "female": "en-US-JennyNeural",
    "male": "en-US-GuyNeural",
}

with open('mock_speaking_interview.json', 'r', encoding='utf-8') as f:
    sets = json.load(f)


async def generate_all():
    for s in sets:
        voice = VOICES.get(s.get('speaker'), VOICES['female'])
        out_dir = f"audio/mock_speaking_interview/{s['id']}"
        os.makedirs(out_dir, exist_ok=True)

        intro_path = f"{out_dir}/intro.mp3"
        if not os.path.exists(intro_path):
            await edge_tts.Communicate(s['introText'], voice).save(intro_path)
            print(f"✓ Set {s['id']} ({s['topic']}) intro done")

        for q in s['questions']:
            path = f"{out_dir}/{q['id']}.mp3"
            if os.path.exists(path):
                continue
            await edge_tts.Communicate(q['text'], voice).save(path)
            print(f"  ✓ Question {q['id']} done")

asyncio.run(generate_all())
print("All done!")
