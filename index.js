// =======================
// index.js (CommonJS version)
// =======================

const express = require("express");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ===== Utility functions for reading/writing users.json =====
const usersFile = path.join(__dirname, "data", "users.json");

function readUsers() {
  try {
    const data = fs.readFileSync(usersFile, "utf8");
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

// ===== JWT Auth Middleware =====
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user; // save username from token
    next();
  });
}

// ===== Routes =====

// Signup
app.post("/signup", (req, res) => {
  const { username, password } = req.body;
  const users = readUsers();

  if (users.find((u) => u.username === username)) {
    return res.status(400).json({ message: "User already exists" });
  }

  const hashed = bcrypt.hashSync(password, 8);
  const newUser = { username, password: hashed, messages: [], milesHistory: [] };
  users.push(newUser);
  writeUsers(users);
  res.json({ message: "Signup successful!" });
});

// Login
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const users = readUsers();
  const user = users.find((u) => u.username === username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "1h" });
  res.json({ message: "Welcome!", token });
});

// Chat endpoint (simple fake reply)
app.post("/chat", authenticateToken, (req, res) => {
  const { message } = req.body;
  const { username } = req.user;
  const users = readUsers();
  const user = users.find((u) => u.username === username);

  if (!user) return res.status(404).json({ message: "User not found" });

  const userMsg = { sender: "user", text: message };
  const botMsg = { sender: "bot", text: `You said: "${message}"` };

  user.messages.push(userMsg, botMsg);
  writeUsers(users);

  res.json({ reply: botMsg.text });
});

// Get all messages
app.get("/messages", authenticateToken, (req, res) => {
  const { username } = req.user;
  const users = readUsers();
  const user = users.find((u) => u.username === username);

  if (!user) return res.status(404).json({ messages: [] });

  res.json({ messages: user.messages || [] });
});

// ===== New Routes for Miles Tracking =====

// Save miles
app.post("/log-miles", authenticateToken, (req, res) => {
  const { miles } = req.body;
  const { username } = req.user;

  const users = readUsers();
  const user = users.find((u) => u.username === username);

  if (!user) return res.status(404).json({ success: false, message: "User not found" });

  if (!user.milesHistory) user.milesHistory = [];

  const date = new Date().toLocaleDateString();
  user.milesHistory.push({ date, miles: Number(miles) });
  writeUsers(users);

  res.json({ success: true });
});

// Get total + history
app.get("/get-miles", authenticateToken, (req, res) => {
  const { username } = req.user;

  const users = readUsers();
  const user = users.find((u) => u.username === username);

  if (!user) return res.status(404).json({ success: false, message: "User not found" });

  const history = user.milesHistory || [];
  const total = history.reduce((sum, e) => sum + Number(e.miles), 0);

  res.json({ success: true, total, history });
});

// ====== Start Server ======
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
