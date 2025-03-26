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
 * Adds random delay to simulate human interaction
 * @param {number} min - Minimum delay in milliseconds
 * @param {number} max - Maximum delay in milliseconds
 * @returns {Promise<void>}
 */
async function humanDelay(min = 200, max = 500) {
    const delay = Math.floor(Math.random() * (max - min) + min);
    await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Generate a random string of specified length
 * @param {number} length - Length of the random string to generate
 * @returns {string} - Random alphanumeric string
 */
function randomString(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Makes random mouse movements to appear more human-like
 * @param {Page} page - Playwright page object
 * @returns {Promise<void>}
 */
async function randomMouseMovements(page) {
    // Get viewport size
    const viewportSize = page.viewportSize();
    if (!viewportSize) return;

    // Make 2-5 random mouse movements
    const movements = Math.floor(Math.random() * 3) + 2;

    for (let i = 0; i < movements; i++) {
        const x = Math.floor(Math.random() * viewportSize.width);
        const y = Math.floor(Math.random() * viewportSize.height);
        await page.mouse.move(x, y);
        await humanDelay(50, 150);
    }
}

/**
 * Types text like a human with variable speed
 * @param {Page} page - Playwright page object
 * @param {string} selector - Element selector to type into
 * @param {string} text - Text to type
 */
async function humanTyping(page, selector, text) {
    await page.click(selector);
    await humanDelay(100, 300);

    // Clear any existing text
    await page.fill(selector, '');
    await humanDelay(100, 300);

    // Type characters with variable speed
    for (const char of text) {
        await page.type(selector, char, { delay: Math.random() * 100 + 30 });

        // Occasionally pause for a longer time (like a human thinking)
        if (Math.random() > 0.9) {
            await humanDelay(300, 800);
        }
    }

    // Pause after typing is complete
    await humanDelay(200, 500);
}

/**
 * Safely clicks on an element using a selector
 * @param {Page} page - Playwright page object
 * @param {string} selector - Element selector to click
 * @returns {Promise<boolean>} - Whether the click was successful
 */
async function safeClick(page, selector) {
    try {
        await humanDelay(300, 800);

        // First check if element exists and is visible
        const element = await page.$(selector);
        if (!element) {
            console.log(`Element with selector "${selector}" not found`);
            return false;
        }

        // Check if element is visible
        const isVisible = await page.isVisible(selector);
        if (!isVisible) {
            console.log(`Element with selector "${selector}" is not visible`);
            return false;
        }

        // Do random mouse movement before clicking
        await randomMouseMovements(page);

        // Click the element
        await page.click(selector);
        console.log(`Successfully clicked element with selector: ${selector}`);
        return true;
    } catch (error) {
        console.log(`Error clicking element with selector "${selector}": ${error.message}`);
        return false;
    }
}


/**
 * Interacts with ChatGPT using provided credentials and prompts
 * @param {string} email - ChatGPT account email (not used in direct access mode)
 * @param {string} password - ChatGPT account password (not used in direct access mode)
 * @param {string} initialPrompt - First prompt to send to ChatGPT
 * @param {string} replyPrompt - Follow-up prompt to send after getting initial response
 * @param {string} captchaApiKey - 2Captcha API key for automated CAPTCHA solving
 * @param {boolean} useRektCaptcha - Whether to use RektCaptcha for CAPTCHA solving
 * @param {boolean} debug - Enable debug mode with more verbose logging and screenshots
 * @returns {Object} - Results with initial and reply responses, and paths to CSV files
 */
async function chatGPTInteraction(email, password, initialPrompt, replyPrompt, captchaApiKey = null, useRektCaptcha = false, debug = false) {
    // Set up debug directory if debugging is enabled
    const debugDir = path.join(outputDir, 'debug_' + new Date().toISOString().replace(/[:.]/g, '-'));
    if (debug && !fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
    }

    // Debug log function
    const debugLog = (message, data = null) => {
        if (debug) {
            const timestamp = new Date().toISOString();
            console.log(`[DEBUG ${timestamp}] ${message}`);

            if (data) {
                const logFile = path.join(debugDir, 'debug_log.txt');
                fs.appendFileSync(
                    logFile,
                    `[${timestamp}] ${message}\n${JSON.stringify(data, null, 2)}\n\n`,
                    { encoding: 'utf8' }
                );
            }
        } else {
            console.log(message);
        }
    };

    // Debug screenshot function
    const debugScreenshot = async (page, name) => {
        if (debug && page) {
            const screenshotPath = path.join(debugDir, `${name}_${Date.now()}.png`);
            await page.screenshot({ path: screenshotPath, fullPage: true });
            debugLog(`Screenshot saved: ${screenshotPath}`);

            // Also save the current HTML for inspection
            const htmlPath = path.join(debugDir, `${name}_${Date.now()}.html`);
            const html = await page.content();
            fs.writeFileSync(htmlPath, html, { encoding: 'utf8' });
            debugLog(`HTML saved: ${htmlPath}`);

            return screenshotPath;
        }
        return null;
    };

    // Visual debugging helper - highlight elements to see what's being detected
    const highlightElements = async (page, selector, color = 'red', duration = 2000) => {
        if (!debug) return;

        try {
            await page.evaluate((selector, color) => {
                const elements = document.querySelectorAll(selector);
                if (elements.length === 0) return false;

                elements.forEach(el => {
                    el._originalOutline = el.style.outline;
                    el._originalBoxShadow = el.style.boxShadow;
                    el.style.outline = `3px solid ${color}`;
                    el.style.boxShadow = `0 0 10px ${color}`;
                });

                return true;
            }, selector, color);

            await debugScreenshot(page, `highlighted_${selector.replace(/[^a-zA-Z0-9]/g, '_')}`);

            // Restore original styles after a delay
            setTimeout(async () => {
                await page.evaluate((selector) => {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(el => {
                        if (el._originalOutline !== undefined) {
                            el.style.outline = el._originalOutline;
                        }
                        if (el._originalBoxShadow !== undefined) {
                            el.style.boxShadow = el._originalBoxShadow;
                        }
                    });
                }, selector);
            }, duration);

        } catch (error) {
            debugLog(`Error highlighting elements: ${error.message}`);
        }
    };

    // Configure the browser to appear more like a regular user
    const browser = await chromium.launch({
        headless: false,
        executablePath: '/usr/bin/google-chrome', // Use your system's Chrome directly
        args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process,BlockInsecurePrivateNetworkRequests',
            '--no-sandbox',
            '--disable-web-security',
            '--disable-site-isolation-trials',
            '--ignore-certificate-errors',
            '--window-size=1920,1080',
            '--start-maximized',
            '--disable-extensions',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            // '--no-first-run',
            '--no-default-browser-check',
            '--disable-infobars',
            '--disable-notifications',
            '--disable-translate',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-breakpad',
            '--disable-component-extensions-with-background-pages',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            '--allow-running-insecure-content',
            // '--hide-scrollbars',
            '--metrics-recording-only',
            // '--mute-audio',
            '--js-flags=--expose-gc',
            // Additional arguments to improve JavaScript and cookie handling
            '--enable-javascript',
            '--enable-cookies',
            '--disable-blink-settings=imagesEnabled=false',
            '--disable-popup-blocking',
            // Improved memory handling
            '--js-flags="--max-old-space-size=8192"'
        ]
    });

    // Generate a more realistic user profile
    const randomUserAgent = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
    ][Math.floor(Math.random() * 6)];

    // Random timezones for more variety
    const timezones = ['America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo',];
    const randomTimezone = timezones[Math.floor(Math.random() * timezones.length)];

    // Set up a more realistic browser context with randomized properties
    const context = await browser.newContext({
        userAgent: randomUserAgent,
        viewport: { width: 420, height: 1080 },
        deviceScaleFactor: 1,
        hasTouch: false,
        locale: 'en-US',
        timezoneId: randomTimezone,
        javaScriptEnabled: true,
        bypassCSP: true,
        permissions: ['geolocation', 'notifications'],
        colorScheme: 'light',
        reducedMotion: 'no-preference',
        forcedColors: 'none',
        acceptDownloads: true,
        ignoreHTTPSErrors: true,
        extraHTTPHeaders: {
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'sec-ch-ua': '"Google Chrome";v="124", "Chromium";v="124", "Not-A.Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'DNT': '1',
            'Cache-Control': 'max-age=0',
            'Connection': 'keep-alive'
        },
        storageState: {
            cookies: [],
            origins: [
                {
                    origin: 'https://chat.openai.com',
                    localStorage: [
                        { name: 'oai_auth_method', value: 'password' },
                        { name: 'cf_clearance', value: 'random_value_' + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) }
                    ]
                }
            ]
        }
    });

    // Set up geolocation permissions and cookies with more randomized patterns
    const cookieExpiryDate = new Date();
    cookieExpiryDate.setDate(cookieExpiryDate.getDate() + 30);

    // Create more realistic cookies that help bypass the JavaScript/cookies check
    await context.addCookies([
        {
            name: 'bot_detection_bypassed',
            value: 'true',
            domain: '.openai.com',
            path: '/',
            expires: cookieExpiryDate.getTime() / 1000,
            httpOnly: false,
            secure: true,
            sameSite: 'None'
        },
        {
            name: 'oai_auth_method',
            value: 'password',
            domain: '.openai.com',
            path: '/',
            expires: cookieExpiryDate.getTime() / 1000,
            httpOnly: false,
            secure: true,
            sameSite: 'None'
        },
        {
            name: 'cf_clearance',
            value: 'random_value_' + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2),
            domain: '.openai.com',
            path: '/',
            expires: cookieExpiryDate.getTime() / 1000,
            httpOnly: true,
            secure: true,
            sameSite: 'None'
        },
        {
            name: '__Secure-next-auth.callback-url',
            value: 'https://chat.openai.com/',
            domain: '.openai.com',
            path: '/',
            secure: true,
            sameSite: 'None',
            expires: cookieExpiryDate.getTime() / 1000
        },
        // Add cookies that indicate JavaScript is enabled
        {
            name: 'js_enabled',
            value: 'true',
            domain: '.openai.com',
            path: '/',
            secure: true,
            expires: cookieExpiryDate.getTime() / 1000
        },
        // CloudFlare cookies
        {
            name: '__cf_bm',
            value: randomString(50),
            domain: '.openai.com',
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'None',
            expires: (Date.now() / 1000) + 7200 // 2 hours from now
        },
        {
            name: '_cfuvid',
            value: randomString(32),
            domain: '.openai.com',
            path: '/',
            httpOnly: true,
            secure: true,
            expires: cookieExpiryDate.getTime() / 1000
        },
        // Session tracking
        {
            name: '_ga',
            value: 'GA1.1.' + Math.floor(Math.random() * 1000000000) + '.' + Math.floor(Math.random() * 1000000000),
            domain: '.openai.com',
            path: '/',
            expires: (Date.now() / 1000) + 2 * 365 * 24 * 60 * 60 // 2 years
        },
        {
            name: '_ga_' + randomString(10).toUpperCase(),
            value: 'GS1.1.' + Date.now() + '.1.1.' + Date.now(),
            domain: '.openai.com',
            path: '/',
            expires: (Date.now() / 1000) + 2 * 365 * 24 * 60 * 60 // 2 years
        }
    ]);

    const page = await context.newPage();

    // Enhanced browser fingerprinting evasion via injection of script
    await page.addInitScript(() => {
        // Override automation detection properties
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
            configurable: true
        });

        // Mask automation-detectable properties
        Object.defineProperty(navigator, 'maxTouchPoints', {
            get: () => 5
        });

        Object.defineProperty(navigator, 'hardwareConcurrency', {
            get: () => 8
        });

        // Override device memory to appear realistic
        Object.defineProperty(navigator, 'deviceMemory', {
            get: () => 8
        });

        // Add specific cookie-related overrides to bypass "Enable JavaScript and cookies" error
        // Spoof cookieEnabled property to always return true
        Object.defineProperty(navigator, 'cookieEnabled', {
            get: () => true
        });

        // Intercept cookie-related APIs and ensure they return expected values
        document.__defineGetter__('cookie', function () {
            return document.cookie || 'cf_clearance=1; _ga=1; js_enabled=true';
        });

        document.__defineSetter__('cookie', function (val) {
            document.cookie = val;
            return true;
        });

        // Override document.hasFocus() to always return true
        const originalHasFocus = document.hasFocus;
        document.hasFocus = function () {
            return true;
        };

        // Override document hidden property
        Object.defineProperty(document, 'hidden', {
            get: () => false
        });

        // Override document visibility state
        Object.defineProperty(document, 'visibilityState', {
            get: () => 'visible'
        });

        // Add Chrome properties
        window.chrome = {
            runtime: {
                connect: () => ({
                    onMessage: {
                        addListener: () => { },
                        removeListener: () => { }
                    },
                    postMessage: () => { },
                    disconnect: () => { }
                }),
                sendMessage: () => { },
                onMessage: {
                    addListener: () => { },
                    removeListener: () => { }
                },
                getPlatformInfo: (callback) => {
                    callback({ os: 'win' });
                },
                getManifest: () => ({
                    version: '124.0.0.0'
                })
            },
            webstore: {
                onInstallStageChanged: {
                    addListener: () => { }
                },
                onDownloadProgress: {
                    addListener: () => { }
                }
            },
            app: {
                isInstalled: false,
                getDetails: () => { },
                getIsInstalled: () => false,
                installState: () => { }
            },
            loadTimes: () => ({
                firstPaintTime: 0,
                firstPaintAfterLoadTime: 0,
                spdy: true,
                connectionInfo: 'h3',
                wasAlternateProtocolAvailable: true,
                wasFetchedViaSpdy: true,
                wasNpnNegotiated: true,
                npnNegotiatedProtocol: 'h3',
                wasAlternateProtocolAvailable: true,
                requestTime: Date.now() / 1000,
                startLoadTime: Date.now() / 1000,
                commitLoadTime: Date.now() / 1000,
                finishDocumentLoadTime: Date.now() / 1000,
                finishLoadTime: Date.now() / 1000,
                navigationType: 'Other'
            }),
            csi: () => ({
                startE: Date.now(),
                onloadT: Date.now() + 100,
                pageT: Date.now() + 200,
                tran: 15
            })
        };

        // Set languages and plugins
        window.navigator.languages = ['en-US', 'en', 'es'];

        // Add fake plugins
        const makePlugin = (name, filename, description) => ({
            name,
            description: description || name,
            filename,
            version: '1.0.0',
            length: 1
        });

        const plugins = [
            makePlugin('Chrome PDF Plugin', 'internal-pdf-viewer', 'Portable Document Format'),
            makePlugin('Chrome PDF Viewer', 'mhjfbmdgcfjbbpaeojofohoefgiehjai', 'Portable Document Format'),
            makePlugin('Native Client', 'internal-nacl-plugin', 'Native Client Executable'),
            makePlugin('Widevine Content Decryption Module', 'widevinecdmadapter.dll', 'Enables Widevine licenses for playback of HTML audio/video content.')
        ];

        // Define plugins property
        Object.defineProperty(navigator, 'plugins', {
            get: () => {
                const pluginArray = Object.create(Array.prototype);

                plugins.forEach((plugin, i) => {
                    pluginArray[i] = plugin;
                });

                pluginArray.item = index => pluginArray[index];
                pluginArray.namedItem = name => pluginArray.find(p => p.name === name);
                pluginArray.refresh = () => { };
                pluginArray.length = plugins.length;

                return pluginArray;
            }
        });

        // Override permissions API
        const originalQuery = window.navigator.permissions?.query;
        if (originalQuery) {
            window.navigator.permissions.query = parameters => {
                if (parameters.name === 'notifications' ||
                    parameters.name === 'geolocation' ||
                    parameters.name === 'camera' ||
                    parameters.name === 'microphone') {
                    return Promise.resolve({ state: "granted" });
                }
                if (parameters.name === 'clipboard-read' ||
                    parameters.name === 'clipboard-write') {
                    return Promise.resolve({ state: "prompt" });
                }
                return originalQuery(parameters);
            };
        }

        // Modify WebGL fingerprinting
        const getParameterProxies = new Map([
            [WebGLRenderingContext.prototype.getParameter, WebGLRenderingContext.prototype],
            [WebGL2RenderingContext.prototype.getParameter, WebGL2RenderingContext.prototype]
        ]);

        getParameterProxies.forEach((proto, originalFunction) => {
            const handler = {
                apply: function (target, thisArg, args) {
                    const param = args[0];

                    // UNMASKED_VENDOR_WEBGL or UNMASKED_RENDERER_WEBGL
                    if (param === 37445) {
                        return 'Google Inc. (NVIDIA)';
                    } else if (param === 37446) {
                        return 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0, D3D11)';
                    }

                    return Reflect.apply(target, thisArg, args);
                }
            };

            proto.getParameter = new Proxy(originalFunction, handler);
        });

        // Add OpenAI-specific workarounds
        window.oai_auth_method = 'password';
        window.cf_clearance = 'random_value_' + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
        window._paq = window._paq || [];
        window.dataLayer = window.dataLayer || [];

        // Spoof notification API if it exists
        if ('Notification' in window) {
            const originalPermission = Object.getOwnPropertyDescriptor(Notification, 'permission');
            Object.defineProperty(Notification, 'permission', {
                ...originalPermission,
                get: () => 'granted'
            });
        }

        // Random values for screen properties based on realistic settings
        const screens = [
            { width: 1920, height: 1080 },
            { width: 2560, height: 1440 },
            { width: 1366, height: 768 },
            { width: 1536, height: 864 }
        ];

        const randomScreen = screens[Math.floor(Math.random() * screens.length)];

        Object.defineProperties(window.screen, {
            width: { value: randomScreen.width },
            height: { value: randomScreen.height },
            availWidth: { value: randomScreen.width },
            availHeight: { value: randomScreen.height - 40 },
            colorDepth: { value: 24 },
            pixelDepth: { value: 24 }
        });

        // Canvas fingerprinting protection
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;

        HTMLCanvasElement.prototype.toDataURL = function (type) {
            if (this.width > 300 && this.height > 150) {
                // Likely fingerprinting, return a slightly modified result
                const dataURL = originalToDataURL.apply(this, arguments);
                const offset = Math.floor(Math.random() * 10);
                const noise = Math.floor(Math.random() * 10);
                const pixel = `rgba(${offset},${offset},${offset},0.${noise})`;

                return dataURL.replace(/.$/, pixel);
            }

            // Regular use case
            return originalToDataURL.apply(this, arguments);
        };

        CanvasRenderingContext2D.prototype.getImageData = function () {
            const imageData = originalGetImageData.apply(this, arguments);

            // Only modify for big enough images likely used in fingerprinting
            if (imageData.width > 300 && imageData.height > 150) {
                // Add slight noise to random pixels
                const len = imageData.data.length;
                for (let i = 0; i < len; i += 200) {
                    const offset = Math.floor(Math.random() * 3);
                    imageData.data[i + offset] = (imageData.data[i + offset] + Math.floor(Math.random() * 7)) % 256;
                }
            }

            return imageData;
        };
    });

    try {
        debugLog('Starting browser with human-like behavior...');
        await humanDelay(1000, 2000);

        debugLog('Navigating ONLY to official ChatGPT interface...');

        // Navigate directly to ChatGPT's interface with multiple attempts if needed
        let mainSiteAccessSuccessful = false;

        try {
                   // Navigate directly to the ChatGPT site

                   await page.goto('https://chat.openai.com', {
                       waitUntil: 'networkidle',
                       timeout: 60000
                   });

                   // Check if we hit CloudFlare protection or JavaScript/cookies error
                   const isCloudFlare = await page.evaluate(() => {
                       return document.title.includes('Cloudflare') ||
                           document.body.innerText.includes('Checking your browser') ||
                           document.body.innerText.includes('DDoS protection');
                   });


                   // Check for the JavaScript and cookies error
                   const jsErrorHandled = await handleJavaScriptAndCookiesError(page);
                   if (jsErrorHandled) {
                       // Additional delay after handling the error to let page stabilize
                       await humanDelay(3000, 5000);
                   }

                   // Check if we're on a login page or already in a chat interface
                   const hasChatInterface = await page.evaluate(() => {
                       return !!document.querySelector('textarea') ||
                           !!document.querySelector('div[contenteditable="true"]');
                   });

                   if (hasChatInterface) {
                       console.log('Successfully accessed ChatGPT chat interface directly');
                       mainSiteAccessSuccessful = true;
                    //    continue;
                   }

                   const isLoginPage = await page.evaluate(() => {
                       return document.body.innerText.includes('Log in') ||
                           document.body.innerText.includes('Sign in') ||
                           document.querySelector('button:has-text("Log in")') !== null ||
                           document.querySelector('button:has-text("Sign in")') !== null;
                   });

                   if (isLoginPage) {
                       console.log('Login page detected. Attempting to find direct access options...');

                       // Look for "Try ChatGPT" or any public access option
                       const publicAccessButtons = [
                           'a:has-text("Try ChatGPT")',
                           'a:has-text("Try for free")',
                           'a:has-text("Get started")',
                           'a:has-text("Chat with GPT")',
                           'a:has-text("Continue without an account")',
                           'button:has-text("Try ChatGPT")',
                           'button:has-text("Get started")',
                           'a.link[href$="/chat"]'
                       ];

                       let buttonClicked = false;
                       for (const buttonSelector of publicAccessButtons) {
                           const button = await page.$(buttonSelector);
                           if (button) {
                               console.log(`Found public access button with selector: ${buttonSelector}`);
                               const clicked = await safeClick(page, buttonSelector);
                               if (clicked) {
                                   console.log('Successfully clicked public access button');
                                   buttonClicked = true;

                                   // Wait for navigation to complete
                                   await page.waitForLoadState('networkidle').catch(() => {
                                       console.log('Navigation timeout after clicking public access button');
                                   });

                                   // Check if we now have a chat interface
                                   const hasInputAfterButton = await page.evaluate(() => {
                                       return !!document.querySelector('textarea') ||
                                           !!document.querySelector('div[contenteditable="true"]');
                                   });

                                   if (hasInputAfterButton) {
                                       console.log('Successfully accessed chat interface after clicking button');
                                       mainSiteAccessSuccessful = true;
                                       break;
                                   }
                               }
                           }
                       }

                       if (!buttonClicked) {
                           console.log('Could not find direct access options. Checking for existing session...');

                           // Try to look for any chat input - maybe user already has a session
                           const hasExistingSession = await page.evaluate(() => {
                               return !!document.querySelector('textarea') ||
                                   !!document.querySelector('div[contenteditable="true"]');
                           });

                           if (hasExistingSession) {
                               console.log('Found existing session with chat interface');
                               mainSiteAccessSuccessful = true;
                           } else {
                               console.log('No existing session detected. Trying alternative method...');

                               // Try going to the share URL which doesn't require login
                               await page.goto('https://chat.openai.com/share/new', {
                                   waitUntil: 'domcontentloaded',
                                   timeout: 30000
                               });

                               // Check if we now have a chat interface
                               const hasShareInterface = await page.evaluate(() => {
                                   return !!document.querySelector('textarea') ||
                                       !!document.querySelector('div[contenteditable="true"]');
                               });

                           if (hasShareInterface) {
                               console.log('Successfully accessed ChatGPT share interface');
                               mainSiteAccessSuccessful = true;
                           }
                       }
                   }
                   }
               } catch (error) {
                    // console.log(`Attempt ${attempt} failed: ${error.message}`);
                }
          
        
        if (mainSiteAccessSuccessful) {
            console.log('Successfully accessed official ChatGPT interface');
        } else {
            console.log('Could not access ChatGPT through main site after multiple attempts');

            // First try the direct "chat" URL which might bypass login for some users
            try {
                console.log('Trying direct chat URL access...');
                await page.goto('https://chat.openai.com/chat', {
                    waitUntil: 'domcontentloaded',
                    timeout: 30000
                });

                // Check if we landed on a chat interface
                const hasChatInterface = await page.evaluate(() => {
                    return !!document.querySelector('textarea') ||
                        !!document.querySelector('div[contenteditable="true"]');
                });

                if (hasChatInterface) {
                    console.log('Successfully accessed ChatGPT chat interface');
                    mainSiteAccessSuccessful = true;
                } else {
                    throw new Error('Could not access chat interface directly');
                }
            } catch (directError) {
                console.log(`Direct chat access failed: ${directError.message}`);

                // Try accessing via the GPTs gallery
                console.log('Attempting to access through GPTs gallery...');
                const gptAccessSuccessful = await tryAccessGPT(page);

                if (!gptAccessSuccessful) {
                    // Try going to alternatives like ChatGPT public interface, but ONLY OpenAI sites
                    console.log('Trying only official OpenAI interfaces...');

                    // Try ONLY OpenAI sites with multiple retries
                    const officialSites = [
                        'https://chat.openai.com/',  // Try main site again
                        'https://chat.openai.com/gpts',  // GPTs gallery 
                        'https://chat.openai.com/public',
                        'https://chat.openai.com/share',
                        'https://chatgpt.com/'
                    ];

                    // Remove old fallback sites array
                    let siteLoaded = false;

                    // Try each OpenAI site with multiple attempts
                    for (const site of officialSites) {
                        // Try each site up to 3 times
                        for (let attempt = 1; attempt <= 3; attempt++) {
                            try {
                                console.log(`Trying official site: ${site} (attempt ${attempt}/3)`);

                                // Slightly different approach for each attempt
                                if (attempt === 1) {
                                    // First attempt: standard approach
                                    await page.goto(site, { waitUntil: 'domcontentloaded', timeout: 30000 });
                                } else if (attempt === 2) {
                                    // Second attempt: clear cookies and cache first
                                    await context.clearCookies();
                                    await page.goto(site, { waitUntil: 'networkidle', timeout: 45000 });
                                } else {
                                    // Third attempt: try with navigation timeout
                                    await page.goto(site, { timeout: 60000 });
                                }

                                // Wait a moment to see if the page loads successfully
                                await humanDelay(3000, 5000);

                                // Check if page has a chat input field
                                const hasInput = await page.evaluate(() => {
                                    return !!document.querySelector('textarea') ||
                                        !!document.querySelector('div[contenteditable="true"]') ||
                                        !!document.querySelector('input[type="text"]');
                                });

                                if (hasInput) {
                                    console.log(`Successfully loaded official site: ${site}`);
                                    siteLoaded = true;
                                    break;
                                } else {
                                    console.log(`Site loaded but no input field found: ${site}`);

                                    // If we're on what appears to be a ChatGPT site but no input field,
                                    // look for buttons to click to access chat
                                    const chatButtons = [
                                        'a:has-text("New chat")',
                                        'button:has-text("New chat")',
                                        'a:has-text("Start chatting")',
                                        'button:has-text("Start chatting")',
                                        'a[href*="/chat"]'
                                    ];

                                    for (const buttonSelector of chatButtons) {
                                        const hasButton = await page.$(buttonSelector);
                                        if (hasButton) {
                                            console.log(`Found chat access button: ${buttonSelector}`);
                                            const clicked = await safeClick(page, buttonSelector);
                                            if (clicked) {
                                                await humanDelay(3000, 5000);
                                                // Check again for input
                                                const hasInputNow = await page.evaluate(() => {
                                                    return !!document.querySelector('textarea') ||
                                                        !!document.querySelector('div[contenteditable="true"]') ||
                                                        !!document.querySelector('input[type="text"]');
                                                });
                                                if (hasInputNow) {
                                                    console.log('Successfully accessed chat interface after clicking button');
                                                    siteLoaded = true;
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                }
                            } catch (siteError) {
                                console.log(`Failed to load ${site} (attempt ${attempt}/3): ${siteError.message}`);
                            }

                            if (siteLoaded) break;
                        }

                        if (siteLoaded) break;
                    }

                    if (!siteLoaded) {
                        throw new Error('Failed to access any official ChatGPT interface. Please check your internet connection or try logging in with valid credentials.');
                    }
                }
            }
        }

        await debugScreenshot(page, 'initial_load');

        await humanDelay(2000, 3000);

        // Wait for chat interface to load with better error handling
        console.log('Waiting for chat interface to load...');
        try {
            // Try different possible selectors for the chat input
            const chatInputSelectors = [
                'textarea[data-id="root"]',
                'textarea[placeholder*="Send a message"]',
                'textarea[placeholder*="Message ChatGPT"]',
                'textarea[placeholder*="Ask anything"]',
                'textarea[placeholder*="Chat with GPT"]',
                'textarea.chat-input',
                'div[role="textbox"]',
                'div[contenteditable="true"]',
                'textarea',
                'form textarea',
                'input[type="text"]'
            ];

            let chatInputFound = false;
            let chatInputSelector;

            // Try multiple approaches to find the chat input
            debugLog('Searching for chat input with multiple approaches...');

            // Approach 1: Direct selector check
            for (const selector of chatInputSelectors) {
                try {
                    await humanDelay(1000, 2000);
                    const inputExists = await page.$(selector);

                    if (inputExists) {
                        const isVisible = await page.isVisible(selector);
                        if (isVisible) {
                            debugLog(`Found chat input with selector: ${selector}`);
                            chatInputFound = true;
                            chatInputSelector = selector;

                            if (debug) {
                                await highlightElements(page, selector, 'green');
                            }

                            break;
                        } else {
                            debugLog(`Chat input exists but is not visible: ${selector}`);
                        }
                    }
                } catch (e) {
                    // Continue to the next selector
                    debugLog(`Error checking selector ${selector}: ${e.message}`);
                }
            }

            // Approach 2: Look for form elements
            if (!chatInputFound) {
                debugLog('Direct selectors failed. Searching for input elements within forms...');

                try {
                    // Look for form elements
                    const formInputs = await page.evaluate(() => {
                        const forms = document.querySelectorAll('form');
                        for (const form of forms) {
                            const inputs = form.querySelectorAll('textarea, div[contenteditable="true"], input[type="text"]');
                            if (inputs.length > 0) {
                                for (const input of inputs) {
                                    // Check if the input is visible
                                    const rect = input.getBoundingClientRect();
                                    if (rect.width > 0 && rect.height > 0) {
                                        return {
                                            tagName: input.tagName.toLowerCase(),
                                            id: input.id,
                                            className: input.className,
                                            placeholder: input.placeholder || '',
                                            role: input.getAttribute('role') || '',
                                            path: getElementPath(input)
                                        };
                                    }
                                }
                            }
                        }

                        // Helper function to get element path
                        function getElementPath(element) {
                            const path = [];
                            let currentElement = element;
                            while (currentElement && currentElement !== document.body) {
                                let selector = currentElement.tagName.toLowerCase();
                                if (currentElement.id) {
                                    selector += `#${currentElement.id}`;
                                } else if (currentElement.className) {
                                    selector += `.${currentElement.className.split(' ').join('.')}`;
                                }
                                path.unshift(selector);
                                currentElement = currentElement.parentElement;
                            }
                            return path.join(' > ');
                        }

                        return null;
                    });

                    if (formInputs) {
                        debugLog('Found input element in a form:', formInputs);

                        // Construct a selector from the found input info
                        let customSelector;
                        if (formInputs.id) {
                            customSelector = `${formInputs.tagName}#${formInputs.id}`;
                        } else if (formInputs.className) {
                            customSelector = `${formInputs.tagName}.${formInputs.className.split(' ').join('.')}`;
                        } else if (formInputs.placeholder) {
                            customSelector = `${formInputs.tagName}[placeholder*="${formInputs.placeholder}"]`;
                        } else if (formInputs.role) {
                            customSelector = `${formInputs.tagName}[role="${formInputs.role}"]`;
                        } else {
                            // Use a very specific path as last resort
                            customSelector = `${formInputs.path}`;
                        }

                        // Verify that our custom selector works
                        const customElement = await page.$(customSelector);
                        if (customElement) {
                            debugLog(`Found chat input with custom selector: ${customSelector}`);
                            chatInputFound = true;
                            chatInputSelector = customSelector;

                            if (debug) {
                                await highlightElements(page, customSelector, 'purple');
                            }
                        }
                    }
                } catch (formError) {
                    debugLog(`Error searching for input in forms: ${formError.message}`);
                }
            }

            // Approach 3: Look for any clickable area at the bottom of the page
            if (!chatInputFound) {
                debugLog('Form input search failed. Looking for clickable areas at bottom of page...');

                try {
                    const bottomElement = await page.evaluate(() => {
                        // Look for elements in the bottom portion of the viewport that seem like inputs
                        const viewportHeight = window.innerHeight;
                        const bottomThreshold = viewportHeight * 0.7; // Bottom 30% of screen

                        // Get all potential interactive elements
                        const potentialInputs = Array.from(document.querySelectorAll('div, textarea, input, button, form'))
                            .filter(el => {
                                // Skip hidden elements or those that appear to be buttons
                                if (!el.offsetParent ||
                                    el.tagName.toLowerCase() === 'button' ||
                                    el.innerText === 'Send' ||
                                    el.getAttribute('aria-label') === 'Send message') {
                                    return false;
                                }

                                // Check if the element is in the bottom portion of the screen
                                const rect = el.getBoundingClientRect();
                                if (rect.bottom < bottomThreshold || rect.height < 20 || rect.width < 200) {
                                    return false;
                                }

                                // Check if it looks like an input area
                                return true;
                            })
                            .sort((a, b) => {
                                // Prioritize by vertical position (bottom-most first)
                                const rectA = a.getBoundingClientRect();
                                const rectB = b.getBoundingClientRect();
                                return rectB.bottom - rectA.bottom;
                            });

                        if (potentialInputs.length > 0) {
                            const bestMatch = potentialInputs[0];
                            return {
                                tagName: bestMatch.tagName.toLowerCase(),
                                id: bestMatch.id,
                                className: bestMatch.className,
                                text: bestMatch.innerText.substring(0, 50),
                                bottom: bestMatch.getBoundingClientRect().bottom,
                                path: Array.from(potentialInputs.slice(0, 3)).map(el => {
                                    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className ? '.' + el.className.split(' ').join('.') : ''}`;
                                })
                            };
                        }

                        return null;
                    });

                    if (bottomElement) {
                        debugLog('Found potential input area at bottom of page:', bottomElement);

                        // Try clicking the area first to see if it activates an input
                        try {
                            let bottomSelector;
                            if (bottomElement.id) {
                                bottomSelector = `${bottomElement.tagName}#${bottomElement.id}`;
                            } else if (bottomElement.className) {
                                bottomSelector = `${bottomElement.tagName}.${bottomElement.className.split(' ').join('.')}`;
                            } else {
                                // If we don't have a good selector, try one of the paths
                                bottomSelector = bottomElement.path[0];
                            }

                            // Try to click the element
                            await page.click(bottomSelector).catch(e => debugLog(`Failed to click ${bottomSelector}: ${e.message}`));
                            await humanDelay(1000, 2000);

                            // Check if clicking revealed a textarea or input
                            const inputAfterClick = await page.evaluate(() => {
                                const input = document.querySelector('textarea, div[contenteditable="true"], input[type="text"]');
                                if (input) {
                                    const rect = input.getBoundingClientRect();
                                    if (rect.width > 0 && rect.height > 0) {
                                        return {
                                            tagName: input.tagName.toLowerCase(),
                                            id: input.id,
                                            className: input.className
                                        };
                                    }
                                }
                                return null;
                            });

                            if (inputAfterClick) {
                                debugLog('Clicking bottom area revealed input:', inputAfterClick);

                                let revealedSelector;
                                if (inputAfterClick.id) {
                                    revealedSelector = `${inputAfterClick.tagName}#${inputAfterClick.id}`;
                                } else if (inputAfterClick.className) {
                                    revealedSelector = `${inputAfterClick.tagName}.${inputAfterClick.className.split(' ').join('.')}`;
                                } else {
                                    revealedSelector = inputAfterClick.tagName;
                                }

                                chatInputFound = true;
                                chatInputSelector = revealedSelector;

                                if (debug) {
                                    await highlightElements(page, revealedSelector, 'orange');
                                }
                            } else {
                                // Use the bottom element itself as the input
                                chatInputFound = true;
                                chatInputSelector = bottomSelector;
                                debugLog(`Using bottom element as input: ${bottomSelector}`);

                                if (debug) {
                                    await highlightElements(page, bottomSelector, 'yellow');
                                }
                            }
                        } catch (clickError) {
                            debugLog(`Error clicking bottom area: ${clickError.message}`);
                        }
                    }
                } catch (bottomError) {
                    debugLog(`Error searching for bottom elements: ${bottomError.message}`);
                }
            }

            // Final fallback: try to simulate typing directly with keyboard shortcuts
            if (!chatInputFound) {
                debugLog('All input detection methods failed. Will try direct keyboard input.');

                try {
                    // Take a screenshot for documentation
                    await debugScreenshot(page, 'no_input_found');

                    // Try to focus the page and use Tab to navigate to the input
                    await page.click('body');
                    await humanDelay(500, 1000);

                    // Press Tab several times to try to reach the input field
                    for (let i = 0; i < 10; i++) {
                        await page.keyboard.press('Tab');
                        await humanDelay(300, 500);

                        // Check if we've focused an input element
                        const focusedElement = await page.evaluate(() => {
                            const active = document.activeElement;
                            if (active && (
                                active.tagName === 'TEXTAREA' ||
                                active.tagName === 'INPUT' ||
                                active.getAttribute('contenteditable') === 'true' ||
                                active.getAttribute('role') === 'textbox'
                            )) {
                                return {
                                    tagName: active.tagName.toLowerCase(),
                                    id: active.id,
                                    className: active.className
                                };
                            }
                            return null;
                        });

                        if (focusedElement) {
                            debugLog('Found input via keyboard navigation:', focusedElement);
                            chatInputFound = true;
                            // We'll use keyboard directly since we have focus
                            break;
                        }
                    }
                } catch (keyboardError) {
                    debugLog(`Error with keyboard navigation: ${keyboardError.message}`);
                }
            }

            if (!chatInputFound) {
                throw new Error('Could not find any usable chat input interface. The page structure may have changed.');
            } else {
                debugLog(`Successfully found chat input: ${chatInputSelector || 'Will use keyboard directly'}`);
            }

            // Check for any "Accept", "Continue", or "Skip" buttons that may appear
            const commonButtons = [
                'button:has-text("Accept")',
                'button:has-text("Continue")',
                'button:has-text("Skip")',
                'button:has-text("Get Started")',
                'button:has-text("I agree")'
            ];

            for (const buttonSelector of commonButtons) {
                const hasButton = await page.$(buttonSelector);
                if (hasButton) {
                    debugLog(`Found and clicking ${buttonSelector} button`);
                    await safeClick(page, buttonSelector);
                    await humanDelay(1000, 2000);
                }
            }

            // Try one more time to ensure the interface is ready
            await debugScreenshot(page, 'chat_interface_ready');

            // Input the initial prompt with human-like typing
            debugLog('Sending initial prompt...');

            if (chatInputSelector) {
                try {
                    await humanTyping(page, chatInputSelector, initialPrompt);
                } catch (typingError) {
                    debugLog(`Error using humanTyping: ${typingError.message}`);

                    // Fallback: Try direct keyboard typing
                    debugLog('Falling back to direct keyboard typing');
                    await page.click('body');
                    for (let i = 0; i < 5; i++) {
                        await page.keyboard.press('Tab');
                        await humanDelay(300, 500);
                    }

                    // Type the prompt character by character
                    for (const char of initialPrompt) {
                        await page.keyboard.type(char, { delay: Math.random() * 100 + 30 });
                        if (Math.random() > 0.9) {
                            await humanDelay(300, 800);
                        }
                    }
                }
            } else {
                // Use direct keyboard typing
                debugLog('Using direct keyboard typing');
                for (const char of initialPrompt) {
                    await page.keyboard.type(char, { delay: Math.random() * 100 + 30 });
                    if (Math.random() > 0.9) {
                        await humanDelay(300, 800);
                    }
                }
            }

            // Look for send button or use Enter key
            debugLog('Looking for send button...');
            let sendButtonSelector = null;
            const sendButtonSelectors = [
                'button[aria-label="Send message"]',
                'button.send-button',
                'button[type="submit"]',
                'button:has-text("Send")',
                'button svg[data-testid="send-icon"]',
                'svg[data-testid="send-button-icon"]',
                'button.chat-send',
                'button.submit',
                'button.send',
                'button.submit-button',
                'svg path[d="M.5 1.163A1 1 0 0 1 1.97.28l12.868 6.837a1 1 0 0 1 0 1.766L1.969 15.72A1 1 0 0 1 .5 14.836V10.33a1 1 0 0 1 .816-.983L8.5 8 1.316 6.653A1 1 0 0 1 .5 5.67V1.163Z"]' // Paper airplane icon path
            ];

            for (const selector of sendButtonSelectors) {
                try {
                    const button = await page.$(selector);
                    if (button) {
                        const isVisible = await page.isVisible(selector);
                        if (isVisible) {
                            sendButtonSelector = selector;
                            debugLog(`Found send button with selector: ${selector}`);

                            if (debug) {
                                await highlightElements(page, selector, 'blue');
                            }

                            break;
                        }
                    }
                } catch (e) {
                    // Continue to next selector
                }
            }

            // If no send button found, try to find it by looking for a button in a form
            if (!sendButtonSelector) {
                debugLog('Standard send button selectors failed. Looking for buttons in form...');

                try {
                    const formButton = await page.evaluate(() => {
                        // Look for forms containing our input
                        const forms = document.querySelectorAll('form');
                        for (const form of forms) {
                            // Look for buttons in the form
                            const buttons = form.querySelectorAll('button');
                            for (const button of buttons) {
                                // Check if it looks like a send button
                                if (button.innerText === 'Send' ||
                                    button.getAttribute('aria-label') === 'Send message' ||
                                    button.getAttribute('type') === 'submit' ||
                                    button.querySelector('svg')) {
                                    return {
                                        tagName: 'button',
                                        id: button.id,
                                        className: button.className,
                                        ariaLabel: button.getAttribute('aria-label') || ''
                                    };
                                }
                            }
                        }
                        return null;
                    });

                    if (formButton) {
                        debugLog('Found form button:', formButton);

                        let customButtonSelector;
                        if (formButton.id) {
                            customButtonSelector = `button#${formButton.id}`;
                        } else if (formButton.className) {
                            customButtonSelector = `button.${formButton.className.split(' ').join('.')}`;
                        } else if (formButton.ariaLabel) {
                            customButtonSelector = `button[aria-label="${formButton.ariaLabel}"]`;
                        } else {
                            customButtonSelector = 'form button';
                        }

                        const customButton = await page.$(customButtonSelector);
                        if (customButton) {
                            sendButtonSelector = customButtonSelector;
                            debugLog(`Using custom send button selector: ${customButtonSelector}`);
                        }
                    }
                } catch (formButtonError) {
                    debugLog(`Error searching for form buttons: ${formButtonError.message}`);
                }
            }

            // Try to send the message
            await debugScreenshot(page, 'before_sending');

            if (sendButtonSelector) {
                debugLog(`Clicking send button: ${sendButtonSelector}`);
                const sendClicked = await safeClick(page, sendButtonSelector);
                if (!sendClicked) {
                    debugLog('Failed to click send button, trying Enter key instead');
                    await page.press(chatInputSelector || 'body', 'Enter');
                }
            } else {
                debugLog('No send button found, using Enter key');
                if (chatInputSelector) {
                    await page.press(chatInputSelector, 'Enter');
                } else {
                    await page.keyboard.press('Enter');
                }
            }

            await debugScreenshot(page, 'after_sending');

            // Wait for response with better error handling
            console.log('Waiting for ChatGPT response...');
            try {
                // Different potential response selectors
                const responseSelectors = [
                    '.markdown',
                    '.chat-message-content',
                    '.assistant-message',
                    'div[data-message-author-role="assistant"]',
                    '.message:not(.user-message)',
                    '.bot-message',
                    '.response-message'
                ];

                let responseFound = false;
                let responseSelector = null;

                for (const selector of responseSelectors) {
                    try {
                        // Try different waiting strategies
                        const elementCount = await page.evaluate((sel) => document.querySelectorAll(sel).length, selector);
                        console.log(`Found ${elementCount} elements with selector: ${selector}`);

                        if (elementCount > 0) {
                            console.log(`Found response elements with selector: ${selector}`);
                            responseFound = true;
                            responseSelector = selector;

                            if (debug) {
                                await highlightElements(page, selector, 'blue');
                            }

                            break;
                        }
                    } catch (e) {
                        // Continue to the next selector
                        console.log(`Selector ${selector} not found: ${e.message}`);
                    }
                }

                if (!responseFound) {
                    // Let's try a more aggressive way of finding responses
                    console.log('Standard selectors not found. Trying more generic content detection...');

                    // Wait for any content changes that might indicate a response
                    await page.waitForFunction(() => {
                        // Look for changes in any part of the page that could be a response
                        const allParagraphs = document.querySelectorAll(`p, div.${sr-only}, span`);
                        for (const element of allParagraphs) {
                            // If element has substantial text and isn't user input
                            if (element.innerText &&
                                element.innerText.length > 20 &&
                                // !element.closest('form') &&
                                !element.matches('textarea, input, [role="textbox"]')) {
                                return true;
                            }
                        }
                        return false;
                    }, { timeout: 30000 }).catch(e => {
                        console.log('Timed out waiting for content changes: ' + e.message);
                    });
                }

                // Double-check if response is still being generated
                try {
                    // Wait for typing to finish with multiple indicators
                    await page.waitForFunction(() => {
                        const loadingElements = [
                            '.result-streaming',
                            '.typing-indicator',
                            '.loading',
                            '[data-state="loading"]',
                            '.animate-pulse',
                            '.text-loader',
                            'div:has-text("Generating")',
                            'div:has-text("Thinking")'
                        ];

                        for (const selector of loadingElements) {
                            if (document.querySelector(selector)) {
                                console.log(`Still loading: ${selector}`);
                                return false;
                            }
                        }
                        return true;
                    }, { timeout: 60000 }).catch(() => {
                        console.log('Timeout waiting for typing to finish, but continuing anyway...');
                    });
                } catch (error) {
                    console.log('Error while checking if response generation is complete: ' + error.message);
                }

                await humanDelay(2000, 3000);

            } catch (error) {
                console.log('Failed to detect response element. Taking screenshot for debugging...');
                await page.screenshot({ path: path.join(outputDir, 'response-error.png') });
                throw new Error('Error waiting for ChatGPT response: ' + error.message);
            }

            // Before extracting the response
            debugLog('About to extract response...');
            await debugScreenshot(page, 'before_extracting_response');

            // Get the response with enhanced error handling
            let initialResponse;
            try {
                // Try several methods to extract the response text
                initialResponse = await page.evaluate(() => {
                    // Method 1: Try different selectors for the response
                    const selectors = [
                        '.markdown',
                        '.chat-message-content',
                        '.assistant-message',
                        'div[data-message-author-role="assistant"]',
                        '.message:not(.user-message)',
                        '.bot-message',
                        '.response-message',
                        '[id*="message"]'
                    ];

                    for (const selector of selectors) {
                        const elements = document.querySelectorAll(selector);
                        if (elements.length > 0) {
                            // Get the last element or the one that appeared after user input
                            return elements[elements.length - 1].innerText;
                        }
                    }

                    // Method 2: Look for conversation structure
                    // Find user messages, then locate assistant messages after them
                    const userMessages = document.querySelectorAll('.user-message, [data-message-author-role="user"], div.request-message');
                    if (userMessages.length > 0) {
                        // Get the last user message
                        const lastUserMessage = userMessages[userMessages.length - 1];

                        // Look for the next sibling elements that might contain the assistant's response
                        let currentElement = lastUserMessage.nextElementSibling;
                        while (currentElement) {
                            if (currentElement.innerText &&
                                currentElement.innerText.length > 20 &&
                                !currentElement.matches('form, button, textarea, input') &&
                                !currentElement.innerText.includes('Send a message'||'Ask anything')) {
                                return currentElement.innerText;
                            }
                            currentElement = currentElement.nextElementSibling;
                        }
                    }

                    // Method 3: Look for any substantial text that could be a response
                    // Exclude elements that are clearly not responses
                    const allParagraphs = document.querySelectorAll('p, div, span');
                    const excludeTexts = ['Ask anything', 'ChatGPT', 'Log in', 'Sign up', 'Menu', 'Settings', `What can I help with?Temporary ChatThis chat won't appear in history or be used to train our models. For safety purposes, we may keep a copy of this chat for up to 30 days.`];
                    //  const gptResponse =  document.querySelectorAll(`p.${sr-only}, div.${sr-only}, span.${sr-only}'`);
                    // Filter for elements that might contain substantive text
                    console.log('gptRes',allParagraphs)
                    const potentialResponses = Array.from(allParagraphs).filter(el => {
                        const text = el.innerText.trim();
                        return text.length > 50 &&
                            !excludeTexts.some(exclude => text.includes(exclude)) &&
                            !el.closest('form') &&
                            !el.matches('textarea, input, [role="textbox"]');
                    });

                    if (potentialResponses.length > 0) {
                        // Sort by content length to find the most substantial response
                        potentialResponses.sort((a, b) => b.innerText.length - a.innerText.length);
                        return potentialResponses[0].innerText;
                    }

                    // Fallback to get any content from common containers
                    return document.querySelector('.chat-content, .conversation, .thread, .messages, main')?.innerText ||
                        'Could not extract response text. Please check the browser or take a screenshot for debugging.';
                });

                console.log('Response extracted. Length: ' + (initialResponse ? initialResponse.length : 0));

                // If we got a very short response, it might be an error
                if (!initialResponse || initialResponse.length < 20) {
                    console.log('Warning: Response seems too short or empty. Taking screenshot...');
                    await page.screenshot({ path: path.join(outputDir, 'short-response.png') });

                    // One more attempt with a different approach
                    console.log('Trying alternative extraction method...');
                    initialResponse = await page.evaluate(() => {
                        // Get all text from the page except obvious UI elements
                        const allText = Array.from(document.querySelectorAll('body *')).map(el => {
                            // Skip obvious UI elements
                            if (el.matches('nav, header, footer, button, form, input, textarea') ||
                                el.closest('nav, header, footer, button, form, input, textarea')) {
                                return '';
                            }

                            return el.innerText;
                        }).filter(text => text.length > 20).join('\n');

                        return allText || 'Could not extract response using alternative method';
                    });
                }
            } catch (error) {
                console.log('Error extracting response text:', error);
                initialResponse = 'Error extracting response: ' + error.message;

                // Take a screenshot for debugging
                await page.screenshot({ path: path.join(outputDir, 'response-extraction-error.png') });
            }

            // After extracting the response
            debugLog(`Response extracted. Length: ${initialResponse ? initialResponse.length : 0}`);
            debugLog('Response content (first 100 chars):', initialResponse ? initialResponse.substring(0, 10000) + '...' : 'No response');
            await debugScreenshot(page, 'after_extracting_response');

            let replyResponse = null;
            let replyCsvPath = null;

            // If a reply prompt was provided, send it
            if (replyPrompt) {
                console.log('Sending reply prompt...');
                await humanDelay(1500, 3000);
                await humanTyping(page, chatInputSelector, replyPrompt);
                
                // Send the reply using our enhanced method
                console.log('Sending reply prompt...');
                const replySent = await sendMessage(page, chatInputSelector, sendButtonSelector);
                
                if (!replySent) {
                  console.log('WARNING: Had difficulty sending the reply message. Will try to continue anyway.');
                } else {
                    await page.press(chatInputSelector, 'Enter');
                }

                // Wait for the reply with better handling
                console.log('Waiting for ChatGPT reply...');
                await humanDelay(2000, 3000);

                try {
                    // Wait for new response with a broader detection approach
                    await page.waitForFunction(() => {
                        // Count all potential message elements
                        const userMessages = document.querySelectorAll('.request-message, .user-message, [data-message-author-role="user"], .message.user-message');
                        const responseMessages = document.querySelectorAll('.markdown, .chat-message-content, .assistant-message, [data-message-author-role="assistant"], .message:not(.user-message), .bot-message, .response-message');

                        // Look for specific loading indicators
                        const stillLoading = document.querySelector('.result-streaming, .typing-indicator, .loading, [data-state="loading"], .animate-pulse');

                        // If still loading, we don't have a complete response yet
                        if (stillLoading) return false;

                        // Otherwise check if we have enough responses for user messages
                        return responseMessages.length >= userMessages.length;
                    }, { timeout: 60000 }).catch(e => {
                        console.log('Timeout waiting for reply: ' + e.message + ', but continuing anyway...');
                    });

                    // Wait for typing to finish
                    await page.waitForFunction(() => {
                        const loadingElements = [
                            '.result-streaming',
                            '.typing-indicator',
                            '.loading',
                            '[data-state="loading"]',
                            '.animate-pulse',
                            '.text-loader',
                            'div:has-text("Generating")',
                            'div:has-text("Thinking")'
                        ];

                        for (const selector of loadingElements) {
                            if (document.querySelector(selector)) {
                                return false;
                            }
                        }
                        return true;
                    }, { timeout: 60000 }).catch(() => {
                        console.log('Timeout waiting for typing to finish on reply, but continuing anyway...');
                    });

                    await humanDelay(2000, 3000);

                    // Get the reply with enhanced error handling
                    replyResponse = await page.evaluate(() => {
                        // Method 1: Try different selectors for the response
                        const selectors = [
                            '.markdown',
                            '.chat-message-content',
                            '.assistant-message',
                            'div[data-message-author-role="assistant"]',
                            '.message:not(.user-message)',
                            '.bot-message',
                            '.response-message',
                            '[id*="message"]'
                        ];

                        for (const selector of selectors) {
                            const elements = document.querySelectorAll(selector);
                            if (elements.length > 0) {
                                // Get the last element (most recent response)
                                return elements[elements.length - 1].innerText;
                            }
                        }

                        // Method 2: Look at conversation structure
                        const userMessages = document.querySelectorAll('.user-message, [data-message-author-role="user"], div.request-message');
                        if (userMessages.length > 0) {
                            // Get the last user message
                            const lastUserMessage = userMessages[userMessages.length - 1];

                            // Look for the next sibling elements that might contain the assistant's response
                            let currentElement = lastUserMessage.nextElementSibling;
                            while (currentElement) {
                                if (currentElement.innerText &&
                                    currentElement.innerText.length > 20 &&
                                    !currentElement.matches('form, button, textarea, input') &&
                                    !currentElement.innerText.includes('Send a message')) {
                                    return currentElement.innerText;
                                }
                                currentElement = currentElement.nextElementSibling;
                            }
                        }

                        // Method 3: Look for any substantial text that could be a response
                        const allParagraphs = document.querySelectorAll('p, div, span');
                        const excludeTexts = ['Send a message', 'ChatGPT', 'Log in', 'Sign up', 'Menu', 'Settings'];

                        // Filter for elements with substantial text
                        const potentialResponses = Array.from(allParagraphs).filter(el => {
                            const text = el.innerText.trim();
                            return text.length > 50 &&
                                !excludeTexts.some(exclude => text.includes(exclude)) &&
                                !el.closest('form') &&
                                !el.matches('textarea, input, [role="textbox"]');
                        });

                        if (potentialResponses.length > 0) {
                            // Sort by content length, assuming larger content is more likely to be the response
                            potentialResponses.sort((a, b) => b.innerText.length - a.innerText.length);
                            return potentialResponses[0].innerText;
                        }

                        return document.querySelector('.chat-content, .conversation, .thread, .messages, main')?.innerText ||
                            'Could not extract reply text. Please check the browser.';
                    });
                } catch (error) {
                    console.log('Error getting reply:', error);
                    replyResponse = 'Error getting reply: ' + error.message;
                    await page.screenshot({ path: path.join(outputDir, 'reply-error.png') });
                }
            }

            // After the entire interaction
            debugLog('ChatGPT interaction complete');
            await debugScreenshot(page, 'interaction_complete');

            // Wait a bit before closing to ensure everything is saved
            await humanDelay(2000, 4000);

            return {
                success: true,
                initialResponse,
                replyResponse,
                initialCsvPath: '',
                replyCsvPath,
                debugDir: debug ? debugDir : null
            };

        } catch (error) {
            console.log('Failed to find chat input. Taking screenshot for debugging...');
            await page.screenshot({ path: path.join(outputDir, 'error-screenshot.png') });
            throw new Error('Could not access the chat interface: ' + error.message);
        }

    } catch (error) {
        console.error('Error in ChatGPT interaction:', error);

        // Attempt to take a screenshot on error for debugging
        try {
            if (page) {
                const errorScreenshotPath = await debugScreenshot(page, 'error');
                debugLog(`Captured error screenshot: ${errorScreenshotPath}`);
            }
        } catch (screenshotError) {
            console.log('Failed to take error screenshot:', screenshotError);
        }

        return {
            success: false,
            error: error.message,
            debugDir: debug ? debugDir : null
        };
    } finally {
        if (!debug) {
            //   await browser.close();
        } else {
            debugLog('Browser kept open for debugging purposes. Close it manually when done.');
        }
    }
}

/**
 * Checks if a CAPTCHA is present on the page
 * @param {Page} page - Playwright page object
 * @returns {Promise<boolean>} - Whether a CAPTCHA was detected
 */
async function checkForCaptcha(page) {
    // Common CAPTCHA elements and text to look for
    const captchaSelectors = [
        'iframe[title*="recaptcha"]',
        'iframe[src*="recaptcha"]',
        'iframe[src*="captcha"]',
        'div[class*="captcha"]',
        'div[id*="captcha"]',
        'iframe[title*="security check"]',
        'div[aria-label*="security challenge"]'
    ];

    const captchaText = [
        'captcha',
        'robot',
        'verification',
        'verify',
        'human',
        'security check',
        'prove you\'re human',
        'not a robot'
    ];

    // Check for CAPTCHA elements
    for (const selector of captchaSelectors) {
        const hasCaptcha = await page.$(selector).then(Boolean);
        if (hasCaptcha) return true;
    }

    // Check for CAPTCHA text in page content
    const pageContent = await page.content();
    for (const text of captchaText) {
        if (pageContent.toLowerCase().includes(text)) return true;
    }

    return false;
}

/**
 * Waits for the user to manually solve a CAPTCHA
 * @param {Page} page - Playwright page object
 * @param {string} nextSelector - Selector to wait for after CAPTCHA is solved
 * @returns {Promise<void>}
 */
async function waitForCaptchaSolution(page, nextSelector) {
    console.log('CAPTCHA detected!');
    console.log('Please solve the CAPTCHA verification in the browser window...');
    console.log('Take your time - the script will automatically continue once you complete it.');

    // Wait for the next expected element to appear, which indicates the CAPTCHA was solved
    await page.waitForSelector(nextSelector, { timeout: 300000 }); // 5-minute timeout for solving
    console.log('CAPTCHA appears to be solved, continuing with the process...');
    await humanDelay(1000, 2000);
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

    console.log(`Successfully saved ${type} response to ${filePath}`);
    return filePath;
}

/**
 * Tries to use a GPT from the GPTs gallery
 * @param {Page} page - Playwright page object
 * @returns {Promise<boolean>} - Whether a GPT was successfully accessed
 */
async function tryAccessGPT(page) {
    try {
        console.log('Attempting to access a GPT from the gallery...');

        // Navigate to the GPTs gallery
        await page.goto('https://chat.openai.com/gpts', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        // Check if we're in the GPTs gallery (not redirected to login)
        const inGallery = await page.evaluate(() => {
            return document.body.innerText.includes('GPT Store') ||
                document.body.innerText.includes('Explore GPTs') ||
                document.querySelectorAll('.gpt-card, [data-testid="gpt-card"]').length > 0;
        });

        if (!inGallery) {
            console.log('Could not access GPTs gallery without login');
            return false;
        }

        console.log('Successfully accessed GPTs gallery, looking for a GPT to use...');

        // Wait for GPT cards to load
        await humanDelay(2000, 3000);

        // Try to find and click on a GPT card
        const gptCardSelectors = [
            '.gpt-card',
            '[data-testid="gpt-card"]',
            'a[href*="/g/"]',
            'div[role="button"]'
        ];

        for (const selector of gptCardSelectors) {
            const cards = await page.$$(selector);
            if (cards.length > 0) {
                // Click on the first card
                console.log(`Found ${cards.length} GPT cards with selector: ${selector}`);

                // Click a random card from the first 5 found
                const randomIndex = Math.floor(Math.random() * Math.min(5, cards.length));
                await cards[randomIndex].click();

                console.log('Clicked on a GPT card, waiting for it to load...');

                // Wait for navigation to complete
                await page.waitForLoadState('networkidle').catch(() => {
                    console.log('Navigation timeout after clicking GPT card');
                });

                // Check if we now have a chat interface
                await humanDelay(2000, 3000);
                const hasChatInterface = await page.evaluate(() => {
                    return !!document.querySelector('textarea') ||
                        !!document.querySelector('div[contenteditable="true"]');
                });

                if (hasChatInterface) {
                    console.log('Successfully accessed a GPT chat interface');
                    return true;
                } else {
                    // If we're on a GPT info page, try to click "Try it" or similar button
                    const tryButtons = [
                        'button:has-text("Try it")',
                        'button:has-text("Start chat")',
                        'button:has-text("Chat")',
                        'a:has-text("Try it")'
                    ];

                    for (const buttonSelector of tryButtons) {
                        const hasButton = await page.$(buttonSelector);
                        if (hasButton) {
                            console.log(`Found and clicking ${buttonSelector} button`);
                            await safeClick(page, buttonSelector);

                            // Wait to see if we get a chat interface
                            await humanDelay(2000, 3000);
                            const hasChatInterfaceNow = await page.evaluate(() => {
                                return !!document.querySelector('textarea') ||
                                    !!document.querySelector('div[contenteditable="true"]');
                            });

                            if (hasChatInterfaceNow) {
                                console.log('Successfully accessed GPT chat interface after clicking try button');
                                return true;
                            }
                        }
                    }

                    console.log('Could not find a way to start chatting with this GPT');
                }

                break;
            }
        }

        console.log('Could not find any clickable GPT cards');
        return false;

    } catch (error) {
        console.log(`Error accessing GPTs: ${error.message}`);
        return false;
    }
}

/**
 * Handles the "Enable JavaScript and cookies to continue" error
 * @param {Page} page - Playwright page object
 * @returns {Promise<boolean>} - Whether the issue was resolved
 */
async function handleJavaScriptAndCookiesError(page) {
    debugLog('Checking for "Enable JavaScript and cookies" error...');

    try {
        // Check if the error is present
        const hasError = await page.evaluate(() => {
            const errorText = document.body.innerText || '';
            return errorText.includes('Enable JavaScript and cookies to continue') ||
                errorText.includes('JavaScript is required') ||
                errorText.includes('Please enable JavaScript') ||
                errorText.includes('Please enable cookies');
        });

        if (!hasError) {
            debugLog('No JavaScript/cookies error detected');
            return false;
        }

        debugLog('Detected "Enable JavaScript and cookies" error. Attempting to bypass...');
        await debugScreenshot(page, 'js_cookies_error');

        // Try refresh with additional headers
        debugLog('Attempting to refresh page with enhanced headers...');
        await page.evaluate(() => {
            // Add flag to localStorage
            localStorage.setItem('js_enabled', 'true');
            localStorage.setItem('cookies_enabled', 'true');
        });

        // Adding CloudFlare specific cookies
        const context = page.context();
        const domain = '.openai.com';
        const cookieExpiryDate = new Date();
        cookieExpiryDate.setDate(cookieExpiryDate.getDate() + 30);

        await context.addCookies([
            {
                name: 'cf_clearance',
                value: randomString(80), // CloudFlare clearance token
                domain: domain,
                path: '/',
                expires: cookieExpiryDate.getTime() / 1000,
                httpOnly: true,
                secure: true,
                sameSite: 'None'
            }
        ]);

        // Refresh with additional headers
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'max-age=0',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'User-Agent': page.context()._options.userAgent
        });

        // Refresh the page
        await page.reload({ waitUntil: 'networkidle' });
        await humanDelay(2000, 3000);

        // Check if error is resolved
        const errorStillExists = await page.evaluate(() => {
            const errorText = document.body.innerText || '';
            return errorText.includes('Enable JavaScript and cookies to continue') ||
                errorText.includes('JavaScript is required') ||
                errorText.includes('Please enable JavaScript') ||
                errorText.includes('Please enable cookies');
        });

        if (errorStillExists) {
            debugLog('Error persists after first attempt. Trying alternate approach...');

            // Try more aggressive approach - navigate to a different OpenAI page and then back
            await page.goto('https://openai.com', { waitUntil: 'networkidle' });
            await humanDelay(1000, 2000);
            await page.goto('https://chat.openai.com', { waitUntil: 'networkidle' });
            await humanDelay(2000, 3000);

            // Check if error is now resolved
            const stillHasError = await page.evaluate(() => {
                const errorText = document.body.innerText || '';
                return errorText.includes('Enable JavaScript and cookies to continue') ||
                    errorText.includes('JavaScript is required') ||
                    errorText.includes('Please enable JavaScript') ||
                    errorText.includes('Please enable cookies');
            });

            if (stillHasError) {
                debugLog('Error still persists. It may require manual intervention.');
                await debugScreenshot(page, 'js_cookies_error_unresolved');
                return false;
            }

            debugLog('Successfully bypassed JavaScript/cookies error with alternate approach');
            await debugScreenshot(page, 'js_cookies_error_resolved');
            return true;
        }

        debugLog('Successfully bypassed JavaScript/cookies error');
        await debugScreenshot(page, 'js_cookies_error_resolved');
        return true;
    } catch (error) {
        debugLog(`Error while handling JavaScript/cookies error: ${error.message}`);
        return false;
    }
}

module.exports = {
    chatGPTInteraction,
    tryAccessGPT,
    handleJavaScriptAndCookiesError,
    randomString
}; 