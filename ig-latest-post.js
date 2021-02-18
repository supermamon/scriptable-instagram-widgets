// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: pink; icon-glyph: camera-retro;
/* -----------------------------------------------

Script      : ig-latest-post.js
Author      : me@supermamon.com
Version     : 2.0.0
Description :
  Displays the latest instagram post of a selected
  user or users. Tap the widget to open the 
  Instagram post in the app

Changelog:
v2.0.0 - Fixed 'format' error
       - Now works with private users 
       - Now works in restricted regions
v1.3.0 - Pick the highest resolution photo
v1.2.0 - Option to pick up to 12 of the most 
         recent posts
v1.1.0 - Options to show likes and comments count
v1.0.0 - Initial release
----------------------------------------------- */

const DEBUG = false
const log = (args) => { if (DEBUG) {console.log(args)}}


// The script randomly chooses from this list of
// users. If a list if users is passed as a 
// parameter on the widget configuration screen,
// it uses those instead. The list of users in the 
// configuration screen must be comma-separated
const USERS = [
  'beautifuldestinations',
  'natgeotravel',
  'igersmanila',
  'cntraveler',
  'the_philippines',
  'nasachandraxray'
]

// stuff to display at the bottom of the widget
const SHOW_USERNAME = true
const SHOW_LIKES    = true
const SHOW_COMMENTS = true

// pick up to 12 of the most recent posts and
// select randomly between those. 
const MAX_RECENT_POSTS  = 12

// desired interval in minutes to refresh the
// widget. This will only tell IOS that it's
// ready for a refresh, whether it actually 
// refreshes is up to IOS
const REFRESH_INTERVAL = 5 //mins


// DO NOT EDIT BEYOND THIS LINE ------------------

// InstagramClient module ------------------------
// const InstagramClient = importModule('InstagramClient')
// EMBED 
const InstagramClient = {
  //----------------------------------------------
  initialize() {
    
    this.USES_ICLOUD =  module.filename.includes('Documents/iCloud~')
    this.fm = this.USES_ICLOUD ? FileManager.iCloud() : FileManager.local()

    // track the number of login attempts
    // so we don't get an infinite login screen
    this.loginAttempts = 0
    this.MAX_ATTEMPTS = 2
    
    this.root = this.fm.joinPath(this.fm.documentsDirectory(),  '/cache/igclient')
    this.fm.createDirectory(this.root, true)

    this.sessionPath = this.fm.joinPath(this.root, 'session.json')

    this.sessionid = ''
    
  },
  //----------------------------------------------
  async authenticate() {
  
    let url = 'https://instagram.com/'
    let req = new Request(url)
    await req.load()
    let result = {}
    req.response.cookies.forEach(cookie => {
      if (cookie.name == 'sessionid') {
          result.sessionid = cookie.value; 
          result.expiresDate = cookie.expiresDate
        }
    })
    if (!result.sessionid) {
      if (this.loginAttempts < this.MAX_ATTEMPTS) {
        this.loginAttempts++;

        var resp = await this.presentAlert("You will now be presented with the Instagram login window.\nAuthentication happens on the Instagram website and your credentials will neither be captured nor stored.", ["Proceed", "Cancel"])

        if (resp==1) {
          this.loginAttempts = this.MAX_ATTEMPTS
          throw new Error("login was cancelled")
          return
        } 
        
        let webview = new WebView()
        await webview.loadURL(url)
        await webview.present(false)

        return await this.authenticate()
        
      } else {
        throw new Error('Maximum number of login attempts reached. Please launch the script again.')
      }
    } else {
      await this.saveSession(result)
      this.sessionid = result.sessionid
      return result
    }
  },
  //----------------------------------------------
	async logout() {

    log(`session exists - ${this.fm.fileExists(this.sessionPath)}`)
		if (this.fm.fileExists(this.sessionPath)) {
      log('deleting session file')
      await this.fm.remove(this.sessionPath)
    }

    log('logging out')
    var url = 'https://www.instagram.com/accounts/logout'
    let webview = new WebView()
    await webview.loadURL(url)
    //await webview.present(false)
  },
  //----------------------------------------------
  async startSession() {
    var sessionCache = await this.readSession()
    
    if (sessionCache) {
      log(`cached sessionid ${sessionCache.sessionid}`)
      log(`session expires on ${new Date(sessionCache.expiresDate)}`)
    }  
    
    if (!sessionCache || new Date() >= new Date(sessionCache.expiresDate)) { 
      log('refreshing session cache'); 
      sessionCache = await this.authenticate() 
    } 
    if (sessionCache) {
      this.sessionid = sessionCache.sessionid
      return InstagramClient
    } else {
      return null
    }
  },
  //----------------------------------------------
  async fetchData(url) {
    log(`fetching ${url}`)
    let req = new Request(url)
    req.headers = {
      Cookie: `sessionid=${this.sessionid}`
    }
    try {
      var response = await req.loadJSON()
      return response
    } catch (e) {
      throw new Error(e.message)
    }
  },
  //----------------------------------------------
  async getUserInfo(username) {
    const url = `https://www.instagram.com/${username}/?__a=1`
    const response = await this.fetchData(url)
    
    if (Object.keys(response).length == 0) {
      throw new Error(`Invalid user - ${username}`)
    }
    
    var user = response.graphql.user
    return user
  },
  //----------------------------------------------
  async getPostInfo(shortcode) {
    const url = `https://www.instagram.com/p/${shortcode}/?__a=1`
    const response = await this.fetchData(url)
    
    if (Object.keys(response).length == 0) {
      throw new Error(`Invalid post`)
    }
    
    return response
  },
  //----------------------------------------------
  async readSession() {
    if (this.fm.fileExists(this.sessionPath)) {
      if (this.USES_ICLOUD) {
        await this.fm.downloadFileFromiCloud(this.sessionPath)
      }
      let result = await this.fm.read(this.sessionPath)
      if (!result || !result.toRawString()) return undefined
      else return JSON.parse(result.toRawString())
    }
    return undefined
  },
  //----------------------------------------------
  async saveSession(json) {
    if (this.fm.fileExists(this.sessionPath)) {
      if (this.USES_ICLOUD) {
        await this.fm.downloadFileFromiCloud(this.sessionPath)
      }
    }
    await this.fm.writeString(this.sessionPath, JSON.stringify(json))
  },
  //----------------------------------------------
  async presentAlert(prompt="", items=["OK"], asSheet=false) {
    let alert = new Alert()
    alert.message = prompt
    for (var n=0; n<items.length;n++) {
      alert.addAction(items[n])
    }
    let resp = asSheet ? await alert.presentSheet() : await alert.presentAlert()
    return resp
  }

}
// InstagramClient module ends -------------------




