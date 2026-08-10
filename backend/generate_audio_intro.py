import asyncio, json, os, re
import edge_tts

# Intro narration lines played before each Listening exercise starts (Conversation /
# Announcement / Academic Talk), read by the same neutral narrator voice used for the
# real TOEFL-style instructions instead of relying on each browser's own (inconsistent,
# non-TOEFL-sounding) built-in text-to-speech voice.
NARRATOR_VOICE = "en-US-GuyNeural"

os.makedirs('audio/intro', exist_ok=True)


def talk_intro_text(subject):
    if not subject:
        return "Listen to a talk in an academic class."
    article = "an" if re.match(r"^[aeiou]", subject, re.IGNORECASE) else "a"
    return f"Listen to a talk in {article} {subject.lower()} class."


async def generate_all():
    # Skip files that already exist -- this script gets re-run every time the Academic Talk
    # pools grow (the intro line text is deterministic per subject, so an existing file for a
    # given id never needs to change). This makes reruns fast and means only the newly-added
    # ids actually hit the network.
    if not os.path.exists("audio/intro/listen_to_a_conversation.mp3"):
        communicate = edge_tts.Communicate("Listen to a conversation.", NARRATOR_VOICE)
        await communicate.save("audio/intro/listen_to_a_conversation.mp3")
        print("✓ listen_to_a_conversation.mp3 done")
    else:
        print("- listen_to_a_conversation.mp3 already exists, skipping")

    if not os.path.exists("audio/intro/listen_to_an_announcement.mp3"):
        communicate = edge_tts.Communicate("Listen to an announcement.", NARRATOR_VOICE)
        await communicate.save("audio/intro/listen_to_an_announcement.mp3")
        print("✓ listen_to_an_announcement.mp3 done")
    else:
        print("- listen_to_an_announcement.mp3 already exists, skipping")

    with open('mock_listening_academic_talk.json', 'r', encoding='utf-8') as f:
        mock_talks = json.load(f)
    for t in mock_talks:
        path = f"audio/intro/academic_talk_mock_{t['id']}.mp3"
        if os.path.exists(path):
            continue
        text = talk_intro_text(t.get('subject'))
        communicate = edge_tts.Communicate(text, NARRATOR_VOICE)
        await communicate.save(path)
        print(f"✓ {path} ({text}) done")

    with open('listening_part4.json', 'r', encoding='utf-8') as f:
        practice_talks = json.load(f)
    for t in practice_talks:
        path = f"audio/intro/academic_talk_practice_{t['id']}.mp3"
        if os.path.exists(path):
            continue
        text = talk_intro_text(t.get('subject'))
        communicate = edge_tts.Communicate(text, NARRATOR_VOICE)
        await communicate.save(path)
        print(f"✓ {path} ({text}) done")

    print(f"Total intro files now on disk: {len(os.listdir('audio/intro'))}")

asyncio.run(generate_all())
print("All done!")
