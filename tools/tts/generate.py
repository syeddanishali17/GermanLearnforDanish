"""Generate natural German audio for every phrase with Kokoro (Thorsten-Voice German fine-tune).

Model: https://huggingface.co/Thorsten-Voice/Kokoro (Apache 2.0, voice data CC0).
Output: frontend/public/audio/<key>.mp3 + manifest.json for the public (generic) content, and
        frontend/public/audio-private/ (git-ignored, login-only) for lines that exist only in data/private/overlay.json.
The key is the first 16 hex chars of SHA-1 over the normalised text, same function as frontend/src/lib/audioKey.ts.

Usage (from tools/tts):
  uv run python generate.py --samples          # 3 test clips into out/
  uv run python generate.py                    # all missing clips
  uv run python generate.py --force            # regenerate everything
"""

import argparse
import hashlib
import json
import re
import time
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from huggingface_hub import hf_hub_download
from kokoro import KModel, KPipeline

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "public" / "audio"
OUT_PRIVATE = ROOT / "frontend" / "public" / "audio-private"
OVERLAY = ROOT / "data" / "private" / "overlay.json"
SR = 24000
REPO = "Thorsten-Voice/Kokoro"
SPEED = 0.95


def normalise(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip())


def key(text: str) -> str:
    return hashlib.sha1(normalise(text).encode("utf-8")).hexdigest()[:16]


def speakable(text: str) -> str:
    # "..." gaps in phrase frames (Was bedeutet ...?) read badly; make them a short pause.
    t = re.sub(r"\s*(\.\.\.|…)\s*", ", ", normalise(text))
    t = re.sub(r",\s*([?!.])", r"\1", t)
    return t.strip(" ,")


def _decks_and_convs(with_overlay: bool):
    decks = [json.loads(f.read_text(encoding="utf-8")) for f in sorted((ROOT / "data" / "seed").glob("*.json"))]
    convs = [json.loads(f.read_text(encoding="utf-8")) for f in sorted((ROOT / "data" / "conversations").glob("*.json"))]
    if with_overlay and OVERLAY.exists():
        ov = json.loads(OVERLAY.read_text(encoding="utf-8"))
        for d in decks:
            if "items" in d:
                d["items"] = [{**i, **ov.get("items", {}).get(i["slug"], {})} for i in d["items"]]
        for f in convs:
            f["conversations"] = [{**c, **ov.get("conversations", {}).get(c["slug"], {})} for c in f["conversations"]]
    return decks, convs


def _expand_words(deck: dict) -> dict:
    """Mirror of expandWordDeck in frontend/worker/content.ts: groups of [German, English, extra] -> items."""
    if "groups" not in deck:
        return deck
    return {**deck, "items": [{"de": w[0]} for g in deck["groups"] for w in g["words"]]}


def drill_sentence(d: dict) -> str:
    """Mirror of drillSentence in frontend/src/lib/drills.ts."""
    if d["t"] == "gap":
        return re.sub(r"\s*\([^)]*\)\s*$", "", d["q"].replace("___", d["a"]))
    return d["a"]


def collect(with_overlay: bool = False) -> list[str]:
    texts: set[str] = set()
    decks, convs = _decks_and_convs(with_overlay)
    decks = [_expand_words(d) for d in decks]
    for f in sorted((ROOT / "data" / "grammar").glob("*.json")):
        for p in json.loads(f.read_text(encoding="utf-8"))["patterns"]:
            texts.update(de for de, _ in p["examples"])
            texts.update(drill_sentence(d) for d in p["drills"])
    for d in decks:
        for i in d["items"]:
            texts.add(i["de"])
            if i.get("likely_reply_de"):
                texts.add(i["likely_reply_de"])
            for t in i.get("dialogue", []):
                texts.add(t["de"])
    for f in convs:
        for c in f["conversations"]:
            for t in c["turns"]:
                texts.add(t["de"])
                texts.update(t.get("alt", []))
            for k in c.get("key_phrases", []):
                texts.add(k["de"])
    return sorted(normalise(t) for t in texts)


