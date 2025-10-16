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

    // ✅ Show miles section after login
    document.getElementById('miles-section').style.display = 'block';
    loadMiles(); // load total + history

    // ✅ load messages after login
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

// ✅ FIXED: Load messages correctly
async function loadMessages() {
  const res = await fetch('/messages', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!res.ok) {
    console.error('Failed to load messages');
    return;
  }

  const data = await res.json(); // backend sends { messages: [...] }

  document.getElementById('chat-box').innerHTML = '';
  data.messages.forEach(m => appendMessage(
    m.sender === 'user' ? 'You' : 'Bot',
    m.text
  ));
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
  document.getElementById('miles-section').style.display = 'none';
});

// ==============================
// ✅ MILES TRACKER FEATURE BELOW
// ==============================

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
