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

// Pyodide標準のastモジュールでPythonコードの構造を解析する。
async function analyzePython(runner, code) {
  // JSON文字列を安全にPython文字列として渡す
  const payload = JSON.stringify(code);
  const analysisCode = `import ast, json\nsource = json.loads(${JSON.stringify(payload)})\ntree = ast.parse(source)\nitems = set()\nfor node in ast.walk(tree):\n    kind = type(node).__name__\n    if kind in {'For','AsyncFor','While','If','IfExp','FunctionDef','AsyncFunctionDef','ClassDef','ListComp','SetComp','DictComp','GeneratorExp','Try','With','Lambda','Return','Break','Continue'}:\n        items.add(('syntax', kind))\n    if isinstance(node, ast.Call):\n        name = node.func.id if isinstance(node.func, ast.Name) else (node.func.attr if isinstance(node.func, ast.Attribute) else '')\n        if name: items.add(('call', name))\n    if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store):\n        items.add(('variable', node.id))\n    if isinstance(node, ast.operator): items.add(('operator', type(node).__name__))\nprint(json.dumps([{'type': a, 'name': b} for a,b in sorted(items)]))`;
  const result = await runner.run(analysisCode, '');
  if (result.hasError || result.timedOut) throw new Error(result.lines.join('\n') || 'コードを解析できませんでした');
  try { return JSON.parse(result.lines.join('\n')); }
  catch { throw new Error('構文解析の結果を読み取れませんでした'); }
}

async function gradeCodeWithRules(runner, code, tests, requirements) {
  const base = await gradeCode(runner, code, tests);
  const messages = [...base.messages];
  let rulesPassed = true;
  if (requirements && requirements.length) {
    try {
      const found = await analyzePython(runner, code);
      const keys = new Set(found.map(x => x.type + ':' + x.name));
      const missing = requirements.filter(x => !keys.has(x.type + ':' + x.name));
      if (missing.length) {
        rulesPassed = false;
        messages.push('構文・内容: ❌ 必須条件が不足しています: ' + missing.map(x => x.name).join('、'));
      } else messages.push('構文・内容: ✅ 必須条件を満たしています');
    } catch (e) {
      rulesPassed = false;
      messages.push('構文・内容: ❌ Pythonの構文を解析できませんでした\n' + e.message);
    }
  }
  return { ...base, messages, rulesPassed, allPassed: base.allPassed && rulesPassed };
}
