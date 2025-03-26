const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { chatGPTInteraction } = require('./services/chatgpt-service');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Print a welcome header to the console
function printWelcomeHeader() {
  console.log('\n' + '='.repeat(60));
  console.log(' ChatGPT CSV Interaction Tool - Session Started');
  console.log('='.repeat(60));
  console.log('\n👋 Welcome! The web interface is ready.');
  console.log('💻 Access the application at the URL shown below.\n');
  
  console.log('🔗 Running in direct access mode (no login required)');
  
  // Print CAPTCHA solving mode information
  if (process.env.CAPTCHA_API_KEY) {
    console.log('🔐 Automatic CAPTCHA solving is ENABLED using 2Captcha');
  } else {
    console.log('🔐 Automatic CAPTCHA solving is DISABLED (manual solving required)');
    console.log('   To enable auto-solving, add CAPTCHA_API_KEY in .env file');
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/chat', async (req, res) => {
  try {
    const { email, password, initialPrompt, replyPrompt, captchaApiKey, useRektCaptcha } = req.body;
    
    if (!initialPrompt) {
      return res.status(400).json({ error: 'Missing required prompt' });
    }

    console.log('\n📝 Starting a new ChatGPT conversation');
    console.log('🔄 Opening browser session... (this window will remain active)');
    console.log('🔗 Using direct access mode (no login required)');
    
    if (replyPrompt) {
      console.log('📩 Will send an initial prompt followed by a reply prompt');
    } else {
      console.log('📩 Will send a single prompt and capture the response');
    }
    
    // Use API key from environment variable or from request
    const apiKey = captchaApiKey || process.env.CAPTCHA_API_KEY || null;
    
    // Log CAPTCHA solving options
    if (useRektCaptcha) {
      console.log('🤖 Using RektCaptcha for automated CAPTCHA solving');
    } else if (apiKey) {
      console.log('🤖 Using 2Captcha for automated CAPTCHA solving');
    }
    
    // Start ChatGPT interaction
    const result = await chatGPTInteraction(email, password, initialPrompt, replyPrompt, apiKey, useRektCaptcha);
    
    // Send the final result
    res.json({
      success: true,
      ...result
    });
    
    console.log('✅ Conversation completed successfully');
    console.log('💾 Response saved to CSV in the outputs folder\n');
    
  } catch (error) {
    console.error('\n❌ Something went wrong during the conversation:');
    console.error(`   ${error.message}`);
    
    if (error.message.includes('timeout') || error.message.includes('navigation')) {
      console.log('\n💡 Tip: This might be due to internet connectivity or website changes.');
      console.log('   Try refreshing the page and starting again.\n');
    }
    
    res.status(500).json({ 
      error: error.message || 'An error occurred during the ChatGPT interaction',
      suggestion: 'If you encountered a CAPTCHA issue, try again and be ready to solve the CAPTCHA in the browser window.'
    });
  }
});

// Start server
app.listen(PORT, () => {
  printWelcomeHeader();
  console.log(`✨ Application URL: http://localhost:${PORT}`);
  console.log('\n📣 Important notes:');
  console.log('• If you see a verification challenge, it will be handled based on your settings');
  console.log('• Your login information is only used for the current session');
  console.log('• All responses are saved locally in the outputs folder\n');
}); 


// const express = require('express');
// const { chatGPTInteraction } = require('./chatgpt-service');
// const app = express();
// const port = 3000;

// app.use(express.json());
// app.use(express.static('public')); // Serve static files from 'public' directory

// app.post('/chat', async (req, res) => {
//   try {
//     const {
//       email,
//       password,
//       initialPrompt,
//       replyPrompt,
//       captchaApiKey,
//       useRektCaptcha
//     } = req.body;

//     const result = await chatGPTInteraction(
//       email,
//       password,
//       initialPrompt,
//       replyPrompt,
//       captchaApiKey,
//       useRektCaptcha
//     );

//     if (!result.success) {
//       throw new Error('ChatGPT interaction failed');
//     }

//     res.json({
//       success: true,
//       initialResponse: result.initialResponse,
//       replyResponse: result.replyResponse,
//       initialCsvPath: result.initialCsvPath,
//       replyCsvPath: result.replyCsvPath
//     });
//   } catch (error) {
//     console.error('Server error:', error);
//     res.status(500).json({
//       success: false,
//       error: error.message
//     });
//   }
// });

// app.listen(port, () => {
//   console.log(`Server running at http://localhost:${port}`);
// });