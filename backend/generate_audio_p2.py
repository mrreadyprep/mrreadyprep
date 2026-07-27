import asyncio, json, os, subprocess, tempfile
import edge_tts
import imageio_ffmpeg

# Listen to a Conversation: each item has multiple turns (male/female alternating).
# We synthesize each turn separately with the matching gendered voice, then splice
# them together (with a short silent pause between turns) into one conversation mp3.
#
# NOTE: this intentionally avoids pydub — pydub depends on the stdlib "audioop"
# module, which was removed in Python 3.13+, so it crashes on newer Python.
# Instead we call ffmpeg directly (via imageio-ffmpeg's bundled binary) to
# generate the pause and concatenate everything.

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

VOICES = {
    "female": "en-US-JennyNeural",
    "male": "en-US-GuyNeural",
}

PAUSE_SEC = 0.45  # short natural gap between speaker turns

with open('listening_part2.json', 'r', encoding='utf-8') as f:
    conversations = json.load(f)

os.makedirs('audio/listening_p2', exist_ok=True)


async def synth_turn(text, voice, out_path):
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(out_path)


def make_silence(path, duration):
    subprocess.run(
        [FFMPEG, '-y', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono',
         '-t', str(duration), '-q:a', '9', path],
        check=True, capture_output=True,
    )


def concat_mp3(parts, out_path):
    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as listfile:
        for p in parts:
            listfile.write(f"file '{os.path.abspath(p)}'\n")
        listpath = listfile.name
    try:
        subprocess.run(
            [FFMPEG, '-y', '-f', 'concat', '-safe', '0', '-i', listpath,
             '-c:a', 'libmp3lame', '-ar', '24000', '-ac', '1', '-q:a', '4', out_path],
            check=True, capture_output=True,
        )
    finally:
        os.remove(listpath)


async def generate_all():
    with tempfile.TemporaryDirectory() as tmp:
        silence_path = os.path.join(tmp, 'silence.mp3')
        make_silence(silence_path, PAUSE_SEC)

        for convo in conversations:
            out_path = f"audio/listening_p2/{convo['id']}.mp3"
            if os.path.exists(out_path):
                continue
            parts = []
            for i, turn in enumerate(convo['turns']):
                voice = VOICES.get(turn.get('speaker'), VOICES['female'])
                turn_path = os.path.join(tmp, f"{convo['id']}_{i}.mp3")
                await synth_turn(turn['text'], voice, turn_path)
                parts.append(turn_path)
                if i < len(convo['turns']) - 1:
                    parts.append(silence_path)
            concat_mp3(parts, out_path)
            print(f"✓ Conversation {convo['id']} done ({len(convo['turns'])} turns)")


try:
    asyncio.run(generate_all())
    print("All done!")
except subprocess.CalledProcessError as e:
    print("ffmpeg failed:")
    print(e.stderr.decode(errors='ignore') if e.stderr else e)
