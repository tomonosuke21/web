// HTMLの部品を作る補助関数(文字は、必ず textContent で入れる)
function el(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

const DIFFICULTY_LABELS = {
  1: "初級",
  2: "中級",
  3: "上級",
  4: "難関",
  5: "最難関",
};

const LANGUAGE_LABELS = {
  python: "Python",
};

const STAGE_KIND_LABELS = {
  study: "スタディ",
  fill: "穴埋めテスト",
  problem: "練習問題",
};

const MAX_RANK = 100;
const POINTS_PER_RANK = 100;

// 累計ポイントからランク(1〜100)を計算する
function calcRank(points) {
  const safePts = Math.max(0, Number(points) || 0);
  return Math.min(MAX_RANK, Math.floor(safePts / POINTS_PER_RANK) + 1);
}

// 次のランクまでに必要な残りポイントを計算する(Lv.100なら0)
function calcNextRankRemaining(points) {
  const safePts = Math.max(0, Number(points) || 0);
  const rank = calcRank(safePts);
  if (rank >= MAX_RANK) return 0;
  return rank * POINTS_PER_RANK - safePts;
}