const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { chatGPTInteraction } = require('./chatgpt-service');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/chat', async (req, res) => {
  try {
    const { email, password, initialPrompt, replyPrompt } = req.body;
    
    if (!email || !password || !initialPrompt) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await chatGPTInteraction(email, password, initialPrompt, replyPrompt);
    res.json(result);
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    res.status(500).json({ error: error.message || 'An error occurred during the ChatGPT interaction' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
}); 