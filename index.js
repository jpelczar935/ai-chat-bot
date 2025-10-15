const express = require('express');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'secretkey';

app.use(express.json());
app.use(express.static('public'));

// Helper functions
function readUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  const data = fs.readFileSync(USERS_FILE);
  return JSON.parse(data);
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Signup
app.post('/signup', (req, res) => {
  const { username, password } = req.body;
  const users = readUsers();

  if (users.find(u => u.username === username)) {
    return res.status(400).json({ message: 'User already exists' });
  }

  const hashed = bcrypt.hashSync(password, 8);
  const newUser = { username, password: hashed, messages: [] };
  users.push(newUser);
  writeUsers(users);
  res.json({ message: 'Signup successful!' });
});

// Login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const users = readUsers();
  const user = users.find(u => u.username === username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ message: 'Welcome!', token });
});

// Verify token middleware
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'Missing token' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.username = decoded.username;
    next();
  } catch (err) {
    res.status(403).json({ message: 'Invalid token' });
  }
}

// Chat route (fake AI)
app.post('/chat', verifyToken, (req, res) => {
  const { message } = req.body;
  const users = readUsers();
  const user = users.find(u => u.username === req.username);

  if (!user) return res.status(404).json({ message: 'User not found' });

  const reply = `🤖 AI says: I heard you say "${message}"`;
  user.messages.push({ sender: 'user', text: message });
  user.messages.push({ sender: 'bot', text: reply });
  writeUsers(users);

  res.json({ reply });
});

// Get chat history
app.get('/messages', verifyToken, (req, res) => {
  const users = readUsers();
  const user = users.find(u => u.username === req.username);
  if (!user) return res.status(404).json({ message: 'User not found' });

  res.json(user.messages);
});

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
