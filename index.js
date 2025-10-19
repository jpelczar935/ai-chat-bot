// index.js (CommonJS) - supports local auth + optional Firebase token exchange
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

let admin = null;

try {
  const firebaseAdmin = require("firebase-admin");
  let serviceAccount = null;

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Load from environment variable (Render)
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log("Loaded Firebase Admin from environment variable.");
  } else if (fs.existsSync(path.join(__dirname, "serviceAccountKey.json"))) {
    // Fallback for local testing
    serviceAccount = require(path.join(__dirname, "serviceAccountKey.json"));
    console.log("Loaded Firebase Admin from local serviceAccountKey.json file.");
  }

  if (serviceAccount) {
    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(serviceAccount),
    });
    admin = firebaseAdmin;
    console.log("Firebase Admin initialized successfully.");
  } else {
    console.warn("No Firebase credentials found — Firebase login disabled.");
  }
} catch (err) {
  console.error("Failed to initialize Firebase Admin:", err.message);
}


// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ===== Utility functions for reading/writing users.json =====
const usersFile = path.join(__dirname, "data", "users.json");

function ensureUsersFile() {
  if (!fs.existsSync(usersFile)) {
    fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });
    fs.writeFileSync(usersFile, "[]");
  }
}

function readUsers() {
  ensureUsersFile();
  try {
    const data = fs.readFileSync(usersFile, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("readUsers error:", err);
    return [];
  }
}

function writeUsers(users) {
  try {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error("writeUsers error:", err);
  }
}

// ===== JWT Auth Middleware =====
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user; // { username: ... }
    next();
  });
}

// ===== Routes =====

// Signup (local)
app.post("/signup", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: "Missing username or password" });

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

// Login (local)
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

// Firebase ID token exchange -> issue local JWT
app.post("/firebase-login", async (req, res) => {
  if (!admin) return res.status(500).json({ message: "Firebase Admin not configured on server" });

  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ message: "Missing idToken" });

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const email = decoded.email; // use email as username in local store
    if (!email) return res.status(400).json({ message: "Firebase token missing email" });

    const users = readUsers();
    let user = users.find((u) => u.username === email);
    if (!user) {
      user = { username: email, password: null, messages: [], milesHistory: [] };
      users.push(user);
      writeUsers(users);
    }

    const token = jwt.sign({ username: email }, JWT_SECRET, { expiresIn: "1h" });
    res.json({ message: "Firebase login OK", token });
  } catch (err) {
    console.error("verifyIdToken error:", err);
    res.status(401).json({ message: "Invalid or expired Firebase token" });
  }
});

// Chat endpoint (simple fake reply)
app.post("/chat", authenticateToken, (req, res) => {
  const { message } = req.body;
  const { username } = req.user;
  const users = readUsers();
  const user = users.find((u) => u.username === username);

  if (!user) return res.status(404).json({ message: "User not found" });

  const userMsg = { sender: "user", text: message, time: new Date().toISOString() };
  const botMsg = { sender: "bot", text: `LOG YOUR MILES BELOW`, time: new Date().toISOString() };

  if (!user.messages) user.messages = [];
  user.messages.push(userMsg, botMsg);
  writeUsers(users);

  res.json({ reply: botMsg.text });
});

// Get all messages for logged-in user
app.get("/messages", authenticateToken, (req, res) => {
  const { username } = req.user;
  const users = readUsers();
  const user = users.find((u) => u.username === username);

  if (!user) return res.status(404).json({ messages: [] });

  res.json({ messages: user.messages || [] });
});

// Save miles (per user)
app.post("/log-miles", authenticateToken, (req, res) => {
  const { miles } = req.body;
  const { username } = req.user;

  if (miles == null) return res.status(400).json({ success: false, message: "Missing miles" });

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

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