// Wisget code -----------------------------------

InstagramClient.initialize()

// only show the staus line is any of the
// status items are visible
const SHOW_STATUS_LINE = SHOW_USERNAME || 
                          SHOW_LIKES || 
                          SHOW_COMMENTS

// get usernames from the arguments if passed
let usernames = args.widgetParameter || USERS.join(',')
usernames = usernames.split(',')

// choose a random username and fetch for the user
// information
const username = getRandom(usernames)
const post = await getLatestPost(username, 
                                MAX_RECENT_POSTS)

if (config.runsInWidget) {
  let widget = post.has_error ? 
    await createErrorWidget(post) :
    await createWidget(post)
  Script.setWidget(widget)
} else {

  const options = ['Small', 'Medium', 'Large', 'Cancel']
  let resp = await presentAlert('Preview Widget', options)
  if (resp==options.length-1) return
  let size = options[resp]
  let widget = post.has_error ? 
    await createErrorWidget(post) :
    await createWidget(post, size.toLowerCase())
  
  await widget[`present${size}`]()
}

Script.complete() 
//------------------------------------------------
async function createWidget(data, widgetFamily) {
  
  widgetFamily = widgetFamily || config.widgetFamily
  const padd = widgetFamily=='large' ? 12 : 10
  const fontSize = widgetFamily=='large' ? 14 : 10

  const img = await download('Image', data.display_url)
  const url = `https://www.instagram.com/p/${data.shortcode}`

  const widget = new ListWidget()

  var refreshDate = Date.now() + 1000*60*REFRESH_INTERVAL
  widget.refreshAfterDate = new Date(refreshDate)

  widget.url = url
  widget.setPadding(padd,padd,padd,padd)
  widget.backgroundImage = img

  if (SHOW_STATUS_LINE) {

    // add gradient with a semi-transparent 
    // dark section at the bottom. this helps
    // with the readability of the status line
    widget.backgroundGradient = newLinearGradient(
      ['#ffffff00','#ffffff00','#00000088'],
      [0,.75,1])

    // top spacer to push the bottom stack down
    widget.addSpacer()

    // horizontal stack to hold the status line
    const stats = widget.addStack()
    stats.layoutHorizontally()
    stats.centerAlignContent()
    stats.spacing = 3

    if (SHOW_USERNAME) {
      const eUsr = addText(stats, `@${data.username}`,'left', fontSize)
    }
    // center spacer to push items to the sides
    stats.addSpacer()
    if (SHOW_LIKES) {
      const heart = addSymbol(stats, 'heart.fill', fontSize)
      const likes = abbreviateNumber(data.likes)
      const eLikes = addText(stats, likes, 'right', fontSize)
    }
    if (SHOW_COMMENTS) {
      const msg = addSymbol(stats, 'message.fill', fontSize)
      const comments = abbreviateNumber(data.comments)
      const eComm = addText(stats, comments, 'right', fontSize)
    }

  }

  return widget
  
}
//------------------------------------------------
function addSymbol(container, name, size) {
  const sfIcon = SFSymbol.named(name)
  const fIcon = sfIcon.image
  const icon = container.addImage(fIcon)
  icon.tintColor = Color.white()
  icon.imageSize = new Size(size,size)
  return icon
}
//------------------------------------------------
function addText(container, text, align, size) {
  const txt = container.addText(text)
  txt[`${align}AlignText`]()
  txt.font = Font.systemFont(size)
  txt.shadowRadius = 3
  txt.textColor = Color.white()
  txt.shadowColor = Color.black()   
}

