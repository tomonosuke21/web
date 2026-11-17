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
