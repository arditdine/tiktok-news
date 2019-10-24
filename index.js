'use strict'

require('dotenv').config()

const _ = require("lodash")
const request = require("superagent")
const nodemailer = require("nodemailer")

const sqlite = require("./db")

const URLS = [
  "https://newsroom.tiktok.com/web/api/v2/project/articleList/?project_key=newsroom&category_key=en-us&limit=20&page=0&tag_names=news",
  "https://newsroom.tiktok.com/web/api/v2/project/articleList/?project_key=newsroom&category_key=en-gb&limit=20&page=0&tag_names=news",
  "https://newsroom.tiktok.com/web/api/v2/project/articleList/?project_key=newsroom&category_key=en-in&limit=20&page=0&tag_names=news",
]

const BASE_URL = "https://newsroom.tiktok.com"
const TO_EMAIL = "yingzhi.yang@thomsonreuters.com"


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

  for (let n of us) {
    const article = await sqlite.get(`SELECT ID FROM articles WHERE ARTICLE_KEY='${n.article_key}'`)
    if (!article) {
      bulk.push(`("${n.article_key}", "${n.publish_time}", "${n.update_time}")`)
      n.article_url = `${BASE_URL}/en-us/${n.article_key}`
      news.push(n)
    }
  }

  for (let n of gb) {
    const article = await sqlite.get(`SELECT ID FROM articles WHERE ARTICLE_KEY='${n.article_key}'`)
    if (!article) {
      bulk.push(`("${n.article_key}", "${n.publish_time}", "${n.update_time}")`)
      n.article_url = `${BASE_URL}/en-gb/${n.article_key}`
      news.push(n)
    }
  }

  for (let n of india) {
    const article = await sqlite.get(`SELECT ID FROM articles WHERE ARTICLE_KEY='${n.article_key}'`)
    if (!article) {
      bulk.push(`("${n.article_key}", "${n.publish_time}", "${n.update_time}")`)
      n.article_url = `${BASE_URL}/en-in/${n.article_key}`
      news.push(n)
    }
  }
  
  if (news.length){
    try{
      await sendMail({ to: TO_EMAIL, subject: "Tik Tok Website Updated", html: generateHTML(news) })

      if(bulk.length != news.length) console.log(`OOOOO, bulk ${bulk.length} - ${news.length} news!!`)

      if(bulk.length)
        await sqlite.run(`INSERT INTO articles (ARTICLE_KEY, PUBLISHT_TIME, UPDATE_TIME) VALUES ${bulk.join(",")}`)
    } catch(ex){
      console.error(ex)
    }
  }

  console.log("Finished")
})()

async function sendMail({ to, subject, html }) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_USERNAME,
      pass: process.env.SMTP_PASSWORD
    }
  });

  return await transporter.sendMail({
    from: process.env.SMTP_USERNAME,
    to,
    subject,
    html
  });
}

async function getResults(url) {
  try {
    const res = await request(url);
    return _.get(res.body, ["body", "article_list"], [])
  } catch (ex) {
    console.log(ex)
    return []
  }
}

function generateHTML(news) {
  let template = `<style type="text/css"> body, html, .body{background: #f3f3f3 !important;}.container.header{background: #f3f3f3;}.body-border{border-top: 8px solid #663399;}</style> <spacer size="16"></spacer> <container class="header"> <row> <columns> <h1 class="text-center">New News on TikTok Website</h1> </columns> </row> </container> <container class="body-border"> <row>`

  for (let n of news) {
    const image = !_.isEmpty(n.article_image)
      ? `<img src="https:${n.article_image}">`
      : null;
    template += `<columns> <spacer size="32"></spacer> <center>${image}</center> <spacer size="16"></spacer> <h4><a href="${n.article_url}">${n.article_title}</a></h4> <p>${n.article_desc}</p><p style="color: #589ce8;">Published: ${n.publish_time}</p></columns><hr>`
  }
  template += `</row> <spacer size="16"></spacer> </container>`

  return template
}
