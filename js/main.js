const DATA_PATH = "./data/leaderboard.json";
const TEAM_ORDER = ["7th Grade", "8th Grade"];
const TEAM_COLORS = {
  "7th Grade": { solid: "#27c6ff", soft: "rgba(39, 198, 255, 0.18)" },
  "8th Grade": { solid: "#ff8d3b", soft: "rgba(255, 141, 59, 0.18)" }
};

let leaderboardChart;

const formatNumber = (value) => new Intl.NumberFormat("en-US").format(value);

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

  const tick = (now) => {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const currentValue = Math.round(startValue + (nextValue - startValue) * eased);
    element.textContent = formatNumber(currentValue);

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      element.dataset.value = String(nextValue);
    }
  };

  requestAnimationFrame(tick);
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
    const rankElement = document.querySelector(`[data-rank-for="${grade}"]`);
    const cardElement = document.querySelector(`[data-team-card="${grade}"]`);
    const rank = teams.findIndex((entry) => entry.grade === grade) + 1;

    totalElement.dataset.value ??= "0";
    animateCounter(totalElement, team.totalPoints);
    rankElement.textContent = `#${rank}`;
    cardElement.classList.toggle("is-leading", grade === leader.grade);
  });

  const diffTotal = document.getElementById("diff-total");
  const diffMeta = document.getElementById("diff-meta");

  diffTotal.dataset.value ??= "0";
  animateCounter(diffTotal, differential);
  diffMeta.textContent = `${leader.grade} leads by ${formatNumber(differential)} points`;
}

function renderStatus(lastUpdated) {
  document.getElementById("last-updated").textContent = lastUpdated;
}

function renderStudentLeaderboard(entries) {
  const list = document.getElementById("student-leaderboard");
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
    rank.textContent = `#${index + 1}`;

    name.className = "student-name";
    name.textContent = entry.name;
    grade.textContent = entry.grade;
    details.append(name, grade);

    points.className = "student-points";
    points.textContent = formatNumber(entry.totalPoints);

    item.append(rank, details, points);
    list.appendChild(item);
  });
}

function renderChart(history) {
  const canvas = document.getElementById("history-chart");
  const labels = history.map((entry) => entry.day);
  const datasets = TEAM_ORDER.map((grade) => {
    const key = grade.startsWith("7th") ? "7th" : "8th";
    return {
      label: grade,
      data: history.map((entry) => entry[key]),
      borderColor: TEAM_COLORS[grade].solid,
      backgroundColor: TEAM_COLORS[grade].soft,
      pointBackgroundColor: TEAM_COLORS[grade].solid,
      pointBorderColor: "#ffffff",
      pointRadius: 4,
      pointHoverRadius: 6,
      pointBorderWidth: 2,
      borderWidth: 4,
      tension: 0.35,
      fill: false
    };
  });

  if (leaderboardChart) {
    leaderboardChart.destroy();
  }

  leaderboardChart = new window.Chart(canvas, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 1400,
        easing: "easeOutQuart"
      },
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          labels: { color: "#f7fbff", usePointStyle: true, boxWidth: 10 }
        },
        tooltip: {
          callbacks: {
            label(context) {
              return `${context.dataset.label}: ${formatNumber(context.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: "#d7e5f4" },
          grid: { color: "rgba(255, 255, 255, 0.08)" }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: "#d7e5f4",
            callback(value) {
              return formatNumber(value);
            }
          },
          grid: { color: "rgba(255, 255, 255, 0.08)" }
        }
      }
    }
  });
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
    renderStudentLeaderboard(data.leaderboard);
    renderStatus(data.lastUpdated);
  } catch (error) {
    console.error(error);
    document.getElementById("diff-meta").textContent = "Unable to load latest leaderboard data.";
    document.getElementById("last-updated").textContent = "Unavailable";
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  if (typeof window.Chart === "undefined") {
    window.addEventListener("load", loadLeaderboard, { once: true });
    return;
  }

  await loadLeaderboard();
  window.setInterval(loadLeaderboard, 60000);
});
