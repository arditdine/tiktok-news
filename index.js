'use strict'
const get = require('lodash.get')

require('dotenv').config()

const { sendMail, getResults, generateHTML } = require('./lib/util')
const sqlite = require("./lib/db")

const URLS = [
  "https://newsroom.tiktok.com/web/api/v2/project/articleList/?project_key=newsroom&category_key=en-us&limit=20&page=0&tag_names=news",
  "https://newsroom.tiktok.com/web/api/v2/project/articleList/?project_key=newsroom&category_key=en-gb&limit=20&page=0&tag_names=news",
  "https://newsroom.tiktok.com/web/api/v2/project/articleList/?project_key=newsroom&category_key=en-in&limit=20&page=0&tag_names=news",
]

const BASE_URL = "https://newsroom.tiktok.com"
const TO_EMAIL = "ardit_dine@hotmail.com"


;(async () => {
  await sqlite.open("news.db")

  /**
   * Run only once to create the DB
   * and the index for article_key
   */

  // await sqlite.run("CREATE TABLE IF NOT EXISTS articles(ID INTEGER PRIMARY KEY AUTOINCREMENT, ARTICLE_KEY TEXT NOT NULL, PUBLISHT_TIME TEXT NOT NULL, UPDATE_TIME TEXT )");
  // await sqlite.run("CREATE INDEX article_key_index ON articles (ARTICLE_KEY)")

  const [us, gb, india] = await Promise.all(URLS.map(url => getResults(url)))

  const news = []
  const bulk = []

  // Iterrate over US news and push only new articles
  for (let n of us) {
    const article = await sqlite.get(`SELECT ID FROM articles WHERE ARTICLE_KEY='${n.article_key}'`)
    if (!article) {
      bulk.push(`("${n.article_key}", "${n.publish_time}", "${n.update_time}")`)
      news.push(etlTikTok(n, 'en-us'))
    }
  }

  // Iterrate over GB news and push only new articles
  for (let n of gb) {
    const article = await sqlite.get(`SELECT ID FROM articles WHERE ARTICLE_KEY='${n.article_key}'`)
    if (!article) {
      bulk.push(`("${n.article_key}", "${n.publish_time}", "${n.update_time}")`)
      news.push(etlTikTok(n, 'en-gb'))
    }
  }

  // Iterrate over Indian news and push only new articles
  for (let n of india) {
    const article = await sqlite.get(`SELECT ID FROM articles WHERE ARTICLE_KEY='${n.article_key}'`)
    if (!article) {
      bulk.push(`("${n.article_key}", "${n.publish_time}", "${n.update_time}")`)
      news.push(etlTikTok(n, 'en-in'))
    }
  }
  
  if (news.length){
    try{
      await sendMail({ to: TO_EMAIL, subject: "TikTok Website Updated", html: generateHTML(news) })

      if(bulk.length != news.length) console.log(`OOOOO, bulk ${bulk.length} - ${news.length} news!!`)

      if(bulk.length)
        await sqlite.run(`INSERT INTO articles (ARTICLE_KEY, PUBLISHT_TIME, UPDATE_TIME) VALUES ${bulk.join(",")}`)
    } catch(ex){
      console.error(ex)
    }

    console.log(`Finished: ${news.length} news`, new Date().toISOString())
  }else{
    console.log("Finished", new Date().toISOString())
  }

 
})()

function etlTikTok(news, lang) {
  return {
    image: news.article_image ? 'https:' + news.article_image : null,
    title: get(news, 'article_title'),
    url: `${BASE_URL}/${lang}/${news.article_key}`,
    desc: get(news, 'article_desc'),
    date: get(news, 'publish_time')
  }
}