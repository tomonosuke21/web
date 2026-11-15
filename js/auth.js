// supabase-js の CDN は、グローバルの supabase を作ってくれる
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const loginButton = document.getElementById("login");
const logoutButton = document.getElementById("logout");
const userText = document.getElementById("user");

let currentUser = null; // ログイン中のユーザー(いなければ null)

// ログイン状態が変わるたびに呼ばれる(ページを開いた直後も1回呼ばれる)
db.auth.onAuthStateChange((event, session) => {
  currentUser = session ? session.user : null;

  if (currentUser) {
    const meta = currentUser.user_metadata;
    const name = meta.user_name || meta.preferred_username || "ユーザー";
    userText.textContent = "ログイン中: " + name;
  } else {
    userText.textContent = "ログインしていません";
  }
  loginButton.hidden = currentUser !== null;
  logoutButton.hidden = currentUser === null;
});

// GitHubでログイン(GitHubの画面に移動して、許可したら戻ってくる)
loginButton.addEventListener("click", () => {
  db.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
});

logoutButton.addEventListener("click", () => {
  db.auth.signOut();
});

// 成績を保存する(結果を、画面に出すメッセージで返す)
async function saveResult(problemId, passed, code) {
  if (currentUser === null) {
    return "ログインすると成績が保存されます";
  }
  const { error } = await db.from("results").insert({
    problem_id: problemId,
    passed: passed,
    code: code,
  });
  if (error) {
    console.error(error);
    return "保存に失敗しました";
  }
  return "成績を保存しました";
}