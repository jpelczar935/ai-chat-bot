let token = '';

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
    loadMessages();
  }
});

// Send chat message
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

  const messages = await res.json();
  document.getElementById('chat-box').innerHTML = '';
  messages.forEach(m => appendMessage(m.sender === 'user' ? 'You' : 'Bot', m.text));
}

// Append message to chat box
function appendMessage(sender, text) {
  const chatBox = document.getElementById('chat-box');
  const div = document.createElement('div');
  div.innerHTML = `<b>${sender}:</b> ${text}`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Logout
document.getElementById('logout-btn').addEventListener('click', () => {
  token = '';
  document.getElementById('chat-section').style.display = 'none';
  document.getElementById('auth-section').style.display = 'block';
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('chat-box').innerHTML = '';
});
