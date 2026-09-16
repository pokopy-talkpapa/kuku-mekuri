#!/usr/bin/env python3
# art/*.png を「まんなかに寄せた純白背景の正方形」に整えて、
# 6x6 / 8x8 / 10x10 それぞれで「絵があるマス」を選び、index.html の ART 定義を書き換える。
import sys, re, json, shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent
ART  = ROOT / "art"
SIZE = 1024
PAD  = 0.04        # まわりの余白

# 絵のセット（レベル × 九九モードの有無）ごとに べつの絵を隠す。
#   はじめ   6x6  = 36マス中 22（こたえ18＝9×2 ＋ 穴4）  かわいい動物
#   まんなか 8x8  = 64マス中 34（こたえ27＝9×3 ＋ 穴7）  おしゃれなモチーフ
#   ボス     10x10=100マス中 45（こたえ36＝9×4 ＋ 穴9）  かっこいいモチーフ
# 九九モード（キーのおしり "-kuku"）は 盤面の大きさは同じで 絵だけ別のモチーフ＝でんせつの生きもの。
# ⚠️ 同じ段でもレベルがちがえば絵はちがう（何が出るか分からないのが がんばる理由なので）
LEVELS = [
    ("easy", 6, 22, [
        (2, "rabbit",   "うさぎ"),
        (3, "cat",      "ねこ"),
        (4, "bear",     "くま"),
        (5, "penguin",  "ペンギン"),
        (6, "elephant", "ゾウ"),
        (7, "panda",    "パンダ"),
        (8, "dog",      "いぬ"),
        (9, "chick",    "ひよこ"),
    ]),
    ("mid", 8, 34, [
        (2, "cake",     "ケーキ"),
        (3, "icecream", "アイス"),
        (4, "teacup",   "ティーカップ"),
        (5, "bouquet",  "はなたば"),
        (6, "balloon",  "ききゅう"),
        (7, "crown",    "かんむり"),
        (8, "shell",    "かいがら"),
        (9, "camera",   "カメラ"),
    ]),
    ("boss", 10, 45, [
        (2, "dino",   "きょうりゅう"),
        (3, "rocket", "ロケット"),
        (4, "dragon", "ドラゴン"),
        (5, "robot",  "ロボット"),
        (6, "castle", "おしろ"),
        (7, "shark",  "サメ"),
        (8, "car",    "スポーツカー"),
        (9, "wolf",   "オオカミ"),
    ]),
    ("easy-kuku", 6, 22, [
        (2, "unicorn",   "ユニコーン"),
        (3, "fairy",     "ようせい"),
        (4, "mermaid",   "にんぎょ"),
        (5, "babydrago", "こりゅう"),
        (6, "kappa",     "かっぱ"),
        (7, "wingcat",   "つばさのねこ"),
        (8, "goldbird",  "きんのとり"),
        (9, "kobito",    "こびと"),
    ]),
    ("mid-kuku", 8, 34, [
        (2, "pegasus",  "ペガサス"),
        (3, "phoenix",  "フェニックス"),
        (4, "griffin",  "グリフォン"),
        (5, "tengu",    "てんぐ"),
        (6, "seasnake", "うみへび"),
        (7, "kirin",    "きりん"),
        (8, "genbu",    "げんぶ"),
        (9, "yeti",     "ゆきおとこ"),
    ]),
    ("boss-kuku", 10, 45, [
        (2, "orochi",  "ヤマタノオロチ"),
        (3, "sphinx",  "スフィンクス"),
        (4, "wyvern",  "ワイバーン"),
        (5, "kraken",  "クラーケン"),
        (6, "golem",   "ゴーレム"),
        (7, "centaur", "ケンタウロス"),
        (8, "raijin",  "らいじん"),
        (9, "fujin",   "ふうじん"),
    ]),
    # 九九モードの じゅんばん版（2026-09-16）。「-kuku-up」＝上がり（そら・うちゅう）
    ("easy-kuku-up", 6, 22, [
        (2, "star",       "ほし"),
        (3, "moon",       "つき"),
        (4, "cloud",      "くも"),
        (5, "rainbow",    "にじ"),
        (6, "alien",      "うちゅうじん"),
        (7, "sun",        "たいよう"),
        (8, "paperplane", "かみひこうき"),
        (9, "ufo",        "UFO"),
    ]),
    ("mid-kuku-up", 8, 34, [
        (2, "saturn",       "どせい"),
        (3, "shootingstar", "ながれぼし"),
        (4, "earth",        "ちきゅう"),
        (5, "telescope",    "ぼうえんきょう"),
        (6, "parachute",    "パラシュート"),
        (7, "propplane",    "プロペラき"),
        (8, "airship",      "ひこうせん"),
        (9, "helicopter",   "ヘリコプター"),
    ]),
    ("boss-kuku-up", 10, 45, [
        (2, "astronaut", "うちゅうひこうし"),
        (3, "station",   "うちゅうステーション"),
        (4, "satellite", "じんこうえいせい"),
        (5, "jet",       "ジェットき"),
        (6, "rover",     "たんさしゃ"),
        (7, "eagle",     "ワシ"),
        (8, "meteor",    "いんせき"),
        (9, "drone",     "ドローン"),
    ]),
    # 「-kuku-down」＝下がり（うみのそこ）
    ("easy-kuku-down", 6, 22, [
        (2, "jellyfish", "クラゲ"),
        (3, "octopus",   "タコ"),
        (4, "seaturtle", "ウミガメ"),
        (5, "pufferfish","フグ"),
        (6, "starfish",  "ヒトデ"),
        (7, "crab",      "カニ"),
        (8, "dolphin",   "イルカ"),
        (9, "clownfish", "クマノミ"),
    ]),
    ("mid-kuku-down", 8, 34, [
        (2, "seahorse",   "タツノオトシゴ"),
        (3, "coral",      "さんご"),
        (4, "treasure",   "たからばこ"),
        (5, "anchor",     "いかり"),
        (6, "seaslug",    "ウミウシ"),
        (7, "angelfish",  "エンゼルフィッシュ"),
        (8, "manta",      "マンタ"),
        (9, "bottleship", "ボトルシップ"),
    ]),
    ("boss-kuku-down", 10, 45, [
        (2, "submarine",  "せんすいかん"),
        (3, "whale",      "クジラ"),
        (4, "orca",       "シャチ"),
        (5, "anglerfish", "チョウチンアンコウ"),
        (6, "isopod",     "ダイオウグソクムシ"),
        (7, "marlin",     "カジキ"),
        (8, "moray",      "ウツボ"),
        (9, "coelacanth", "シーラカンス"),
    ]),
    # 「-kuku-mix」＝バラバラ（おもちゃばこ）
    ("easy-kuku-mix", 6, 22, [
        (2, "blocks",       "つみき"),
        (3, "top",          "こま"),
        (4, "duck",         "アヒルのおもちゃ"),
        (5, "beachball",    "ビーチボール"),
        (6, "rockinghorse", "もくば"),
        (7, "drum",         "たいこ"),
        (8, "yoyo",         "ヨーヨー"),
        (9, "sheep",        "ひつじのぬいぐるみ"),
    ]),
    ("mid-kuku-mix", 8, 34, [
        (2, "musicbox",   "オルゴール"),
        (3, "kendama",    "けんだま"),
        (4, "carousel",   "メリーゴーラウンド"),
        (5, "dollhouse",  "ドールハウス"),
        (6, "jackbox",    "びっくりばこ"),
        (7, "ferris",     "かんらんしゃ"),
        (8, "puzzlecube", "パズルキューブ"),
        (9, "matryoshka", "マトリョーシカ"),
    ]),
    ("boss-kuku-mix", 10, 45, [
        (2, "shinkansen",   "しんかんせん"),
        (3, "steamloco",    "きかんしゃ"),
        (4, "firetruck",    "しょうぼうしゃ"),
        (5, "excavator",    "ショベルカー"),
        (6, "policecar",    "パトカー"),
        (7, "monstertruck", "モンスタートラック"),
        (8, "cranetruck",   "クレーンしゃ"),
        (9, "motorbike",    "オートバイ"),
    ]),
]
# 絵がまだ描けていなくても 段ごと消さずに進めてよい絵のセット（アプリ側は artOf で「九九（自由）」の絵に代用する）
OPTIONAL = {k for k, _, _, _ in LEVELS if k.count("-") >= 2}
DANS = [2, 3, 4, 5, 6, 7, 8, 9]

