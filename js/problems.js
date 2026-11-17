const gridEl = document.getElementById("problem-grid");
const statusEl = document.getElementById("grid-status");

// new.html のときは、新しい順に並べる
const isNewPage = document.body.dataset.page === "new";
const fromParam = isNewPage ? "new" : "problems";

const badges = new Map(); // ステージID -> 「クリア済み」バッジ

function formatDate(iso) {
  const d = new Date(iso);
  return d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate();
}

// 公開済みクエストの「練習問題」ステージを、20件ずつ取る
function fetchProblemPage(from, to) {
  let query = db
    .from("stages")
    .select("id, title, created_at, quests!inner(title, difficulty, language, status)")
    .eq("kind", "problem")
    .eq("quests.status", "published");

  if (isNewPage) {
    query = query.order("created_at", { ascending: false }).order("id", { ascending: false });
  } else {
    query = query.order("id", { ascending: true });
  }
  return query.range(from, to);
}

function createProblemCard(row) {
  const quest = row.quests;

  const card = el("a");
  card.className = "grid-card";
  card.href = "stage.html?id=" + row.id + "&from=" + fromParam;

  const sub = el("p", quest.title);
  sub.className = "grid-card-sub";

  const metaText =
    (DIFFICULTY_LABELS[quest.difficulty] || "") + " / " +
    (LANGUAGE_LABELS[quest.language] || quest.language) +
    (isNewPage ? " / " + formatDate(row.created_at) : "");
  const meta = el("p", metaText);
  meta.className = "grid-card-meta";

  const badge = el("span", "クリア済み");
  badge.className = "done-badge";
  badge.hidden = true;
  badges.set(row.id, badge);

  card.append(el("h3", row.title), sub, meta, badge);
  return card;
}

// 自分がクリアしたものに、バッジを出す
async function showBadges(ids) {
  if (currentUser === null || ids.length === 0) return;

  const { data, error } = await db
    .from("stage_progress")
    .select("stage_id")
    .in("stage_id", ids);
  if (error) {
    console.error(error);
    return;
  }
  for (const row of data) {
    const badge = badges.get(row.stage_id);
    if (badge) badge.hidden = false;
  }
}

// ログイン・ログアウトのたびに、バッジを付け直す
document.addEventListener("auth-ready", async () => {
  for (const badge of badges.values()) badge.hidden = true;
  await showBadges([...badges.keys()]);
});

createInfiniteGrid({
  gridEl: gridEl,
  statusEl: statusEl,
  pageSize: 20,
  emptyText: "公開中の問題はまだありません",
  fetchPage: fetchProblemPage,
  createCard: createProblemCard,
  onAppended: (rows) => showBadges(rows.map((r) => r.id)),
});