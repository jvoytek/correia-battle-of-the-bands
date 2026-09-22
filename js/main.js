import { race } from "./vendor/racing-bars.js";

const DATA_PATH = "./data/leaderboard.json";
const TEAM_ORDER = ["7th Grade", "8th Grade"];
const TEAM_COLORS = {
  "7th Grade": { solid: "#1223b7", soft: "rgba(39, 198, 255, 0.18)" },
  "8th Grade": { solid: "#e10000", soft: "rgba(255, 141, 59, 0.18)" }
};

let chartHistory = [];
let refreshTimeoutId;
let raceChart;
const counterAnimations = new WeakMap();

const formatNumber = (value) => new Intl.NumberFormat("en-US").format(value);
const formatDayLabel = (day) => /\d/.test(day) && !/[A-Za-z]/.test(day) ? `Day ${day}` : day;

async function fetchLeaderboardData() {
  // Cache-busting keeps Pages/CDN responses fresh after JSON-only updates.
  const response = await fetch(`${DATA_PATH}?t=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to load leaderboard data (${response.status})`);
  }

  return response.json();
}

function animateCounter(element, nextValue) {
  const startValue = Number(element.dataset.value || 0);
  const duration = 1200;
  const startTime = performance.now();
  const currentAnimation = counterAnimations.get(element);

  if (currentAnimation) {
    cancelAnimationFrame(currentAnimation);
  }

  const tick = (now) => {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const currentValue = Math.round(startValue + (nextValue - startValue) * eased);
    element.textContent = formatNumber(currentValue) + " pts ";

    if (progress < 1) {
      const nextAnimation = requestAnimationFrame(tick);
      counterAnimations.set(element, nextAnimation);
    } else {
      element.dataset.value = String(nextValue);
      counterAnimations.delete(element);
    }
  };

  const nextAnimation = requestAnimationFrame(tick);
  counterAnimations.set(element, nextAnimation);
}

function renderStandings(data) {
  const teams = [...data.teams].sort((left, right) => right.totalPoints - left.totalPoints);
  if (teams.length < 2) {
    throw new Error("Leaderboard data must contain both grade teams.");
  }
  const leader = teams[0];
  const runnerUp = teams[1];
  const differential = leader.totalPoints - runnerUp.totalPoints;

  TEAM_ORDER.forEach((grade) => {
    const team = data.teams.find((entry) => entry.grade === grade);
    if (!team) {
      return;
    }

    const totalElement = document.querySelector(`[data-total-for="${grade}"]`);
    //const rankElement = document.querySelector(`[data-rank-for="${grade}"]`);
    const cardElement = document.querySelector(`[data-team-card="${grade}"]`);
    if (!totalElement || !cardElement) {
      throw new Error(`Missing scoreboard elements for ${grade}.`);
    }
    //const rank = teams.findIndex((entry) => entry.grade === grade) + 1;

    totalElement.dataset.value ??= "0";
    animateCounter(totalElement, team.totalPoints);
    //rankElement.textContent = `#${rank}`;
    cardElement.classList.toggle("is-leading", grade === leader.grade);
  });

  /*const diffTotal = document.getElementById("diff-total");
  const diffMeta = document.getElementById("diff-meta");
  if (!diffTotal || !diffMeta) {
    throw new Error("Missing lead differential elements.");
  }

  diffTotal.dataset.value ??= "0";
  animateCounter(diffTotal, differential);
  diffMeta.textContent = `${leader.grade} leads by ${formatNumber(differential)} points`;*/
}

function renderStatus(lastUpdated) {
  const lastUpdatedElement = document.getElementById("last-updated");
  if (!lastUpdatedElement) {
    throw new Error("Missing last updated element.");
  }

  lastUpdatedElement.textContent = lastUpdated;
}

function renderChartSummary(data) {
  const summary = document.getElementById("chart-summary");
  if (!summary) {
    return;
  }

  const finalEntry = data.history.at(-1);
  const finalDay = formatDayLabel(finalEntry?.day ?? "the latest update");
  const seventh = finalEntry?.["7th"] ?? data.teams.find((entry) => entry.grade === "7th Grade")?.totalPoints ?? 0;
  const eighth = finalEntry?.["8th"] ?? data.teams.find((entry) => entry.grade === "8th Grade")?.totalPoints ?? 0;
  const leader = seventh === eighth ? "The grades are tied" : seventh > eighth ? "7th Grade leads" : "8th Grade leads";
  summary.textContent = `${finalDay}: animated bar chart race. 7th Grade has ${formatNumber(seventh)} points and 8th Grade has ${formatNumber(eighth)} points. ${leader}.`;
}

