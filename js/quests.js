const gridEl = document.getElementById("quest-grid");
const statusEl = document.getElementById("grid-status");

// 公開済みのクエストを、20件ずつ取る
function fetchQuestPage(from, to) {
  return db
    .from("quests")
    .select("id, title, description, language, difficulty, minutes")
    .eq("status", "published")
    .order("id", { ascending: true })
    .range(from, to);
}

function createQuestCard(quest) {
  const card = el("a");
  card.className = "grid-card";
  card.href = "quest.html?id=" + quest.id;

  const desc = el("p", quest.description);
  desc.className = "grid-card-desc";

  const meta = el(
    "p",
    (DIFFICULTY_LABELS[quest.difficulty] || "") + " / " +
      (LANGUAGE_LABELS[quest.language] || quest.language) + " / 約" + quest.minutes + "分"
  );
  meta.className = "grid-card-meta";

  card.append(el("h3", quest.title), desc, meta);
  return card;
}

createInfiniteGrid({
  gridEl: gridEl,
  statusEl: statusEl,
  pageSize: 20,
  emptyText: "公開中のクエストはまだありません",
  fetchPage: fetchQuestPage,
  createCard: createQuestCard,
});