// 言語ごとの、実行用Workerのファイル(JavaScriptなどは、ここに足していく)
const WORKER_FILES = { python: "js/worker.js" };

const TIME_LIMIT_MS = 5000; // 1回の実行の制限時間
const MAX_LINES = 1000;     // 受け取る出力の行数の上限

// 実行用の部品を作る(時間切れのときは、作り直す)
function createRunner(language) {
  const file = WORKER_FILES[language];
  let worker = null;
  let ready = null;
  let currentRun = null;

  function start() {
    ready = new Promise((resolve) => {
      worker = new Worker(file);
      worker.onmessage = (event) => {
        const message = event.data;
        if (message.type === "ready") {
          resolve();
          return;
        }
        if (currentRun === null) return;

        if (message.type === "stdout" || message.type === "error") {
          if (message.type === "error") currentRun.hasError = true;
          if (currentRun.lines.length < MAX_LINES) currentRun.lines.push(message.text);
        } else if (message.type === "done") {
          currentRun.finish(false);
        }
      };
    });
  }

  // コードを1回実行して、結果を返す
  async function run(code, input) {
    await ready;
    return new Promise((resolve) => {
      const current = { lines: [], hasError: false };
      currentRun = current;

      current.finish = (timedOut) => {
        clearTimeout(current.timerId);
        currentRun = null;
        resolve({ lines: current.lines, hasError: current.hasError, timedOut: timedOut });
      };

      current.timerId = setTimeout(() => {
        worker.terminate();
        start();
        current.finish(true);
      }, TIME_LIMIT_MS);

      worker.postMessage({ type: "run", code: code, input: input });
    });
  }

  start();
  return { run: run, whenReady: () => ready };
}

// テストケースを順に実行して、結果をまとめる
async function gradeCode(runner, code, tests) {
  const messages = [];
  let passed = 0;

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    const result = await runner.run(code, test.input || "");
    const actual = result.lines.join("\n").trim();
    const expected = String(test.expected).trim();
    const label = "ケース" + (i + 1) + ": ";

    if (result.timedOut) {
      messages.push(label + "⏱ 時間切れ");
    } else if (result.hasError) {
      messages.push(label + "❌ 実行エラー\n" + actual);
    } else if (actual === expected) {
      passed++;
      messages.push(label + "✅ 正解");
    } else {
      messages.push(label + "❌ 不正解(期待: " + expected + " / 実際: " + actual + ")");
    }
  }

  return {
    passed: passed,
    total: tests.length,
    allPassed: tests.length > 0 && passed === tests.length,
    messages: messages,
  };
}