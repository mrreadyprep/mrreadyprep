import asyncio, os
import edge_tts

# Same neutral narrator voice used for the Listening intro lines ("Listen to a conversation.",
# etc. in generate_audio_intro.py) so the hardware-check screens sound consistent with the rest
# of the mock test's TOEFL-style narration instead of the browser's built-in (low quality) TTS.
NARRATOR_VOICE = "en-US-GuyNeural"

os.makedirs("audio/hwcheck", exist_ok=True)

TEXTS = {
    "adjusting_volume.mp3": "You can adjust your device's system volume at any time during the test using your computer's own volume controls.",
    "adjusting_microphone.mp3": "When you record your Speaking answers, speak at your normal volume and keep a steady distance from the microphone.",
}


async def generate_all():
    for fname, text in TEXTS.items():
        path = f"audio/hwcheck/{fname}"
        communicate = edge_tts.Communicate(text, NARRATOR_VOICE)
        await communicate.save(path)
        print(f"✓ {path} done")

asyncio.run(generate_all())
print("All done!")
