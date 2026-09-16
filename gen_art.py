#!/usr/bin/env python3
# 九九モード（上がり・下がり・バラバラ）の絵を Codex に 1枚ずつ描かせて art/<キー>/<名前>.png に置く。
# 使い方: python3 gen_art.py [--jobs 3] [キー ...]   （もう絵があるものは とばす＝何回でも回しなおせる）
# 描きおわったら python3 build_art.py で マス選び＋index.html / art.ts の書きかえ をする。
import json, subprocess, sys, shutil, time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from build_art import LEVELS

ROOT = Path(__file__).resolve().parent
GEN = Path.home() / ".codex" / "generated_images"
GRID = {6: "6×6", 8: "8×8", 10: "10×10"}
TONE = {
    "easy": "日本の小学2年生が見て「かわいい！」と思う、やさしくて明るい色づかい。こわい表情にはしない。",
    "mid":  "日本の小学2年生が見て「おしゃれ！」と思う、パステル寄りで上品な色づかい。こわい表情にはしない。",
    "boss": "日本の小学2年生が見て「かっこいい！」と思う、はっきりした強めの色づかい。ただし こわすぎる表情にはしない。",
}
# 題材の説明（名前だけだと ぶれるもの）
HINT = {
    "moon": "三日月", "cloud": "空にうかぶ白い雲（虫のクモではない）",
    "top": "ひもで回して遊ぶ木のこま（将棋の駒ではない）", "blocks": "カラフルな木の積み木（文字は入れない）",
    "drum": "太鼓（和太鼓でも小太鼓でもよい）", "yoyo": "おもちゃのヨーヨー", "alien": "まるい頭の かわいい宇宙人", "paperplane": "紙ひこうき",
    "ufo": "空とぶ円盤", "shootingstar": "しっぽの長い流れ星", "telescope": "天体望遠鏡",
    "propplane": "プロペラ機（小型の飛行機）", "airship": "飛行船", "astronaut": "宇宙服を着た宇宙飛行士",
    "station": "宇宙ステーション", "satellite": "パネルを広げた人工衛星", "jet": "ジェット旅客機ではなく流線形のジェット機",
    "rover": "惑星を走る探査車", "meteor": "炎につつまれて落ちてくる隕石", "anchor": "船のいかり",
    "seaslug": "カラフルなウミウシ", "angelfish": "エンゼルフィッシュ", "bottleship": "びんの中に入った帆船（ボトルシップ）",
    "anglerfish": "チョウチンアンコウ（ちょうちんが光っている）", "isopod": "ダイオウグソクムシ",
    "marlin": "カジキ", "moray": "ウツボ", "coelacanth": "シーラカンス", "clownfish": "クマノミ",
    "duck": "おふろに浮かべる黄色いアヒルのおもちゃ", "rockinghorse": "木でできた ゆり木馬",
    "sheep": "ひつじのぬいぐるみ", "musicbox": "ふたが開いたオルゴール", "kendama": "けん玉",
    "carousel": "メリーゴーラウンド", "dollhouse": "ドールハウス（小さなおうち）", "jackbox": "びっくり箱（ばねで顔が飛び出す）",
    "puzzlecube": "色つきの立体パズルキューブ（文字やロゴは入れない）", "matryoshka": "マトリョーシカ人形",
    "shinkansen": "新幹線（ロゴや文字は入れない）", "steamloco": "蒸気機関車", "firetruck": "はしごのついた消防車",
    "excavator": "ショベルカー", "policecar": "パトカー（文字は入れない）", "monstertruck": "大きなタイヤのモンスタートラック",
    "cranetruck": "クレーン車", "motorbike": "オートバイ",
}

def prompt(key, size, file, name):
    base = key.split("-")[0]
    return (
        "1024x1024の正方形PNGを1枚だけ生成してください。背景は完全な純白(#FFFFFF)で、影・模様・グラデーション・枠線を背景に一切入れないこと。"
        "被写体は画面の中央に大きく1つだけ、全体が余白ぎりぎりまで入るように配置。文字・数字・ロゴ・サイン・透かしは一切入れない。 "
        f"題材：{name}（{HINT.get(file, name)}）。シンプルで まるみのある形にして、細かい模様は入れない"
        f"（{GRID[size]}の粗い格子に分けても形が分かるくらい大づかみに）。 "
        "粘土のような立体感のある「ぷっくり3D」イラスト。やわらかい質感で、つやとハイライトがある。"
        "輪郭がはっきりしていて、小さく縮めてもシルエットで何か分かること。" + TONE[base]
    )

STOP = []   # Codex の使用上限に当たったら 残りは ためさず止める（あとで回しなおせば 続きから描く）

def one(key, size, file, name):
    dst = ROOT / "art" / key / f"{file}.png"
    if dst.exists():
        return f"skip {key}/{file}"
    if STOP:
        return f"STOP {key}/{file}（使用上限）"
    dst.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(2):
        p = subprocess.run(
            ["codex", "exec", "--skip-git-repo-check", "--json", prompt(key, size, file, name)],
            capture_output=True, text=True, timeout=900, cwd="/tmp",
        )
        sid = None
        for line in p.stdout.splitlines():
            try:
                ev = json.loads(line)
            except ValueError:
                continue
            sid = sid or ev.get("thread_id") or ev.get("session_id") or (ev.get("payload") or {}).get("id")
        pngs = sorted((GEN / sid).glob("*.png"), key=lambda x: x.stat().st_mtime) if sid and (GEN / sid).exists() else []
        if pngs:
            shutil.copy2(pngs[-1], dst)
            return f"ok   {key}/{file} ({name})"
        if "usage limit" in p.stdout:
            STOP.append(1)
            return f"STOP {key}/{file}（使用上限）"
        time.sleep(20)
    return f"FAIL {key}/{file} ({name}) rc={p.returncode} {p.stderr[-300:]!r} {p.stdout[-300:]!r}"

def main():
    args = sys.argv[1:]
    jobs = 3
    if args[:1] == ["--jobs"]:
        jobs, args = int(args[1]), args[2:]
    todo = [(k, s, f, nm) for k, s, _, plan in LEVELS if (not args or k in args) for _, f, nm in plan]
    with ThreadPoolExecutor(jobs) as ex:
        for msg in ex.map(lambda t: one(*t), todo):
            print(msg, flush=True)

if __name__ == "__main__":
    main()
