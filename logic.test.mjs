// index.html 内の純粋ロジック（@pure-start〜@pure-end）をそのまま取り出して検証する
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const src  = html.match(/\/\* @pure-start[\s\S]*?@pure-end[^\n]*\*\//)[0];
const NAMES = ['ART','LEVELS','LV','DANS','KUKU','ART_KEYS','artKeyOf','baseLvOf','lvOfArtKey',
  'artCount','answersOf','dummiesOf','shuffled','deCluster','buildBoard','goalCells','tapKind',
  'foundNumbers','isComplete','YOMI','nextYomi','clearedDansOf','lockOf'];
const { ART, LEVELS, LV, DANS, KUKU, ART_KEYS, artKeyOf, baseLvOf, lvOfArtKey,
  artCount, answersOf, dummiesOf, shuffled, deCluster, buildBoard, goalCells, tapKind,
  foundNumbers, isComplete, YOMI, nextYomi, clearedDansOf, lockOf } =
  new Function(`${src}; return {${NAMES.join(',')}};`)();
const neighbors = (i, size)=>{
  const r=Math.floor(i/size), c=i%size, o=[];
  if(c>0) o.push(i-1); if(c<size-1) o.push(i+1);
  if(r>0) o.push(i-size); if(r<size-1) o.push(i+size);
  return o;
};
// (段 × 絵のセット6つ) の全組み合わせを回すための小さなヘルパ
// 絵のセット＝ふつうの3レベル ＋ 九九モードの3レベル
function eachCase(fn){
  for(const n of DANS) for(const key of ART_KEYS) fn(n, lvOfArtKey(key), ART[n][key].on, key);
}

test('レベルは3だんかい・数のつじつまが合っている', () => {
  assert.deepEqual(LEVELS.map(l=>l.key), ['easy','mid','boss']);
  assert.deepEqual(LEVELS.map(l=>l.size), [6,8,10]);
  assert.deepEqual(LEVELS.map(l=>l.per),  [2,3,4]);
  // こたえの数（9×per）＋穴 が 絵のマス数。絵のマスは盤面より少ない
  assert.deepEqual(LEVELS.map(artCount), [22,34,45]);
  for(const l of LEVELS){
    assert.ok(artCount(l) < l.size*l.size, `${l.label} の絵が盤面に入らない`);
    assert.ok(l.hole > 0, `${l.label} に穴がない`);
    assert.equal(LV[l.key], l);
  }
  // 帯は はじめ・まんなか だけ ON固定、ボスは かくせる
  assert.deepEqual(LEVELS.map(l=>l.band), [true,true,false]);
});

test('2〜9 の 8段ぶん × 絵のセット6つ が そろっている', () => {
  assert.deepEqual(DANS, [2,3,4,5,6,7,8,9]);
  assert.deepEqual(ART_KEYS, ['easy','mid','boss','easy-kuku','mid-kuku','boss-kuku']);
  for(const n of DANS){
    assert.deepEqual(Object.keys(ART[n]).sort(), ART_KEYS.slice().sort(), `${n}のだん の絵のセットがそろっていない`);
    for(const key of ART_KEYS){
      const a = ART[n][key];
      assert.ok(a.name, `${n}のだん ${key} に名前がない`);
      assert.match(a.file, new RegExp('^art/'+key+'/.+\\.png$'), `${n}のだん ${key} の画像パスがおかしい`);
    }
  }
});

test('絵のセットのキー：九九モードは レベル名 + "-kuku"', () => {
  for(const l of LEVELS){
    assert.equal(artKeyOf(l.key, false), l.key);
    assert.equal(artKeyOf(l.key, true),  l.key + KUKU);
    assert.equal(baseLvOf(l.key), l.key);
    assert.equal(baseLvOf(l.key + KUKU), l.key);
    // 九九モードでも 盤面の作り（マス数・こたえの数・穴）は ふつうと同じレベルに従う
    assert.equal(lvOfArtKey(l.key + KUKU), l);
    assert.equal(lvOfArtKey(l.key), l);
  }
});

test('48枚ぜんぶ ちがう絵（同じ絵を使いまわしていない）', () => {
  // 子どもががんばる理由の一つが「何が出てくるんだろう」なので、
  // レベルちがい・九九モードちがいで 同じ絵を出さない（2026-09-07／2026-09-10 ぽこぴぃ指示）
  const all = [];
  for(const n of DANS){
    const files = ART_KEYS.map(key => ART[n][key].file);
    assert.equal(new Set(files).size, ART_KEYS.length, `${n}のだん が セットちがいで同じ絵を使っている`);
    all.push(...files);
  }
  assert.equal(new Set(all).size, DANS.length * ART_KEYS.length, 'ちがう段どうしで同じ絵を使っている');
});

test('九九モードの絵は ふつうのモードと まったく別のモチーフ', () => {
  // 九九モードに取り組むインセンティブが「ここでしか会えない絵」なので、使いまわさない
  for(const n of DANS){
    for(const l of LEVELS){
      const a = ART[n][l.key], b = ART[n][l.key + KUKU];
      assert.notEqual(a.name, b.name, `${n}のだん ${l.key} で 名前が同じ`);
      assert.notEqual(a.file, b.file, `${n}のだん ${l.key} で 画像が同じ`);
    }
  }
});

test('絵のマスは レベルごとの数ちょうど・重複なし・盤面の内側', () => {
  eachCase((n, l, on) => {
    const want = artCount(l);
    assert.equal(on.length, want, `${n}のだん ${l.label} が ${on.length}マス`);
    assert.equal(new Set(on).size, want, `${n}のだん ${l.label} に同じマスが二度出た`);
    for(const i of on) assert.ok(Number.isInteger(i) && i>=0 && i<l.size*l.size, `${n}のだん ${l.label} に範囲外 ${i}`);
  });
});

test('絵のマスは つながっている（飛び地の点だけが浮かない）', () => {
  eachCase((n, l, on) => {
    const set = new Set(on);
    const seen = new Set([on[0]]);
    const stack = [on[0]];
    while(stack.length){
      const i = stack.pop();
      for(const j of neighbors(i, l.size)) if(set.has(j) && !seen.has(j)){ seen.add(j); stack.push(j); }
    }
    // ぜんぶ一続きでなくてもよいが、離れた小島は3マス以上のかたまりであること
    const rest = on.filter(i=>!seen.has(i));
    assert.ok(rest.length === 0 || rest.length >= 3, `${n}のだん ${l.label} に ${rest.length}マスの飛び地`);
  });
});

test('こたえの一覧', () => {
  assert.deepEqual(answersOf(3), [3,6,9,12,15,18,21,24,27]);
  assert.deepEqual(answersOf(9), [9,18,27,36,45,54,63,72,81]);
});

test('ダミーには その段のこたえが1つも入らない', () => {
  for(const n of DANS){
    const d = dummiesOf(n);
    assert.ok(d.length > 0);
    for(const v of d) assert.notEqual(v % n, 0, `${n}のだん のダミーに ${v}（こたえ）が入った`);
    assert.ok(Math.max(...d) <= n*9, `${n}のだん のダミーが こたえの最大より大きい`);
    assert.ok(Math.min(...d) >= 1);
  }
});

test('盤面：絵の外には こたえを絶対に置かない', () => {
  eachCase((n, l, on) => {
    for(let t=0;t<10;t++){
      const onSet = new Set(on);
      const nums = buildBoard(n, on, Math.random, l.size, l.per);
      assert.equal(nums.length, l.size*l.size);
      for(let i=0;i<nums.length;i++){
        if(!onSet.has(i)) assert.notEqual(nums[i] % n, 0, `${n}のだん ${l.label} ${i}番（絵の外）に こたえ ${nums[i]}`);
      }
    }
  });
});

test('盤面：9つのこたえが per こずつ 平等に出る（＝めくるのは 9×per マス）', () => {
  eachCase((n, l, on) => {
    const nums = buildBoard(n, on, Math.random, l.size, l.per);
    const cnt = {};
    for(const i of on) if(nums[i] % n === 0) cnt[nums[i]] = (cnt[nums[i]]||0)+1;
    for(const v of answersOf(n)) assert.equal(cnt[v], l.per, `${n}のだん ${l.label} の ${v} が ${cnt[v]}こ`);
    assert.equal(goalCells(nums, on, n).length, 9*l.per);
  });
});

test('盤面：絵の上に わざと hole マスの穴（ダミー）がある＝絵の形から正解を読めない', () => {
  eachCase((n, l, on) => {
    const nums = buildBoard(n, on, Math.random, l.size, l.per);
    const holes = on.filter(i => nums[i] % n !== 0);
    assert.equal(holes.length, l.hole, `${n}のだん ${l.label} の穴が ${holes.length}マス`);
    for(const i of holes) assert.ok(dummiesOf(n).includes(nums[i]), `穴に ${nums[i]} が入った`);
  });
});

test('穴の場所は やるたびに変わる（どのレベルでも）', () => {
  const n = 3;
  for(const l of LEVELS){
    const on = ART[n][l.key].on;
    const seen = new Set();
    for(let t=0;t<20;t++){
      const nums = buildBoard(n, on, Math.random, l.size, l.per);
      seen.add(on.filter(i => nums[i] % n !== 0).join(','));
    }
    assert.ok(seen.size >= 18, `${l.label}：20回まわして ${seen.size}通りしか出なかった`);
  }
});

test('タップ判定：こたえなら めくれる、ちがえば おてつき', () => {
  assert.equal(tapKind(12, 3), 'ok');
  assert.equal(tapKind(27, 3), 'ok');
  assert.equal(tapKind(13, 3), 'miss');
  assert.equal(tapKind(1,  3), 'miss');
  assert.equal(tapKind(8,  4), 'ok');
  assert.equal(tapKind(6,  4), 'miss');
});

test('帯から消えるのは その数を per こ全部めくったときだけ', () => {
  const n = 3;
  for(const l of LEVELS){
    const on = ART[n][l.key].on;
    const nums = buildBoard(n, on, Math.random, l.size, l.per);
    const threes = on.filter(i => nums[i] === 3);
    assert.equal(threes.length, l.per);
    const opened = new Set();
    for(let k=0;k<l.per-1;k++){
      opened.add(threes[k]);
      assert.ok(!foundNumbers(nums, opened, n).has(3), `${l.label}：${k+1}こ目で消えてしまった`);
    }
    opened.add(threes[l.per-1]);
    assert.ok(foundNumbers(nums, opened, n).has(3), `${l.label}：${l.per}こ目で消えなかった`);
  }
});

test('「つぎのめあて」の枠は 廃止されている（順番を指示しない）', () => {
  // 順番は問わない設計。UI が「つぎは3だよ」と言ってしまうので 2026-09-07 に消した。足しなおさないこと
  assert.ok(!/nextTarget/.test(src), '純粋ロジックに nextTarget が復活している');
  assert.ok(!/\.step\.next\b/.test(html), 'CSS に .step.next が復活している');
  assert.ok(!/['"]\s*next\s*['"]/.test(html) && !/ next['"]/.test(html), 'next クラスの付与が復活している');
});

test('かんせい判定：こたえのマスを全部めくったときだけ true（絵の穴はめくらなくていい）', () => {
  eachCase((n, l, on) => {
    const nums = buildBoard(n, on, Math.random, l.size, l.per);
    const goal = goalCells(nums, on, n);
    const last = goal.length - 1;
    const opened = new Set(goal.slice(0, last));
    assert.ok(!isComplete(opened, goal), `${n}のだん ${l.label} が ${last}マスで完成になった`);
    opened.add(goal[last]);
    assert.ok(isComplete(opened, goal), `${n}のだん ${l.label} が ${goal.length}マスで完成にならない`);
  });
});

test('絵の穴をめくらなくても完成できる（穴は goal に入っていない）', () => {
  eachCase((n, l, on) => {
    const nums = buildBoard(n, on, Math.random, l.size, l.per);
    const goal = new Set(goalCells(nums, on, n));
    for(const i of on.filter(i => nums[i] % n !== 0)){
      assert.ok(!goal.has(i), `${n}のだん ${l.label} の穴 ${i} がゴールに入っている`);
    }
  });
});

test('おてつきを何回しても かんせい判定には影響しない（判定はこたえのマスだけを見る）', () => {
  const n = 5;
  for(const l of LEVELS){
    const on = ART[n][l.key].on;
    const nums = buildBoard(n, on, Math.random, l.size, l.per);
    const goal = goalCells(nums, on, n);
    const all = Array.from({length:l.size*l.size},(_,i)=>i);
    assert.ok(isComplete(new Set(goal), goal));
    assert.ok(isComplete(new Set(all), goal), 'よけいなマスが開いていても完成は完成');
  }
});

test('シャッフルは中身を変えない', () => {
  const src = [1,2,3,4,5,5,5];
  const out = shuffled(src, Math.random);
  assert.deepEqual(out.slice().sort(), src.slice().sort());
  assert.deepEqual(src, [1,2,3,4,5,5,5], '元の配列が書きかわった');
});

test('deCluster は数の多重集合を変えない（どの盤面サイズでも）', () => {
  for(const l of LEVELS){
    const total = l.size*l.size;
    const nums = Array.from({length:total}, (_,i)=> (i%9)+1);
    const before = nums.slice().sort((a,b)=>a-b);
    deCluster(nums, Array.from({length:total},(_,i)=>i), Math.random, l.size);
    assert.deepEqual(nums.slice().sort((a,b)=>a-b), before, `${l.label} で中身が変わった`);
  }
});

/* ---- 九九モード：ひらがなの唱え ---- */

test('唱えは 8段 × 9つ そろっていて、ぜんぶ ひらがな', () => {
  assert.deepEqual(Object.keys(YOMI).map(Number).sort((a,b)=>a-b), DANS);
  for(const n of DANS){
    assert.equal(YOMI[n].length, 9, `${n}のだん の唱えが ${YOMI[n].length}こ`);
    assert.equal(new Set(YOMI[n]).size, 9, `${n}のだん に同じ唱えが二度出た`);
    for(const y of YOMI[n]) assert.match(y, /^[ぁ-んー]+$/, `${n}のだん の「${y}」に ひらがな以外が入っている`);
  }
});

test('唱えに こたえは入っていない（「が」が付くのは こたえが1けたのときだけ）', () => {
  // 「にいちが（2）」「にご（じゅう）」のように、こたえの読みだけを取り去った形。
  // こたえが1けたのときだけ「〜が」で終わるのが 九九の言い方の決まり。
  for(const n of DANS){
    YOMI[n].forEach((y, i) => {
      const ans = n * (i + 1);
      assert.equal(y.endsWith('が'), ans < 10, `${n}×${i+1}＝${ans} の「${y}」の「が」がおかしい`);
    });
  }
});

test('唱えの言い方（教科書どおり）', () => {
  assert.equal(YOMI[2][0], 'にいちが');   // 2×1
  assert.equal(YOMI[2][1], 'ににんが');   // 2×2
  assert.equal(YOMI[3][2], 'さざんが');   // 3×3
  assert.equal(YOMI[3][5], 'さぶろく');   // 3×6
  assert.equal(YOMI[4][6], 'しち');       // 4×7＝しちにじゅうはち
  assert.equal(YOMI[5][8], 'ごっく');     // 5×9
  assert.equal(YOMI[8][7], 'はっぱ');     // 8×8
  assert.equal(YOMI[9][8], 'くく');       // 9×9
});

test('つぎの唱え：ぐるっと まわる', () => {
  const none = new Set();
  assert.equal(nextYomi(-1, none, 3), 0, 'さいしょは「さんいちが」から');
  assert.equal(nextYomi(0, none, 3), 1);
  assert.equal(nextYomi(7, none, 3), 8);
  assert.equal(nextYomi(8, none, 3), 0, '9つめの つぎは さいしょに もどる');
});

test('つぎの唱え：ぜんぶ見つけた こたえは 出てこない（自動で飛ばす）', () => {
  // 3のだん。6（3×2）と 9（3×3）を すでに ぜんぶ めくっている
  const found = new Set([6, 9]);
  assert.equal(nextYomi(0, found, 3), 3, '6と9を飛ばして 3×4 へ');
  assert.equal(nextYomi(-1, found, 3), 0, 'まだ残っている 3×1 から');
  // 3×1 も見つけたら さいしょは 3×4 になる
  assert.equal(nextYomi(-1, new Set([3, 6, 9]), 3), 3);
  // ぐるっと まわるときも 飛ばす
  assert.equal(nextYomi(8, new Set([3, 6]), 3), 2, '9つめの つぎ→3×1は済み→3×2も済み→3×3');
});

test('つぎの唱え：ぜんぶ見つけたら もう出す唱えがない（-1）', () => {
  const all = new Set(answersOf(7));
  assert.equal(nextYomi(-1, all, 7), -1);
  assert.equal(nextYomi(4, all, 7), -1);
});

/* ---- レベルのロック ---- */

test('かんせいさせた段の数え方：九九モードのぶんも 同じレベルとして数える', () => {
  const cleared = new Set(['easy:3', 'easy-kuku:5', 'mid:2', 'easy:3']);
  assert.deepEqual([...clearedDansOf(cleared, 'easy')].sort((a,b)=>a-b), [3,5]);
  assert.deepEqual([...clearedDansOf(cleared, 'mid')],  [2]);
  assert.deepEqual([...clearedDansOf(cleared, 'boss')], []);
});

test('ロック：はじめは いつでも遊べる', () => {
  const l = lockOf('easy', new Set());
  assert.equal(l.open, true);
  assert.equal(l.left, 0);
});

test('ロック：はじめの8だんが そろって はじめて まんなかが開く', () => {
  const cleared = new Set();
  for(const n of DANS.slice(0, 7)) cleared.add('easy:' + n);
  let l = lockOf('mid', cleared);
  assert.equal(l.open, false, '7だんで開いてしまった');
  assert.equal(l.left, 1, 'のこり1だん と出ない');
  assert.equal(l.prev, 'はじめ');
  cleared.add('easy:' + DANS[7]);
  l = lockOf('mid', cleared);
  assert.equal(l.open, true, '8だんそろっても開かない');
  assert.equal(l.left, 0);
});

test('ロック：まんなかが そろうまで ボスは開かない（はじめを全部そろえても）', () => {
  const cleared = new Set(DANS.map(n => 'easy:' + n));
  assert.equal(lockOf('mid', cleared).open, true);
  assert.equal(lockOf('boss', cleared).open, false);
  assert.equal(lockOf('boss', cleared).left, 8);
  assert.equal(lockOf('boss', cleared).prev, 'まんなか');
  for(const n of DANS) cleared.add('mid-kuku:' + n);   // 九九モードでそろえてもよい
  assert.equal(lockOf('boss', cleared).open, true, '九九モードで そろえたのに 開かない');
});

test('九九モードは レベルのロックに そのまま従う（抜け道にしない）', () => {
  // 九九モードだからといって ロック中のレベルに入れてはいけない
  assert.equal(lockOf(baseLvOf('mid-kuku'), new Set()).open, false);
  assert.equal(lockOf(baseLvOf('boss-kuku'), new Set()).open, false);
  assert.equal(lockOf(baseLvOf('easy-kuku'), new Set()).open, true);
});
