const codeBox = document.getElementById("code");
const runButton = document.getElementById("run");
const statusText = document.getElementById("status");
const output = document.getElementById("output");

const TIME_LIMIT_MS = 5000; // 制限時間(5秒)
const MAX_OUTPUT = 10000;   // 画面に出す文字数の上限

let worker = null;  // 今動いているWorker
let timerId = null; // 時間切れ用タイマーの番号

// 出力欄に1行追加する(上限を超えたら追加しない)
function addOutput(text) {
  if (output.textContent.length < MAX_OUTPUT) {
    output.textContent += text + "\n";
  }
}

// Workerを作る(作り直しもこの関数でやる)
function createWorker() {
  runButton.disabled = true;
  statusText.textContent = "Pythonを準備中…";

  worker = new Worker("js/worker.js");

  worker.onmessage = (event) => {
    const message = event.data;

    if (message.type === "ready") {
      statusText.textContent = "準備できました!";
      runButton.disabled = false;
    } else if (message.type === "stdout" || message.type === "error") {
      addOutput(message.text);
    } else if (message.type === "done") {
      clearTimeout(timerId); // 時間内に終わったので、タイマーを解除
      runButton.disabled = false;
    }
  };
}

// 時間切れ:Workerを強制終了して、作り直す
function handleTimeout() {
  worker.terminate();
  addOutput("時間切れです(" + TIME_LIMIT_MS / 1000 + "秒)。実行を止めました。");
  createWorker();
}

// 実行ボタン
runButton.addEventListener("click", () => {
  output.textContent = "";
  runButton.disabled = true;
  timerId = setTimeout(handleTimeout, TIME_LIMIT_MS);
  worker.postMessage({ type: "run", code: codeBox.value });
});

createWorker();