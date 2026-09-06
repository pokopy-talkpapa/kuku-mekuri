# スクールタクト用の盤面PNGを作る（アプリと同じルールで数を配置する）
import random, re, sys, os
from PIL import Image, ImageDraw, ImageFont

HTML = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'index.html')
OUT  = "/Users/pokopy/Documents/たねまき/2026-08-31_なるほど_くくぬりえ"
MARU = "/System/Library/Fonts/ヒラギノ丸ゴ ProN W4.ttc"
KAKU = "/System/Library/Fonts/ヒラギノ角ゴシック W7.ttc"

def load_art():
    """index.html の ART 定義から 10x10（＝ボス）の絵を読む。
    紙（スクールタクト）は 10x10・45マス全部にこたえ＝穴なし のままなので 6/8 は使わない。
    ART は 段 → 盤面サイズ → {name,file,on} の入れ子（レベルごとに絵がちがう・2026-09-07）。"""
    html = open(HTML, encoding='utf-8').read()
    block = re.search(r'/\* ART-START \*/(.*?)/\* ART-END \*/', html, re.S).group(1)
    arts = {}
    for n, body in re.findall(r'^  (\d):\{$(.*?)^  \},$', block, re.S | re.M):
        m = re.search(r'10:\{name:"(.+?)", file:"(.+?)", on:\[(.*?)\]\}', body, re.S)
        if not m:
            continue
        arts[int(n)] = (m.group(1), m.group(2), [int(v) for v in re.findall(r'\d+', m.group(3))])
    return arts

def build(n, on, rnd):
    ans = [n*k for k in range(1, 10)]
    dum = [v for v in range(1, n*9+1) if v % n]
    nums = [0]*100
    slots = on[:]; rnd.shuffle(slots)
    vals = [ans[i % len(ans)] for i in range(len(on))]   # 45マスなら 9こたえ×5つずつ
    rnd.shuffle(vals)
    for i, s in enumerate(slots):
        nums[s] = vals[i]
    bag = []
    def draw(src):
        nonlocal bag
        if not bag:
            bag = src[:]; rnd.shuffle(bag)
        return bag.pop()
    onset = set(on)
    off = []
    for i in range(100):
        if i not in onset:
            off.append(i)
            nums[i] = draw(dum)
    decluster(nums, on, rnd)
    decluster(nums, off, rnd)
    return nums, onset


def decluster(nums, idxs, rnd, tries=600):
    s = set(idxs)
    def nb(i):
        r, c = divmod(i, 10)
        o = []
        if c > 0: o.append(i-1)
        if c < 9: o.append(i+1)
        if r > 0: o.append(i-10)
        if r < 9: o.append(i+10)
        return [j for j in o if j in s]
    bad = lambda i: any(nums[j] == nums[i] for j in nb(i))
    for _ in range(tries):
        conf = [i for i in idxs if bad(i)]
        if not conf: break
        i = rnd.choice(conf); j = rnd.choice(idxs)
        if nums[i] == nums[j]: continue
        nums[i], nums[j] = nums[j], nums[i]
        if bad(i) or bad(j):
            nums[i], nums[j] = nums[j], nums[i]
    return nums

CELL, GAP, PAD, TOP = 118, 6, 24, 150
W = PAD*2 + CELL*10 + GAP*9
H = TOP + CELL*10 + GAP*9 + PAD

def draw(nums, onset, title, path, answer=False):
    img = Image.new("RGB", (W, H), "#FFFFFF")
    d = ImageDraw.Draw(img)
    d.text((PAD, 48), title, font=ImageFont.truetype(MARU, 62), fill="#3C2415")
    fnum = ImageFont.truetype(KAKU, 52)
    for i in range(100):
        x = PAD + (i % 10)*(CELL+GAP)
        y = TOP + (i//10)*(CELL+GAP)
        fill = "#FDE7CC" if (answer and i in onset) else "#F4F7F6"
        d.rounded_rectangle([x, y, x+CELL, y+CELL], radius=12, fill=fill,
                            outline="#C9D6D3", width=3)
        t = str(nums[i])
        bb = d.textbbox((0, 0), t, font=fnum)
        d.text((x + (CELL-(bb[2]-bb[0]))/2 - bb[0],
                y + (CELL-(bb[3]-bb[1]))/2 - bb[1]), t, font=fnum,
               fill=("#B4551A" if (answer and i in onset) else "#3C2415"))
    img.save(path)
    print(path)

if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    seed = int(sys.argv[2]) if len(sys.argv) > 2 else 20260831
    arts = load_art()
    name, file, on = arts[n]
    rnd = random.Random(seed)
    nums, onset = build(n, on, rnd)
    draw(nums, onset, f"{n}のだんの こたえを ぜんぶ ぬろう",
         f"{OUT}/{n}のだん_こども.png", answer=False)
    draw(nums, onset, f"【せんせい用】{n}のだん → {name}",
         f"{OUT}/{n}のだん_せんせい.png", answer=True)