//------------------------------------------------
function getRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}
//------------------------------------------------
function newLinearGradient(hexcolors, locations) {
  let gradient = new LinearGradient()
  gradient.locations = locations
  gradient.colors = hexcolors
                     .map(color=>new Color(color))
  return gradient
}
//------------------------------------------------
async function createErrorWidget(data) {
  const widget = new ListWidget()
  widget.addSpacer()
  const text = widget.addText(data.message) 
  log(data.message)
  text.textColor = Color.white()
  text.centerAlignText()
  widget.addSpacer()
  return widget
}
//------------------------------------------------
async function download(dType, url) {
  const req = new Request(url)
  return await req[`load${dType}`](url)
}
//------------------------------------------------
async function getLatestPost(username, maxRecent) {
  
  try {
    var igSession = await InstagramClient.startSession()
  } catch (e) {
    log(`error encountered - ${e.message}`)
    return {
      has_error: true,
      message: e.message
    }
    
  }
  try {
    var user = await InstagramClient.getUserInfo(username)
    log(`user`)
  } catch(e) {
    log(`error encountered - ${e.message}`)
    return {
      has_error: true,
      message: e.message
    }
  }

  
  if (user.is_private && !user.followed_by_viewer) { 
    return {
      has_error: true,
      message: `not following user\n${username}`
    }  
  }

  maxRecent = maxRecent > 12 ? 12 : maxRecent
  let idx = Math.floor(Math.random() * maxRecent)

  var visible_posts = user.edge_owner_to_timeline_media.edges.length-1

  idx =  visible_posts < idx ? visible_posts : idx

  const rec = user.edge_owner_to_timeline_media.edges[idx].node
  
  try {
    var resp = await InstagramClient.getPostInfo(rec.shortcode)
    log(resp)
  } catch(e) {
    log(`error encountered when getting post - ${e.message}`)
    return {
      has_error: true,
      message: e.message
    }
  }

  const post = resp.graphql.shortcode_media;

  let media_url = post.display_url
  if (post.hasOwnProperty('display_resources')) {
    log('has hi-res versions')
    media_url = post.display_resources[post.display_resources.length-1].src
  }
   
  return {
    has_error: false,
    username: username,
    shortcode: post.shortcode,
    display_url: media_url,
    is_video: post.is_video,
    comments: post.edge_media_preview_comment.count,
    likes: post.edge_media_preview_like.count
  }
}
//------------------------------------------------
async function presentAlert(prompt,items,asSheet) 
{
  let alert = new Alert()
  alert.message = prompt
  
  for (const item of items) {
    alert.addAction(item)
  }
  let resp = asSheet ? 
    await alert.presentSheet() : 
    await alert.presentAlert()
  return resp
}
//------------------------------------------------
// found on : https://stackoverflow.com/a/32638472
// thanks @D.Deriso
function abbreviateNumber(num, fixed) {
  
  if (num === null) { return null; } // terminate early
  if (num === 0) { return '0'; } // terminate early
  fixed = (!fixed || fixed < 0) ? 0 : fixed; // number of decimal places to show
  var b = (num).toPrecision(2).split("e"), // get power
      k = b.length === 1 ? 0 : Math.floor(Math.min(b[1].slice(1), 14) / 3), // floor at decimals, ceiling at trillions
      c = k < 1 ? num.toFixed(0 + fixed) : (num / Math.pow(10, k * 3) ).toFixed(1 + fixed), // divide by power
      d = c < 0 ? c : Math.abs(c), // enforce -0 is 0
      e = d + ['', 'K', 'M', 'B', 'T'][k]; // append power
  return e;
}