import asyncio, json, os
import edge_tts

# Speaking Part 1: Listen and Repeat — one speaker per location set, gender-matched voice.

VOICES = {
    "female": "en-US-JennyNeural",
    "male": "en-US-GuyNeural",
}

with open('speaking_listen_repeat_1.json', 'r', encoding='utf-8') as f:
    sets = json.load(f)


async def generate_all():
    for s in sets:
        voice = VOICES.get(s.get('speaker'), VOICES['female'])
        out_dir = f"audio/speaking_lr/{s['id']}"
        os.makedirs(out_dir, exist_ok=True)

        intro_path = f"{out_dir}/intro.mp3"
        if not os.path.exists(intro_path):
            await edge_tts.Communicate(s['introText'], voice).save(intro_path)
            print(f"✓ Set {s['id']} ({s['location']}) intro done")

        for sent in s['sentences']:
            path = f"{out_dir}/{sent['id']}.mp3"
            if os.path.exists(path):
                continue
            await edge_tts.Communicate(sent['text'], voice).save(path)
            print(f"  ✓ Set {s['id']} sentence {sent['id']} done")

asyncio.run(generate_all())
print("All done!")
