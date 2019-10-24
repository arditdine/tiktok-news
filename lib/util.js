"use strict";

const get = require("lodash.get")
const request = require("superagent")
const nodemailer = require("nodemailer")

module.exports.sendMail = async ({ to, subject, html }) => {
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
};

module.exports.getResults = async url => {
  try {
    const res = await request(url);
    return get(res.body, ["body", "article_list"], []);
  } catch (ex) {
    console.log(ex);
    return [];
  }
};

module.exports.generateHTML = news => {
  let template = `<style type="text/css"> body, html, .body{background: #f3f3f3 !important;}.container.header{background: #f3f3f3;}.body-border{border-top: 8px solid #663399;}</style> <spacer size="16"></spacer> <container class="header"> <row> <columns> <h1 class="text-center">New News on TikTok Website</h1> </columns> </row> </container> <container class="body-border"> <row>`;

  for (let n of news) {
    const image = n.image ? `<center><img src="${n.image}"></center> <spacer size="16"></spacer>` : '';
    template += `<columns> <spacer size="32"></spacer> ${image} <h4><a href="${n.url}">${n.title}</a></h4> <p>${n.desc}</p><p style="color: #589ce8;">Published: ${n.date}</p></columns><hr>`;
  }
  template += `</row> <spacer size="16"></spacer> </container>`;

  return template;
};
