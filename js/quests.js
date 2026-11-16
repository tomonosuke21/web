const questList = document.getElementById("quest-list");

const LANGUAGE_LABELS = { python: "Python", javascript: "JavaScript" };
const KIND_LABELS = { study: "スタディ", fill: "穴埋めテスト", problem: "練習問題" };

// クエスト1件ぶんのカードを作る
function createQuestCard(quest) {
  const card = document.createElement("section");

  const title = document.createElement("h2");
  title.textContent = quest.title;

  const info = document.createElement("p");
  info.textContent =
    LANGUAGE_LABELS[quest.language] + " / 難易度 " + "★".repeat(quest.difficulty) +
    " / 約" + quest.minutes + "分";

  const description = document.createElement("p");
  description.textContent = quest.description;

  const button = document.createElement("button");
  button.textContent = "ステージを見る";

  const stageList = document.createElement("ol");
  stageList.hidden = true;

  button.addEventListener("click", async () => {
    // 開いているときは、閉じるだけ
    if (!stageList.hidden) {
      stageList.hidden = true;
      return;
    }

    button.disabled = true;
    const { data, error } = await db
      .from("stages")
      .select("id, position, kind, title")
      .eq("quest_id", quest.id)
      .order("position");
    button.disabled = false;

    stageList.textContent = "";
    if (error) {
      console.error(error);
      stageList.textContent = "読み込めませんでした";
    } else {
      for (const stage of data) {
        const item = document.createElement("li");
        item.textContent = KIND_LABELS[stage.kind] + ": " + stage.title;
        stageList.appendChild(item);
      }
    }
    stageList.hidden = false;
  });

  card.append(title, info, description, button, stageList);
  return card;
}

// 公開済みのクエストを読み込んで、一覧にする
async function loadQuests() {
  const { data, error } = await db
    .from("quests")
    .select("id, title, description, language, difficulty, minutes")
    .eq("status", "published")
    .order("id");

  questList.textContent = "";
  if (error) {
    console.error(error);
    questList.textContent = "クエストを読み込めませんでした";
    return;
  }
  if (data.length === 0) {
    questList.textContent = "公開中のクエストはまだありません";
    return;
  }
  for (const quest of data) {
    questList.appendChild(createQuestCard(quest));
  }
}

loadQuests();