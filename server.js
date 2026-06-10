const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const DATA_FILE = path.join(__dirname, 'data.json');

// Load data
let data = {
  matches: [],
  predictions: {}, // { matchId: { user: {home, away} } }
  users: {}
};

if (fs.existsSync(DATA_FILE)) {
  data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
} else {
  // Default matches
  data.matches = [
    { id: 1, home: "Франция", away: "Германия", date: "15.06.2026", group: "A", homeScore: null, awayScore: null },
    { id: 2, home: "Бразилия", away: "Аргентина", date: "16.06.2026", group: "B", homeScore: null, awayScore: null },
  ];
  saveData();
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Get all matches
app.get('/matches', (req, res) => {
  res.json(data.matches);
});

// Add new match
app.post('/matches', (req, res) => {
  const newMatch = {
    id: Date.now(),
    ...req.body,
    homeScore: null,
    awayScore: null
  };
  data.matches.push(newMatch);
  saveData();
  res.json(newMatch);
});

// Get predictions for a user
app.get('/predictions/:user', (req, res) => {
  const user = req.params.user;
  const userPreds = {};
  Object.keys(data.predictions).forEach(matchId => {
    if (data.predictions[matchId][user]) {
      userPreds[matchId] = data.predictions[matchId][user];
    }
  });
  res.json(userPreds);
});

// Save prediction
app.post('/predictions', (req, res) => {
  const { matchId, user, home, away } = req.body;
  if (!data.predictions[matchId]) data.predictions[matchId] = {};
  data.predictions[matchId][user] = { home, away };
  saveData();
  res.json({ success: true });
});

// Set real result
app.post('/matches/:id/result', (req, res) => {
  const id = parseInt(req.params.id);
  const match = data.matches.find(m => m.id === id);
  if (match) {
    match.homeScore = req.body.homeScore;
    match.awayScore = req.body.awayScore;
    saveData();
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Match not found" });
  }
});

// Get leaderboard
app.get('/leaderboard', (req, res) => {
  const leaderboard = {};
  
  Object.keys(data.predictions).forEach(matchId => {
    const match = data.matches.find(m => m.id === parseInt(matchId));
    if (!match || match.homeScore === null) return;
    
    Object.keys(data.predictions[matchId]).forEach(user => {
      if (!leaderboard[user]) {
        leaderboard[user] = { points: 0, exact: 0, diff: 0, draw: 0, outcome: 0 };
      }
      
      const pred = data.predictions[matchId][user];
      const points = calculatePoints(match, pred);
      if (points > 0) {
        leaderboard[user].points += points;
        if (points === 3.5) leaderboard[user].exact++;
        else if (points === 2) leaderboard[user].diff++;
        else if (points === 1.5) leaderboard[user].draw++;
        else if (points === 1) leaderboard[user].outcome++;
      }
    });
  });
  
  const sorted = Object.entries(leaderboard)
    .sort((a, b) => b[1].points - a[1].points)
    .map(([name, stats]) => ({ name, ...stats }));
  
  res.json(sorted);
});

function calculatePoints(match, pred) {
  const pHome = parseInt(pred.home);
  const pAway = parseInt(pred.away);
  const rHome = match.homeScore;
  const rAway = match.awayScore;

  if (pHome === rHome && pAway === rAway) return 3.5;
  if (Math.abs(pHome - pAway) === Math.abs(rHome - rAway)) return 2;
  if (pHome === pAway && rHome === rAway) return 1.5;
  
  const pWin = pHome > pAway ? 'h' : (pHome < pAway ? 'a' : 'd');
  const rWin = rHome > rAway ? 'h' : (rHome < rAway ? 'a' : 'd');
  if (pWin === rWin) return 1;
  
  return 0;
}

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
