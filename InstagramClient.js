// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: purple; icon-glyph: camera-retro;

/* -----------------------------------------------
Script      : InstagramClient.js
Author      : me@supermamon.com
Version     : 1.0.0
Description :
  A scriptable module that can be used to access 
  Instagram

  Largely inspired from 
    github.com/wiebecommajonas/instagram-widget

Changelog:
v1.0.0 - Initial release
----------------------------------------------- */

const DEBUG = false
var log = (args) => {if (DEBUG) console.log(args)}
//------------------------------------------------

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
    if (req.response.cookies) {
      if (Array.isArray(req.response.cookies)) {
        req.response.cookies.forEach(cookie => {
          if (cookie.name == 'sessionid') {
              result.sessionid = cookie.value; 
              result.expiresDate = cookie.expiresDate
              result.cookies = req.response.cookies
            }
        })
    
      } 
    }
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
      result.cookies = req.response.cookies
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
    var cookies = await this.getCookies()
    log(cookies)
    req.headers = {
      Cookie: `${cookies}`
    }
    try {
      //var response = await req.loadJSON()
      var response = await req.loadString()
      log(response)
      response = JSON.parse(response)
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
    log('reading session')
    if (this.fm.fileExists(this.sessionPath)) {
      log(`file found`)
      if (this.USES_ICLOUD) {
        await this.fm.downloadFileFromiCloud(this.sessionPath)
      }
      log(`reading session file`)
      let result = await this.fm.read(this.sessionPath)
      if (!result || !result.toRawString()) {
        log(`error reading file`)
        return undefined
      } else {
        var session = JSON.parse(result.toRawString())
        //log(this.session)
        return session
      }
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
  async getCookies() {
    var session = await this.readSession() 
    log(session)
    var cookies = session.cookies.map( cookie => {
      log(`adding cookie ${cookie.name}`)
      return `${cookie.name}=${cookie.value}`
    }).join(';')
    log(`returning cookies = ${cookies}`)
    return cookies
    
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

//------------------------------------------------
module.exports = InstagramClient

//------------------------------------------------
// test
const module_name = module.filename.match(/[^\/]+$/)[0].replace('.js','')
if (module_name == Script.name()) {

  await (async ()=>{

    InstagramClient.initialize()
    //InstagramClient.logout()
    await InstagramClient.startSession()
    try {
      var usr = await InstagramClient.getUserInfo('calsnape')
      log(usr.username)
    } catch(e) {
      log(e.message) 
    }
  
  })()

}
