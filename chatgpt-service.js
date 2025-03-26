const { chromium } = require('playwright');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');

// Ensure the outputs directory exists
const outputDir = path.join(__dirname, 'outputs');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

/**
 * Interacts with ChatGPT using provided credentials and prompts
 * @param {string} email - ChatGPT account email
 * @param {string} password - ChatGPT account password
 * @param {string} initialPrompt - First prompt to send to ChatGPT
 * @param {string} replyPrompt - Follow-up prompt to send after getting initial response
 * @returns {Object} - Results with initial and reply responses, and paths to CSV files
 */
async function chatGPTInteraction(email, password, initialPrompt, replyPrompt) {
  const browser = await chromium.launch({ headless: false }); // Set to true in production
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('Navigating to ChatGPT login page...');
    await page.goto('https://chat.openai.com/auth/login');
    
    // Wait for and click the Log in button
    await page.waitForSelector('button:has-text("Log in")');
    await page.click('button:has-text("Log in")');
    
    // Handle the login process
    console.log('Logging in...');
    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    await page.fill('input[name="username"]', email);
    await page.click('button[type="submit"]'); // Continue after email
    
    // Wait for password field and submit
    await page.waitForSelector('input[name="password"]', { timeout: 10000 });
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    
    // Wait for chat interface to load
    console.log('Waiting for ChatGPT interface to load...');
    await page.waitForSelector('textarea[data-id="root"]', { timeout: 30000 });
    
    // Input the initial prompt
    console.log('Sending initial prompt...');
    await page.fill('textarea[data-id="root"]', initialPrompt);
    await page.press('textarea[data-id="root"]', 'Enter');
    
    // Wait for response
    console.log('Waiting for ChatGPT response...');
    // This selector targets the last response message from ChatGPT
    await page.waitForSelector('.markdown', { timeout: 60000 });
    
    // Wait for typing to finish
    await page.waitForFunction(() => {
      const elements = document.querySelectorAll('.result-streaming');
      return elements.length === 0;
    }, { timeout: 60000 });
    
    // Get the initial response
    const initialResponse = await page.evaluate(() => {
      const elements = document.querySelectorAll('.markdown');
      return elements[elements.length - 1].innerText;
    });
    
    // Save initial response to CSV
    const initialCsvPath = await saveResponseToCsv('initial', initialPrompt, initialResponse);
    
    let replyResponse = null;
    let replyCsvPath = null;
    
    // If a reply prompt was provided, send it
    if (replyPrompt) {
      console.log('Sending reply prompt...');
      await page.fill('textarea[data-id="root"]', replyPrompt);
      await page.press('textarea[data-id="root"]', 'Enter');
      
      // Wait for the reply
      console.log('Waiting for ChatGPT reply...');
      // Wait for new response to appear
      await page.waitForFunction(() => {
        const elements = document.querySelectorAll('.markdown');
        return elements.length > document.querySelectorAll('.request-message').length;
      }, { timeout: 60000 });
      
      // Wait for typing to finish
      await page.waitForFunction(() => {
        const elements = document.querySelectorAll('.result-streaming');
        return elements.length === 0;
      }, { timeout: 60000 });
      
      // Get the reply response
      replyResponse = await page.evaluate(() => {
        const elements = document.querySelectorAll('.markdown');
        return elements[elements.length - 1].innerText;
      });
      
      // Save reply response to CSV
      replyCsvPath = await saveResponseToCsv('reply', replyPrompt, replyResponse);
    }
    
    // Wait a bit before closing to ensure everything is saved
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      success: true,
      initialResponse,
      replyResponse,
      initialCsvPath,
      replyCsvPath
    };
    
  } catch (error) {
    console.error('Error in ChatGPT interaction:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

/**
 * Saves a response to a CSV file
 * @param {string} type - Type of response (initial or reply)
 * @param {string} prompt - The prompt that was sent
 * @param {string} response - The response from ChatGPT
 * @returns {string} - Path to the CSV file
 */
async function saveResponseToCsv(type, prompt, response) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(outputDir, `chatgpt-${type}-response-${timestamp}.csv`);
  
  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: 'prompt', title: 'Prompt' },
      { id: 'response', title: 'Response' },
      { id: 'timestamp', title: 'Timestamp' }
    ]
  });
  
  await csvWriter.writeRecords([
    {
      prompt: prompt,
      response: response,
      timestamp: new Date().toISOString()
    }
  ]);
  
  console.log(`Saved ${type} response to ${filePath}`);
  return filePath;
}

module.exports = {
  chatGPTInteraction
}; 