import {
  NoCapError,
  VERSION,
  run,
} from "https://cdn.jsdelivr.net/npm/nocap-lang@1.2.1/dist/index.js";

const examples = {
  hello: `yo chat

flex "Hello, chat!";
flex "Welcome to NoCap.";

aight, touch grass`,

  vibe: `yo chat

soft launch score = 92;
soft launch verified = no cap;

vibe check (score >= 90 && verified) {
  flex "Vibe check passed. No cap.";
} not the vibe {
  flex "Not the vibe.";
}

aight, touch grass`,

  stars: `yo chat

soft launch rows = 5;
soft launch row = 1;
soft launch stars = "";

keep cooking while (row <= rows) {
  stars = stars + "*";
  flex stars;
  row += 1;
}

aight, touch grass`,

  prime: `yo chat

soft launch number = 29;
soft launch divisor = 2;
soft launch isPrime = no cap;

vibe check (number < 2) {
  isPrime = delulu;
} not the vibe {
  keep cooking while (divisor * divisor <= number) {
    vibe check (number % divisor == 0) {
      isPrime = delulu;
      cooked;
    }
    divisor += 1;
  }
}

vibe check (isPrime) {
  flex number, "is prime.";
} not the vibe {
  flex number, "is not prime.";
}

aight, touch grass`,

  factorial: `yo chat

cook factorial(number) {
  vibe check (number <= 1) {
    serve 1;
  }

  serve number * factorial(number - 1);
}

soft launch number = 6;
flex "Factorial of", number, "is", factorial(number);

aight, touch grass`,
};

const keywordGroups = {
  value: ["no cap", "delulu", "ghosted"],
  control: [
    "vibe check",
    "not the vibe",
    "keep cooking while",
    "ghosting",
    "cooked",
    "try this",
    "caught in 4K",
  ],
  function: ["cook", "serve", "crash out"],
  keyword: ["aight, touch grass", "soft launch", "yo chat", "flex"],
};

const allKeywords = Object.values(keywordGroups)
  .flat()
  .sort((a, b) => b.length - a.length);

const tokenPattern = new RegExp(
  `(\\/\\*[\\s\\S]*?\\*\\/|\\/\\/[^\\n]*|"(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|${allKeywords
    .map(escapeRegExp)
    .join("|")}|\\b\\d+(?:\\.\\d+)?\\b|==|!=|<=|>=|\\+=|-=|\\*=|\\/=|%=|&&|\\|\\||[+\\-*/%<>=!])`,
  "g",
);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function tokenClass(token) {
  if (token.startsWith("//") || token.startsWith("/*")) return "tok-comment";
  if (token.startsWith('"') || token.startsWith("'")) return "tok-string";
  if (/^\d/.test(token)) return "tok-number";
  for (const [group, keywords] of Object.entries(keywordGroups)) {
    if (keywords.includes(token)) return `tok-${group}`;
  }
  return "tok-operator";
}

function highlight(code) {
  let result = "";
  let cursor = 0;
  for (const match of code.matchAll(tokenPattern)) {
    const token = match[0];
    const index = match.index ?? 0;
    result += escapeHtml(code.slice(cursor, index));
    result += `<span class="${tokenClass(token)}">${escapeHtml(token)}</span>`;
    cursor = index + token.length;
  }
  return result + escapeHtml(code.slice(cursor));
}

document.querySelectorAll("code[data-highlight]").forEach((element) => {
  element.innerHTML = highlight(element.textContent ?? "");
});

const editor = document.querySelector("#editor");
const editorHighlight = document.querySelector("#editor-highlight code");
const output = document.querySelector("#output");
const runButton = document.querySelector("#run-button");
const clearButton = document.querySelector("#clear-button");
const exampleSelect = document.querySelector("#example-select");
const runStatus = document.querySelector("#run-status");
const lineCount = document.querySelector("#line-count");
const toast = document.querySelector("#toast");

function syncEditor() {
  editorHighlight.innerHTML = `${highlight(editor.value)}\n`;
  const lines = editor.value.split("\n").length;
  lineCount.textContent = `${lines} ${lines === 1 ? "line" : "lines"}`;
}

function syncEditorScroll() {
  const pre = document.querySelector("#editor-highlight");
  pre.scrollTop = editor.scrollTop;
  pre.scrollLeft = editor.scrollLeft;
}

function setStatus(kind, label) {
  runStatus.className = `run-status ${kind}`;
  runStatus.innerHTML = `<i></i> ${label}`;
}

function loadExample(name) {
  editor.value = examples[name] ?? examples.hello;
  syncEditor();
  output.className = "";
  output.textContent = "Hit “Run” when the vibe feels right.";
  setStatus("", "Ready");
}

function executeCode() {
  const lines = [];
  try {
    run(editor.value, {
      filename: "playground.np",
      maxSteps: 100_000,
      stdout: (line) => lines.push(line),
    });
    output.className = "has-output";
    output.textContent = lines.length > 0 ? lines.join("\n") : "Program finished with no output.";
    setStatus("success", "Passed");
  } catch (error) {
    output.className = "has-error";
    output.textContent = error instanceof NoCapError ? error.format() : String(error);
    setStatus("error", "Caught in 4K");
  }
}

editor.addEventListener("input", syncEditor);
editor.addEventListener("scroll", syncEditorScroll);
editor.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;
  event.preventDefault();
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  editor.setRangeText("  ", start, end, "end");
  syncEditor();
});

runButton.addEventListener("click", executeCode);
clearButton.addEventListener("click", () => {
  editor.value = "";
  syncEditor();
  output.className = "";
  output.textContent = "Editor cleared. Fresh aura unlocked.";
  setStatus("", "Ready");
  editor.focus();
});
exampleSelect.addEventListener("change", () => loadExample(exampleSelect.value));

document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", () => copyText(button.dataset.copy));
});

document.querySelectorAll("[data-copy-target]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = document.getElementById(button.dataset.copyTarget);
    copyText(target?.textContent ?? "");
  });
});

let toastTimer;
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied. No cap.");
  } catch {
    showToast("Copy failed — select it manually.");
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 1800);
}

document.querySelectorAll(".window-badge").forEach((badge) => {
  badge.title = `NoCap ${VERSION}`;
});

loadExample("hello");
