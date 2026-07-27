import json

with open('listening_part1.json', 'r') as f:
    exercises = json.load(f)

for ex in exercises:
    ex['audio_url'] = f"http://localhost:8000/audio/listening_p1/{ex['id']}.mp3"

with open('listening_part1.json', 'w') as f:
    json.dump(exercises, f, indent=2, ensure_ascii=False)

print("JSON updated!")