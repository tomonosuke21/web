// ① 画面の部品を、idで探して変数に入れる
const codeBox = document.getElementById("code");
const runButton = document.getElementById("run");
const statusText = document.getElementById("status");
const output = document.getElementById("output");

// ② Pyodideを入れておく変数(最初は空)
let pyodide = null;

// ③ 準備する関数:Pyodideを読み込んで、出力先を設定する
async function setup() {
  pyodide = await loadPyodide();

  // print の出力を、画面の output に追加する
  pyodide.setStdout({
    batched: (line) => {
      output.textContent += line + "\n";
    },
  });

  // エラー出力も同じ場所に出す
  pyodide.setStderr({
    batched: (line) => {
      output.textContent += line + "\n";
    },
  });

  statusText.textContent = "準備できました!";
  runButton.disabled = false; // ボタンを押せるようにする
}

// ④ 実行する関数:テキストエリアのコードをPythonで動かす
async function runCode() {
  output.textContent = ""; // 前の出力を消す
  try {
    await pyodide.runPythonAsync(codeBox.value);
  } catch (error) {
    output.textContent += error.message; // Pythonのエラーを表示
  }
}

// ⑤ ボタンが押されたら runCode を動かす
runButton.addEventListener("click", runCode);

// ⑥ ページを開いたら、すぐ準備を始める
setup();