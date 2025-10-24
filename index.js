const TelegramBot = require('node-telegram-bot-api')
const axios = require('axios')

const BOT_TOKEN = '8067078873:AAFuYKzf9CiRR3bpV__dwH9hxr-aoEKwgAU'
const APPTESTERS_API_URL = 'https://raw.githubusercontent.com/apptesters-org/AppTesters_Repo/refs/heads/main/apps.json'

const bot = new TelegramBot(BOT_TOKEN, {polling: true})

// Handle polling errors gracefully
bot.on('polling_error', (error) => {
  console.error('Polling error:', error.message)
  if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
    console.log('Another bot instance is running. Stopping this instance...')
    process.exit(0)
  }
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Cache for API data
let appsData = null
let lastFetchTime = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Function to fetch data from AppTesters API
async function fetchAppsData() {
  try {
    const now = Date.now()
    
    // Return cached data if it's still fresh
    if (appsData && (now - lastFetchTime) < CACHE_DURATION) {
      return appsData
    }

    console.log('Fetching fresh data from AppTesters API...')
    const response = await axios.get(APPTESTERS_API_URL)
    appsData = response.data
    lastFetchTime = now
    console.log(`Fetched ${appsData.apps.length} apps from API`)
    return appsData
  } catch (error) {
    console.error('Error fetching apps data:', error.message)
    throw error
  }
}

// Function to find app by bundle identifier
function findAppByBundleId(bundleId) {
  if (!appsData || !appsData.apps) {
    return null
  }
  
  return appsData.apps.find(app => 
    app.bundleID === bundleId || 
    app.bundleIdentifier === bundleId
  )
}

// Function to format app response
function formatAppResponse(app) {
  if (!app) {
    return '❌ App not found. Please check the bundle identifier and try again.'
  }

  const features = []
  
  // Extract features from localizedDescription
  if (app.localizedDescription) {
    const desc = app.localizedDescription.toLowerCase()
    if (desc.includes('premium')) features.push('Premium Unlocked')
    if (desc.includes('pro')) features.push('Pro Features')
    if (desc.includes('subscription')) features.push('Subscription Unlocked')
    if (desc.includes('iap')) features.push('In-App Purchases')
    if (desc.includes('unlocked')) features.push('All Features Unlocked')
    if (desc.includes('tweaks')) features.push('Enhanced Tweaks')
    if (desc.includes('satella')) features.push('Satella Integration')
  }

  // If no specific features found, add generic ones based on description
  if (features.length === 0 && app.localizedDescription) {
    features.push(app.localizedDescription)
  }

  // Format features list
  const featuresList = features.length > 0 
    ? features.map(feature => `✅ ${feature}`).join('\n')
    : '✅ Enhanced Features\n✅ Premium Content'

  const response = `📱 *${app.name}* 🆕

🔩 *Hack Features* 🔩
${featuresList}

📥 *Download*
[Download IPA](https://ipa-drop.vercel.app/app/${app.bundleID})

📄 *Buy Your Own Certificate* [Tap Here](https://ipa-drop.vercel.app/certificate)`

  return response
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  // If message is empty or not text, ignore
  if (!text) return;

  try {
    // Check if it's a bundle identifier (contains dots and looks like a bundle ID)
    const bundleIdRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z0-9.-]+$/
    
    if (bundleIdRegex.test(text)) {
      // Fetch fresh data
      await fetchAppsData()
      
      // Find the app
      const app = findAppByBundleId(text)
      
      if (app) {
        // Send app icon first
        if (app.iconURL) {
          try {
            await bot.sendPhoto(chatId, app.iconURL, {
              caption: formatAppResponse(app),
              parse_mode: 'Markdown'
            })
          } catch (error) {
            // If photo fails, send text with icon URL
            const responseWithIcon = `[${app.iconURL}](${app.iconURL})\n\n${formatAppResponse(app)}`
            await bot.sendMessage(chatId, responseWithIcon, { parse_mode: 'Markdown' })
          }
        } else {
          await bot.sendMessage(chatId, formatAppResponse(app), { parse_mode: 'Markdown' })
        }
      } else {
        await bot.sendMessage(chatId, '❌ App not found. Please check the bundle identifier and try again.\n\nExample: `com.zhiliaoapp.musically`')
      }
    } else {
      // Show help message
      await bot.sendMessage(chatId, `🤖 *AppTesters Bot*

Send me a bundle identifier to get app information!

*Examples:*
• \`com.zhiliaoapp.musically\` (TikTok)
• \`com.google.ios.youtube\` (YouTube)
• \`com.campmobile.snow\` (SNOW)

*How to find bundle ID:*
1. Open App Store
2. Find the app
3. Copy the link
4. Bundle ID is in the URL after \`id\`

*API Source:* [AppTesters Repository](https://github.com/apptesters-org/AppTesters_Repo)`, { parse_mode: 'Markdown' })
    }
  } catch (error) {
    console.error('Error processing message:', error.message)
    await bot.sendMessage(chatId, '❌ Sorry, there was an error processing your request. Please try again later.')
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down bot gracefully...')
  bot.stopPolling()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down bot gracefully...')
  bot.stopPolling()
  process.exit(0)
})

console.log('🤖 AppTesters Bot is running...')
console.log('Press Ctrl+C to stop the bot')