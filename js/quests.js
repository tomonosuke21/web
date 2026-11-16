const questList = document.getElementById("quest-list");

const LANGUAGE_LABELS = { python: "Python", javascript: "JavaScript" };
const KIND_LABELS = { study: "学習", fill: "虫食い", problem: "練習問題" };

// 自分がクリアしたステージのIDを返す(ログインしていなければ空)
async function fetchDoneStageIds() {
  if (currentUser === null) return new Set();
  const { data, error } = await db.from("stage_progress").select("stage_id");
  if (error) {
    console.error(error);
    return new Set();
  }
  return new Set(data.map((row) => row.stage_id));
}

// クエスト1件ぶんのカードを作る
function createQuestCard(quest) {
  const card = document.createElement("section");
  card.className = "card";

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
    const doneIds = await fetchDoneStageIds();
    button.disabled = false;

    stageList.textContent = "";
    if (error) {
      console.error(error);
      stageList.textContent = "読み込めませんでした";
    } else {
      for (const stage of data) {
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = "stage.html?id=" + stage.id;
        link.textContent = KIND_LABELS[stage.kind] + ": " + stage.title;
        item.append(doneIds.has(stage.id) ? " " : "", link);
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
