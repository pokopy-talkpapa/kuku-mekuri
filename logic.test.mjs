// index.html 内の純粋ロジック（@pure-start〜@pure-end）をそのまま取り出して検証する
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const src  = html.match(/\/\* @pure-start[\s\S]*?@pure-end[^\n]*\*\//)[0];
const { ART, LEVELS, LV, artCount, answersOf, dummiesOf, shuffled, deCluster, buildBoard, goalCells, tapKind, foundNumbers, isComplete } =
  new Function(`${src}; return {ART, LEVELS, LV, artCount, answersOf, dummiesOf, shuffled, deCluster, buildBoard, goalCells, tapKind, foundNumbers, isComplete};`)();

const DANS = Object.keys(ART).map(Number).sort((a,b)=>a-b);
const neighbors = (i, size)=>{
  const r=Math.floor(i/size), c=i%size, o=[];
  if(c>0) o.push(i-1); if(c<size-1) o.push(i+1);
  if(r>0) o.push(i-size); if(r<size-1) o.push(i+size);
  return o;
};
// (段, レベル) の全組み合わせを回すための小さなヘルパ
function eachCase(fn){
  for(const n of DANS) for(const l of LEVELS) fn(n, l, ART[n][l.size].on);
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

test('2〜9 の 8段ぶんの絵がそろっている', () => {
  assert.deepEqual(DANS, [2,3,4,5,6,7,8,9]);
  for(const n of DANS){
    assert.deepEqual(Object.keys(ART[n]).map(Number).sort((a,b)=>a-b), [6,8,10], `${n}のだん の盤面サイズがそろっていない`);
    for(const l of LEVELS){
      const a = ART[n][l.size];
      assert.ok(a.name, `${n}のだん ${l.key} に名前がない`);
      assert.match(a.file, new RegExp('^art/'+l.key+'/.+\\.png$'), `${n}のだん ${l.key} の画像パスがおかしい`);
    }
  }
});

test('レベルごとに ちがう絵が かくれている（同じ絵を使いまわしていない）', () => {
  // 子どもががんばる理由の一つが「何が出てくるんだろう」なので、
  // はじめ・まんなか・ボスで 同じ絵を出さない（2026-09-07 ぽこぴぃ指示）
  const all = [];
  for(const n of DANS){
    const files = LEVELS.map(l => ART[n][l.size].file);
    assert.equal(new Set(files).size, LEVELS.length, `${n}のだん が レベルちがいで同じ絵を使っている`);
    all.push(...files);
  }
  assert.equal(new Set(all).size, DANS.length * LEVELS.length, 'ちがう段どうしで同じ絵を使っている');
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
    const on = ART[n][l.size].on;
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
    const on = ART[n][l.size].on;
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
    const on = ART[n][l.size].on;
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