def normalize(p: Path):
    """白飛ばし・トリム・正方形中央寄せ・純白背景"""
    im = Image.open(p)
    if im.mode in ("RGBA", "LA"):
        bg = Image.new("RGB", im.size, "white")
        bg.paste(im, mask=im.split()[-1])
        im = bg
    im = im.convert("RGB")
    px = im.load()
    w, h = im.size
    # ほぼ白は完全な白にする
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if r > 244 and g > 244 and b > 244:
                px[x, y] = (255, 255, 255)
    # 中身のバウンディングボックス
    gray = im.convert("L").point(lambda v: 0 if v > 250 else 255)
    box = gray.getbbox()
    if box:
        im = im.crop(box)
    w, h = im.size
    side = int(max(w, h) * (1 + PAD * 2))
    canvas = Image.new("RGB", (side, side), "white")
    canvas.paste(im, ((side - w) // 2, (side - h) // 2))
    return canvas.resize((SIZE, SIZE), Image.LANCZOS)

def tile_box(i, size):
    """size x size に等分したときの i 番目のマスの位置（はしっこまで使い切る）"""
    c, r = i % size, i // size
    x0 = round(SIZE * c / size); x1 = round(SIZE * (c + 1) / size)
    y0 = round(SIZE * r / size); y1 = round(SIZE * (r + 1) / size)
    return x0, y0, x1, y1

def cells_of(im: Image.Image, size, n):
    """size x size の各マスの「絵がある割合」を出し、多い順に n マス選ぶ"""
    g = im.convert("L").point(lambda v: 255 if v < 250 else 0)
    score = []
    for i in range(size * size):
        x0, y0, x1, y1 = tile_box(i, size)
        tile = g.crop((x0, y0, x1, y1))
        area = (x1 - x0) * (y1 - y0)
        ink = sum(tile.point(lambda v: 1 if v else 0).getdata())
        score.append((ink / area, i))
    score.sort(key=lambda t: (-t[0], t[1]))
    return sorted(i for _, i in score[:n]), score

def neighbors(i, size):
    c, r = i % size, i // size
    out = []
    if c > 0:        out.append(i - 1)
    if c < size - 1: out.append(i + 1)
    if r > 0:        out.append(i - size)
    if r < size - 1: out.append(i + size)
    return out

def groups_of(on, size):
    """つながっているマスのかたまりに分ける（大きい順）"""
    rest, out = set(on), []
    while rest:
        seed = rest.pop()
        g, stack = {seed}, [seed]
        while stack:
            i = stack.pop()
            for j in neighbors(i, size):
                if j in rest:
                    rest.discard(j); g.add(j); stack.append(j)
        out.append(g)
    out.sort(key=len, reverse=True)
    return out

def fix_islands(on, size, score, min_island=3):
    """1〜2マスだけの飛び地をなくす。
    ⚠️ ぽつんと1マスだけ絵が出ると 子どもには ゴミにしか見えないので、
       その分を「本体のとなりで いちばん濃いマス」に振りかえる（マスの数は変えない）。"""
    rank = {i: v for v, i in score}          # マスごとの「絵の濃さ」
    on = set(on)
    for _ in range(size * size):             # ふつうは数回でおわる（暴走よけの上限）
        gs = groups_of(on, size)
        tiny = [g for g in gs[1:] if len(g) < min_island]
        if not tiny:
            break
        drop = min((i for g in tiny for i in g), key=lambda i: rank[i])
        cand = [j for i in gs[0] for j in neighbors(i, size) if j not in on]
        if not cand:
            break
        add = max(set(cand), key=lambda j: (rank[j], -j))
        on.discard(drop); on.add(add)
    return sorted(on)

def preview(im, on, size, out):
    """選んだマスだけ見せた確認用画像（子どもに見える状態のシミュレーション）"""
    v = Image.new("RGB", (SIZE, SIZE), (231, 239, 238))
    for i in on:
        x0, y0, x1, y1 = tile_box(i, size)
        v.paste(im.crop((x0, y0, x1, y1)), (x0, y0))
    v.save(out)

def main():
    art, report = {n: {} for n in DANS}, []
    for key, size, n_cells, plan in LEVELS:
        for dan, file, name in plan:
            src = ART / key / f"{file}.png"
            if not src.exists():
                if key not in OPTIONAL:
                    report.append(f"  !! {key} {dan}のだん {file}.png がない")
                continue
            im = normalize(src)
            im.save(src)                       # 整えたものを上書き保存
            on, score = cells_of(im, size, n_cells)
            on = fix_islands(on, size, score)
            preview(im, on, size, ART / key / f"_preview_{file}.png")
            art[dan][key] = (name, f"art/{key}/{file}.png", on)
            report.append(f"  {key:9s} {dan}のだん {name:8s} さいごのマスの濃さ {score[n_cells-1][0]:.3f}")

    must = [k for k, _, _, _ in LEVELS if k not in OPTIONAL]
    ready = [n for n in DANS if all(k in art[n] for k in must)]
    for k in OPTIONAL:
        lack = [n for n in ready if k not in art[n]]
        if lack:
            report.append(f"  .. {k} は {lack}のだん の絵がまだ（アプリは 九九（自由）の絵で代用する）")
    missing = [n for n in DANS if n not in ready]
    if missing:
        report.append(f"  !! そろっていないので とばした段: {missing}")
    if not ready:
        report.append("→ 書きかえるものがないので なにもしなかった")
        print("\n".join(report)); return

    def fmt(on, indent):
        rows = [", ".join(str(v) for v in on[i:i+20]) for i in range(0, len(on), 20)]
        return (",\n" + " " * indent).join(rows)

    # 単一HTML版（index.html）：段 → 絵のセット（レベル/九九モード）→ その絵
    lines = ["const ART = {"]
    for dan in ready:
        lines.append(f"  {dan}:{{")
        for key, _, _, _ in LEVELS:
            if key not in art[dan]:
                continue
            name, path, on = art[dan][key]
            lines.append(f'    "{key}":{{name:"{name}", file:"{path}", on:[\n      {fmt(on, 6)}]}},')
        lines.append("  },")
    lines.append("};")
    block = "/* ART-START */\n" + "\n".join(lines) + "\n/* ART-END */"

    # 部屋版（Next.js）も 段 → 絵のセット の入れ子。単一HTML版とちがうのは
    # export が付くことと、file が公開フォルダ基準で / から始まることだけ（2026-09-07 レベル移植）
    tslines = ["export const ART: Record<number, Record<string, { name: string; file: string; on: number[] }>> = {"]
    for dan in ready:
        tslines.append(f"  {dan}: {{")
        for key, _, _, _ in LEVELS:
            if key not in art[dan]:
                continue
            name, path, on = art[dan][key]
            tslines.append(f'    "{key}": {{ name: "{name}", file: "/{path}", on: [\n      {fmt(on, 6)}] }},')
        tslines.append("  },")
    tslines.append("};")   # DANS は ART-END の外にあるので触らない
    tsblock = "/* ART-START */\n" + "\n".join(tslines) + "\n/* ART-END */"

    pat = r"/\* ART-START \*/[\s\S]*?/\* ART-END \*/"
    for path, blk in ((ROOT / "index.html", block),
                      (ROOT / "app-src" / "src" / "lib" / "art.ts", tsblock)):
        if not path.exists():
            report.append(f"  !! {path.name} がないので書きかえをとばした")
            continue
        src = path.read_text(encoding="utf8")
        path.write_text(re.sub(pat, lambda m: blk, src, count=1), encoding="utf8")
        report.append(f"→ {path.name} の ART を {len(ready)}段ぶん 書きかえました")

    # 部屋版は public/ に置いた絵しか出せないので、ここで必ずコピーしておく。
    # ⚠️ 手でコピーし忘れると 部屋版だけ絵が出ない事故になるので 自動化した（2026-09-10）
    pub = ROOT / "app-src" / "public" / "art"
    if pub.parent.exists():
        n_copy = 0
        for key, _, _, _ in LEVELS:
            if not (ART / key).exists():
                continue
            dst = pub / key
            dst.mkdir(parents=True, exist_ok=True)
            for src_png in sorted((ART / key).glob("*.png")):
                if src_png.name.startswith("_preview_"):
                    continue           # 確認用は 部屋版には要らない
                shutil.copy2(src_png, dst / src_png.name)
                n_copy += 1
        report.append(f"→ 部屋版の public/art に {n_copy}枚 コピーしました")
    print("\n".join(report))

# ⚠️ import しただけで index.html が書きかわらないように（2026-09-07）
if __name__ == "__main__":
    main()
