# ChatGPT CSV Interaction Tool

A script that logs into ChatGPT, enters user-provided prompts, retrieves responses, and saves all interactions as CSV files.

## Features

- Automates interaction with ChatGPT web interface
- Uses human-like interaction patterns to avoid detection
- Supports initial prompt and follow-up interactions
- Saves all responses in CSV format
- Provides a simple web interface for user input
- Uses Express.js for backend and Playwright for automation
- Handles CAPTCHA challenges automatically or manually
- Robust error handling with screenshots for troubleshooting

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- (Optional) 2Captcha API key for automatic CAPTCHA solving

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/chatgpt-csv-script.git
   cd chatgpt-csv-script
   ```

2. Install dependencies:
   ```bash
   npm install
   npm install 2captcha # Optional, for automatic CAPTCHA solving
   ```

3. Install Playwright browsers:
   ```bash
   npx playwright install chromium
   ```

4. (Optional) Set up automatic CAPTCHA solving:
   ```bash
   cp .env.example .env
   # Edit .env file to add your 2Captcha API key
   ```

## Usage

1. Start the server:
   ```bash
   npm start
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

3. Enter your ChatGPT credentials (email and password), along with the initial prompt and optional reply prompt.

4. Click "Submit" to initiate the interaction.

5. The application will:
   - Log into ChatGPT with provided credentials using human-like behavior
   - Submit your initial prompt with natural typing patterns
   - Retrieve and display the ChatGPT response
   - Save the response to a CSV file
   - If a reply prompt is provided, submit it and save the reply as well

6. All CSV files are saved in the `outputs` directory.

## CAPTCHA Handling Options

This application provides multiple methods for handling CAPTCHAs:

### 1. RektCaptcha Audio Solving (New)

This is a free solution that uses audio recognition to solve CAPTCHAs:

1. When enabled, the application will:
   - Click the audio challenge button on CloudFlare CAPTCHAs
   - Download and process the audio using speech recognition
   - Automatically enter the transcribed text

To use RektCaptcha:
- Install the optional package: `npm install @mihnea.dev/recaptcha-solver`
- Select the "Use RektCaptcha for CAPTCHA solving" option in the Advanced Settings
- No API key is required for this method

Note: This method requires speakers/audio capabilities and may not work on all CAPTCHAs.

### 2. Automatic CAPTCHA Solving with 2Captcha (Optional)

You can enable automatic solving of CloudFlare CAPTCHAs using the 2Captcha service:

1. Sign up for a 2Captcha account at https://2captcha.com/
2. Add funds to your account (solving CAPTCHAs costs around $2.99 per 1000 solves)
3. Copy your API key from your 2Captcha dashboard
4. Add your API key to the `.env` file:

```
CAPTCHA_API_KEY=your_api_key_here
```

With this setup, the application will automatically attempt to solve CAPTCHAs. If the automatic solving fails, it will fall back to manual solving.

### 3. Manual CAPTCHA Solving (Default Fallback)

If automatic solving is not configured or fails, the application will:

1. Display the browser window when a CAPTCHA appears
2. Wait for you to manually solve the CAPTCHA in the browser
3. Automatically continue once the CAPTCHA is solved
4. Provide a 5-minute timeout for solving

## Human-like Interaction Features

This application uses several techniques to mimic human behavior:

1. **Natural typing patterns** - Variable typing speed with occasional pauses
2. **Random mouse movements** - Realistic cursor movement throughout the page
3. **Timing variations** - Random delays between actions to appear more human
4. **Browser fingerprint masking** - Prevents detection as an automated tool
5. **Error recovery** - Multiple retry attempts with different strategies

These features help avoid detection by anti-bot systems while maintaining automation functionality.

## Error Handling

The application includes robust error handling:

1. Screenshots are automatically captured when errors occur
2. Multiple selector strategies are attempted before failing
3. Automatic retries for login page navigation
4. Detailed console output for troubleshooting
5. Graceful session termination when issues can't be resolved

## Important Notes

- For security reasons, your credentials are not stored and are only used for the current session.
- The browser automation runs in non-headless mode (visible browser) to allow for CAPTCHA solving.
- The automation may break if ChatGPT updates its UI. Check for updates to this script if you encounter issues.
- Using automated CAPTCHA solving may be against OpenAI's terms of service. Use at your own discretion.

## Files and Structure

- `index.js`: Express server and main application file
- `chatgpt-service.js`: Playwright automation for ChatGPT interaction
- `public/index.html`: Web interface for user input
- `outputs/`: Directory where CSV files are saved (includes error screenshots)
- `.env`: Configuration file for API keys and settings (create from .env.example)

## Security Considerations

This tool handles sensitive login credentials. Consider implementing the following for production use:

- Use environment variables for sensitive information
- Implement proper error handling and logging
- Add rate limiting to prevent abuse
- Add HTTPS for secure communication

## Code Attribution

This project was developed from scratch with the following references:

- Playwright documentation for web automation techniques
- Express.js documentation for server setup
- csv-writer documentation for CSV generation
- Bootstrap documentation for UI design
- 2Captcha API documentation for CAPTCHA solving integration

## License

ISC 