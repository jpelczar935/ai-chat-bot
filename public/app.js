// public/app.js
let token = '';

// ======================
// Firebase setup (compat)
// ======================
const firebaseConfig = {
  apiKey: "AIzaSyCPeZKKI6yzW8a2oRIY-RQNOSv9WJiuNYU",
  authDomain: "ai-chat-bot-9f956.firebaseapp.com",
  projectId: "ai-chat-bot-9f956",
  storageBucket: "ai-chat-bot-9f956.firebasestorage.app",
  messagingSenderId: "492514737497",
  appId: "1:492514737497:web:e6d87f879b6411b6dfa048",
  measurementId: "G-1RLJ1Q8VGF"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();

// Helper to show messages
function showFBMessage(msg) {
  const el = document.getElementById('fb-msg');
  if (el) el.innerText = msg;
}

// ======================
// Firebase auth buttons
// ======================
document.getElementById('fb-login-btn').addEventListener('click', async () => {
  const email = document.getElementById('fb-email').value;
  const password = document.getElementById('fb-password').value;
  try {
    await auth.signInWithEmailAndPassword(email, password);
    // onAuthStateChanged handles the rest
  } catch (err) {
    console.error(err);
    showFBMessage(err.message || 'Firebase login failed');
  }
});

document.getElementById('fb-register-btn').addEventListener('click', async () => {
  const email = document.getElementById('fb-email').value;
  const password = document.getElementById('fb-password').value;
  try {
    await auth.createUserWithEmailAndPassword(email, password);
    showFBMessage('Firebase registration successful — logged in.');
  } catch (err) {
    console.error(err);
    showFBMessage(err.message || 'Firebase register failed');
  }
});

// Listen for Firebase auth state changes
auth.onAuthStateChanged(async (user) => {
  if (user) {
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/firebase-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        token = data.token;
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('chat-section').style.display = 'block';
        document.getElementById('miles-section').style.display = 'block';
        loadMessages();
        loadMiles();
        showFBMessage('');
      } else {
        showFBMessage(data.message || 'Server rejected Firebase token');
      }
    } catch (err) {
      console.error('Token exchange failed', err);
      showFBMessage('Token exchange failed');
    }
  } else {
    // Logged out
    token = '';
    document.getElementById('auth-section').style.display = 'block';
    document.getElementById('chat-section').style.display = 'none';
    document.getElementById('miles-section').style.display = 'none';
  }
});

// ======================
// Local auth (username/password)
// ======================

// Signup
document.getElementById('signup-btn').addEventListener('click', async () => {
  const username = document.getElementById('signup-username').value;
  const password = document.getElementById('signup-password').value;

  const res = await fetch('/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();
  document.getElementById('signup-msg').innerText = data.message;
});

// Login
document.getElementById('login-btn').addEventListener('click', async () => {
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;

  const res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();
  document.getElementById('login-msg').innerText = data.message;

  if (res.ok) {
    token = data.token;
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('chat-section').style.display = 'block';
    document.getElementById('miles-section').style.display = 'block';
    loadMessages();
    loadMiles();
  }
});

// Logout
document.getElementById('logout-btn').addEventListener('click', () => {
  if (auth.currentUser) {
    auth.signOut().catch(err => console.warn('Firebase signOut:', err));
  }
  token = '';
  document.getElementById('chat-section').style.display = 'none';
  document.getElementById('auth-section').style.display = 'block';
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('chat-box').innerHTML = '';
  document.getElementById('miles-section').style.display = 'none';
});

// ======================
// Chat feature
// ======================
document.getElementById('send-btn').addEventListener('click', async () => {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;

  const res = await fetch('/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ message })
  });

  const data = await res.json();
  input.value = '';
  appendMessage('You', message);
  appendMessage('Bot', data.reply);
});

// Load messages
async function loadMessages() {
  const res = await fetch('/messages', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!res.ok) {
    console.error('Failed to load messages', await res.text());
    return;
  }

  const data = await res.json();
  const chatBox = document.getElementById('chat-box');
  chatBox.innerHTML = '';
  data.messages.forEach(m => appendMessage(
    m.sender === 'user' ? 'You' : 'Bot',
    m.text
  ));
}

function appendMessage(sender, text) {
  const chatBox = document.getElementById('chat-box');
  const div = document.createElement('div');
  div.innerHTML = `<b>${sender}:</b> ${text}`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// ======================
// Miles tracker
// ======================
document.getElementById('log-miles-btn').addEventListener('click', async () => {
  const miles = parseFloat(document.getElementById('miles-input').value);
  if (isNaN(miles) || miles <= 0) {
    alert("Please enter a valid number of miles!");
    return;
  }

  const response = await fetch('/log-miles', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` 
    },
    body: JSON.stringify({ miles })
  });

  const data = await response.json();
  if (data.success) {
    document.getElementById('miles-input').value = '';
    loadMiles();
  } else {
    alert("Error saving miles");
  }
});

async function loadMiles() {
  const response = await fetch('/get-miles', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const data = await response.json();

  if (data.success) {
    document.getElementById('total-miles').innerText = `Total miles: ${data.total}`;
    const list = document.getElementById('miles-history');
    list.innerHTML = '';
    data.history.forEach(entry => {
      const li = document.createElement('li');
      li.textContent = `${entry.date}: ${entry.miles} miles`;
      list.appendChild(li);
    });
  }
}

