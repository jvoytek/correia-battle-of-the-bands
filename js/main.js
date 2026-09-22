const DATA_PATH = "./data/leaderboard.json";
const TEAM_ORDER = ["7th Grade", "8th Grade"];
const TEAM_COLORS = {
  "7th Grade": { solid: "#1223b7", soft: "rgba(39, 198, 255, 0.18)" },
  "8th Grade": { solid: "#e10000", soft: "rgba(255, 141, 59, 0.18)" }
};

let chartHistory = [];
let chartAnimationFrame;
let refreshTimeoutId;
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

function drawEmptyChartState(ctx, canvas, message) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(Math.round(rect.width * dpr), 1);
  const height = Math.max(Math.round(rect.height * dpr), 1);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
  ctx.font = '600 16px Inter, "Segoe UI", Arial, sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(message, rect.width / 2, rect.height / 2);
}

function getRaceFrame(history, progress) {
  if (!history.length) {
    return { day: "Waiting", dayLabel: "Waiting", bars: [] };
  }

  if (history.length === 1) {
    return {
      day: history[0].day,
      dayLabel: formatDayLabel(history[0].day),
      bars: TEAM_ORDER.map((grade) => {
        const key = grade.startsWith("7th") ? "7th" : "8th";
        return { grade, value: history[0][key] ?? 0 };
      }).sort((left, right) => right.value - left.value)
    };
  }

  const scaledProgress = progress * (history.length - 1);
  const startIndex = Math.min(Math.floor(scaledProgress), history.length - 1);
  const endIndex = Math.min(startIndex + 1, history.length - 1);
  const frameProgress = Math.min(scaledProgress - startIndex, 1);
  const startEntry = history[startIndex];
  const endEntry = history[endIndex];

  return {
    day: endIndex === startIndex ? startEntry.day : endEntry.day,
    dayLabel: formatDayLabel(endIndex === startIndex ? startEntry.day : endEntry.day),
    bars: TEAM_ORDER.map((grade) => {
      const key = grade.startsWith("7th") ? "7th" : "8th";
      const startValue = startEntry[key] ?? 0;
      const endValue = endEntry[key] ?? startValue;

      return {
        grade,
        value: Math.round(startValue + (endValue - startValue) * frameProgress)
      };
    }).sort((left, right) => right.value - left.value)
  };
}

function drawRoundedBar(ctx, x, y, width, height, color) {
  const radius = Math.min(height / 2, 14, width / 2);

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawChartFrame(ctx, canvas, history, progress) {
  if (!history.length) {
    drawEmptyChartState(ctx, canvas, "Waiting for progress history");
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(Math.round(rect.width * dpr), 1);
  const height = Math.max(Math.round(rect.height * dpr), 1);
  const padding = { top: 24, right: 16, bottom: 38, left: 52 };

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  const cssWidth = rect.width;
  const cssHeight = rect.height;
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const chartWidth = cssWidth - padding.left - padding.right;
  const rowHeight = Math.min(72, (cssHeight - padding.top - padding.bottom) / TEAM_ORDER.length - 12);
  const rowGap = 18;
  const maxValue = Math.max(...history.flatMap((entry) => [entry["7th"], entry["8th"]]), 0);
  const raceFrame = getRaceFrame(history, progress);
  const safeMaxValue = Math.max(maxValue, 1);

  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.font = '12px Inter, "Segoe UI", Arial, sans-serif';
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  for (let step = 0; step <= 4; step += 1) {
    const tickValue = Math.round((safeMaxValue * step) / 4);
    const x = padding.left + (chartWidth * step) / 4;
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, cssHeight - padding.bottom);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.stroke();
    ctx.fillStyle = "#d7e5f4";
    ctx.fillText(formatNumber(tickValue), Math.min(x + 4, cssWidth - padding.right - 24), cssHeight - 12);
  }

  ctx.fillStyle = "rgba(247, 251, 255, 0.22)";
  ctx.font = '700 64px Inter, "Segoe UI", Arial, sans-serif';
  ctx.textAlign = "right";
  ctx.fillText(raceFrame.dayLabel, cssWidth - padding.right, padding.top + 18);

  ctx.textAlign = "left";
  raceFrame.bars.forEach((bar, index) => {
    const barTop = padding.top + 42 + index * (rowHeight + rowGap);
    const filledWidth = Math.max((bar.value / safeMaxValue) * chartWidth, rowHeight * 0.65);

    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    drawRoundedBar(ctx, padding.left, barTop, chartWidth, rowHeight, "rgba(255, 255, 255, 0.08)");
    drawRoundedBar(ctx, padding.left, barTop, filledWidth, rowHeight, TEAM_COLORS[bar.grade].solid);

    ctx.fillStyle = "#f7fbff";
    ctx.font = '700 20px Inter, "Segoe UI", Arial, sans-serif';
    ctx.fillText(bar.grade, padding.left + 14, barTop + rowHeight / 2);

    const valueLabel = formatNumber(bar.value);
    const valueLabelWidth = ctx.measureText(valueLabel).width;
    const valueFitsInsideBar = filledWidth > valueLabelWidth + 40;

    ctx.textAlign = "right";
    ctx.fillText(
      valueLabel,
      valueFitsInsideBar
        ? padding.left + filledWidth - 12
        : Math.min(padding.left + filledWidth + valueLabelWidth + 18, cssWidth - padding.right),
      barTop + rowHeight / 2
    );
    ctx.textAlign = "left";
  });
}

function renderChart(history) {
  const canvas = document.getElementById("history-chart");
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("History chart canvas is missing.");
  }
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context is unavailable.");
  }
  const duration = 1400;
  const start = performance.now();

  chartHistory = history;
  cancelAnimationFrame(chartAnimationFrame);

  if (!history.length) {
    drawEmptyChartState(context, canvas, "Waiting for progress history");
    return;
  }

  const animate = (timestamp) => {
    const progress = Math.min((timestamp - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    drawChartFrame(context, canvas, history, eased);

    if (progress < 1) {
      chartAnimationFrame = requestAnimationFrame(animate);
    }
  };

  chartAnimationFrame = requestAnimationFrame(animate);
}

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
    renderChart(data.history);
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

window.addEventListener("resize", () => {
  if (chartHistory.length) {
    const canvas = document.getElementById("history-chart");
    if (!(canvas instanceof HTMLCanvasElement)) {
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    drawChartFrame(context, canvas, chartHistory, 1);
  }
});

window.addEventListener("DOMContentLoaded", async () => {
  await loadLeaderboard();
  await scheduleRefresh();
});
