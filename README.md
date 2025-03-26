# ChatGPT CSV Interaction Tool

A script that logs into ChatGPT, enters user-provided prompts, retrieves responses, and saves all interactions as CSV files.

## Features

- Automates interaction with ChatGPT web interface
- Supports initial prompt and follow-up interactions
- Saves all responses in CSV format
- Provides a simple web interface for user input
- Uses Express.js for backend and Playwright for automation

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/chatgpt-csv-script.git
   cd chatgpt-csv-script
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Install Playwright browsers:
   ```bash
   npx playwright install chromium
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
   - Log into ChatGPT with provided credentials
   - Submit your initial prompt
   - Retrieve and display the ChatGPT response
   - Save the response to a CSV file
   - If a reply prompt is provided, submit it and save the reply as well

6. All CSV files are saved in the `outputs` directory.

## Important Notes

- For security reasons, your credentials are not stored and are only used for the current session.
- By default, the browser automation runs in non-headless mode (visible browser) for debugging purposes. For production use, modify the `headless` option to `true` in the `chatgpt-service.js` file.
- The automation may break if ChatGPT updates its UI. Check for updates to this script if you encounter issues.

## Files and Structure

- `index.js`: Express server and main application file
- `chatgpt-service.js`: Playwright automation for ChatGPT interaction
- `public/index.html`: Web interface for user input
- `outputs/`: Directory where CSV files are saved

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

## License

ISC 