def load():
    torch.set_num_threads(max(1, (torch.get_num_threads())))
    config = hf_hub_download(REPO, "config.json")
    weights = hf_hub_download(REPO, "model.pth")
    voice = torch.load(hf_hub_download(REPO, "voices/thorsten.pt"), map_location="cpu", weights_only=True)
    model = KModel(repo_id="hexgrad/Kokoro-82M", config=config, model=weights).to("cpu").eval()
    pipeline = KPipeline(lang_code="d", repo_id="hexgrad/Kokoro-82M", model=model)
    g2p = pipeline.g2p
    # Kokoro's vocabulary lacks the short-ü symbol; map it as the model card recommends.
    pipeline.g2p = lambda text: (lambda ps, tok: (ps.replace("ʏ", "y"), tok))(*g2p(text))
    return pipeline, voice


def synth(pipeline, voice, text: str, speed: float) -> np.ndarray:
    chunks = [audio.numpy() if hasattr(audio, "numpy") else audio for _, _, audio in pipeline(speakable(text), voice=voice, speed=speed)]
    audio = np.concatenate(chunks) if chunks else np.zeros(1, dtype=np.float32)
    pad = np.zeros(int(SR * 0.12), dtype=np.float32)  # tiny lead-in/out so phones don't clip the first syllable
    return np.concatenate([pad, audio.astype(np.float32), pad])


def to_mp3(wav: Path, mp3: Path) -> None:
    import lameenc

    data, sr = sf.read(wav, dtype="int16")
    enc = lameenc.Encoder()
    enc.set_bit_rate(48)
    enc.set_in_sample_rate(sr)
    enc.set_channels(1)
    enc.set_quality(2)
    mp3.write_bytes(enc.encode(data.tobytes()) + enc.flush())


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--samples", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--speed", type=float, default=0.95)
    args = ap.parse_args()

    pipeline, voice = load()
    tmp = Path(__file__).parent / "out"
    tmp.mkdir(exist_ok=True)

    if args.samples:
        for n, t in enumerate(
            [
                "Grüß Gott! Ja, ich wohne seit Kurzem hier.",
                "Entschuldigung, ich lerne noch Deutsch. Können Sie das bitte wiederholen?",
                "Am Samstag war ich am Kahlenberg wandern. Von oben sieht man ganz Wien.",
            ]
        ):
            t0 = time.time()
            sf.write(tmp / f"sample{n + 1}.wav", synth(pipeline, voice, t, args.speed), SR)
            print(f"sample{n + 1}.wav  {time.time() - t0:.1f}s  {t}")
        return

    public = collect()
    private = sorted(set(collect(with_overlay=True)) - set(public))
    # Private first, so personal lines that were public before are moved out instead of deleted and re-rendered.
    render(pipeline, voice, private, OUT_PRIVATE, tmp, args.force, borrow_from=OUT)
    render(pipeline, voice, public, OUT, tmp, args.force, borrow_from=OUT_PRIVATE)


def render(pipeline, voice, texts: list[str], out: Path, tmp: Path, force: bool, borrow_from: Path) -> None:
    """Make out/ contain exactly one clip per text plus manifest.json. Reuses clips from borrow_from when a line moved."""
    out.mkdir(parents=True, exist_ok=True)
    for t in texts:
        src = borrow_from / f"{key(t)}.mp3"
        if not (out / f"{key(t)}.mp3").exists() and src.exists() and not force:
            src.replace(out / f"{key(t)}.mp3")
    todo = [t for t in texts if force or not (out / f"{key(t)}.mp3").exists()]
    print(f"{out.name}: {len(texts)} texts, {len(todo)} to generate", flush=True)
    t0 = time.time()
    for n, t in enumerate(todo, 1):
        wav = tmp / "clip.wav"
        sf.write(wav, synth(pipeline, voice, t, SPEED), SR)
        to_mp3(wav, out / f"{key(t)}.mp3")
        if n % 25 == 0 or n == len(todo):
            print(f"  {n}/{len(todo)}  {time.time() - t0:.0f}s", flush=True)
    manifest = {key(t): t for t in texts}
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=0, sort_keys=True), encoding="utf-8")
    stale = [p for p in out.glob("*.mp3") if p.stem not in manifest]
    for p in stale:
        p.unlink()
    print(f"  manifest: {len(manifest)} clips, removed {len(stale)} stale files", flush=True)


if __name__ == "__main__":
    main()