function getRaceData(history) {
  return history.flatMap((entry, index) => {
    const normalizedDate = `2026-09-${String(index + 1).padStart(2, "0")}`;

    return TEAM_ORDER.map((grade) => {
      const key = grade.startsWith("7th") ? "7th" : "8th";
      return {
        date: normalizedDate,
        name: grade,
        value: entry[key] ?? 0,
        color: TEAM_COLORS[grade].solid
      };
    });
  });
}

function getDateCounter(history) {
  const dateMap = new Map(
    history.map((entry, index) => [`2026-09-${String(index + 1).padStart(2, "0")}`, formatDayLabel(entry.day)])
  );

  return (currentDate) => dateMap.get(currentDate) ?? currentDate;
}

function renderStudentLeaderboard(entries) {
  const list = document.getElementById("student-leaderboard");
  if (!list) {
    throw new Error("Missing student leaderboard container.");
  }
  const topFive = [...entries]
    .sort((left, right) => right.totalPoints - left.totalPoints)
    .slice(0, 5);

  list.innerHTML = "";

  topFive.forEach((entry, index) => {
    const item = document.createElement("li");
    const rank = document.createElement("span");
    const details = document.createElement("span");
    const name = document.createElement("strong");
    const grade = document.createElement("span");
    const points = document.createElement("span");

    rank.className = "student-rank";
    rank.textContent = `${index + 1}. `;

    name.className = "student-name";
    name.textContent = entry.name;
    grade.textContent = ` ${entry.grade} `;
    details.append(name, grade);

    points.className = "student-points";
    points.textContent = formatNumber(entry.totalPoints);

    item.append(rank, details, points, " pts");
    list.appendChild(item);
  });
}

function drawEmptyChartState(container, message) {
  container.textContent = message;
}

function destroyRaceChart() {
  if (raceChart) {
    raceChart.destroy();
    raceChart = undefined;
  }
}

async function renderChart(history) {
  const container = document.getElementById("history-chart");
  if (!(container instanceof HTMLElement)) {
    throw new Error("History chart container is missing.");
  }

  destroyRaceChart();
  chartHistory = history;

  if (!history.length) {
    drawEmptyChartState(container, "Waiting for progress history");
    return;
  }

  raceChart = await race(getRaceData(history), container, {
    title: "",
    subTitle: "",
    caption: "",
    labelsPosition: "outside",
    labelsWidth: 140,
    fixedScale: true,
    controlButtons: "none",
    overlays: "none",
    mouseControls: false,
    keyboardControls: false,
    autorun: true,
    loop: false,
    theme: "dark",
    colorMap: TEAM_ORDER.reduce((map, grade) => {
      map[grade] = TEAM_COLORS[grade].solid;
      return map;
    }, {}),
    height: "100%",
    width: "100%",
    minHeight: 180,
    minWidth: 180,
    marginTop: 24,
    marginRight: 32,
    marginBottom: 28,
    marginLeft: 8,
    topN: TEAM_ORDER.length,
    tickDuration: 500,
    valueDecimals: 0,
    valueLocale: "en-US",
    dateCounter: getDateCounter(history),
    injectStyles: true
  });
}

function renderChartOnResize() {
  if (!chartHistory.length) {
    return;
  }

  window.clearTimeout(renderChartOnResize.timeoutId);
  renderChartOnResize.timeoutId = window.setTimeout(() => {
    renderChart(chartHistory).catch((error) => {
      console.error(error);
    });
  }, 150);
}

renderChartOnResize.timeoutId = 0;

window.addEventListener("resize", renderChartOnResize);

window.addEventListener("beforeunload", () => {
  destroyRaceChart();
});

window.addEventListener("DOMContentLoaded", async () => {
  await loadLeaderboard();
  await scheduleRefresh();
});

function validateDataShape(data) {
  if (!data || !Array.isArray(data.teams) || !Array.isArray(data.history) || !Array.isArray(data.leaderboard)) {
    throw new Error("Leaderboard data is missing one or more required arrays.");
  }
}

async function loadLeaderboard() {
  try {
    const data = await fetchLeaderboardData();
    validateDataShape(data);
    renderStandings(data);
    await renderChart(data.history);
    renderChartSummary(data);
    renderStudentLeaderboard(data.leaderboard);
    renderStatus(data.lastUpdated);
  } catch (error) {
    console.error(error);
    const diffMeta = document.getElementById("diff-meta");
    const lastUpdated = document.getElementById("last-updated");

    if (diffMeta) {
      diffMeta.textContent = "Unable to load latest leaderboard data.";
    }

    if (lastUpdated) {
      lastUpdated.textContent = "Unavailable";
    }
  }
}

async function scheduleRefresh() {
  clearTimeout(refreshTimeoutId);
  refreshTimeoutId = window.setTimeout(async () => {
    await loadLeaderboard();
    await scheduleRefresh();
  }, 60000);
}
