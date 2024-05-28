const { Telegraf } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
const AdminBro = require('admin-bro');
const AdminBroExpress = require('@admin-bro/express');
const AdminBroMongoose = require('@admin-bro/mongoose');

// Konfiguratsiya
const MONGODB_URI = 'mongodb+srv://saidaliyevjasur450:aVlkzGZyrlXDifHz@cyberworkers.1uhivew.mongodb.net/';
const BOT_TOKEN = '6522496141:AAGHwK-twlV1FyDAvgFl_iJgq-liXy439zk';
const PORT = 3000;
const allowedUsers = [1847596793]; // Foydalanuvchi ID'lari

const app = express();

// MongoDB ulanishi
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Shift modeli
const ShiftSchema = new mongoose.Schema({
  workerId: Number,
  startTime: Date,
  endTime: Date,
  late: Boolean,
  earlyLeave: Boolean
});

const Shift = mongoose.model('Shift', ShiftSchema);

// AdminBro sozlash
AdminBro.registerAdapter(AdminBroMongoose);

const adminBro = new AdminBro({
  databases: [mongoose],
  rootPath: '/admin',
});

const router = AdminBroExpress.buildRouter(adminBro);
app.use(adminBro.options.rootPath, router);

// Telegram botni sozlash
const bot = new Telegraf(BOT_TOKEN);

const workers = {
  1: { startHour: 7, endHour: 15 },
  2: { startHour: 15, endHour: 23 },
  3: { startHour: 23, endHour: 7 }
};

bot.use((ctx, next) => {
  if (allowedUsers.includes(ctx.from.id)) {
    return next();
  } else {
    return ctx.reply('Sizga bu botdan foydalanishga ruxsat berilmagan.');
  }
});

bot.start((ctx) => {
  const now = new Date();
  const currentHour = now.getHours();

  let workerId;
  if (currentHour >= 7 && currentHour < 15) {
    workerId = 1;
  } else if (currentHour >= 15 && currentHour < 23) {
    workerId = 2;
  } else {
    workerId = 3;
  }

  ctx.reply(`${workerId}-ishchi, ishga keldingizmi yoki ketmoqchimisiz? "keldim" yoki "ketdim" deb yozing.`);
});

bot.hears('keldim', async (ctx) => {
  const now = new Date();
  const currentHour = now.getHours();

  let workerId;
  if (currentHour >= 7 && currentHour < 15) {
    workerId = 1;
  } else if (currentHour >= 15 && currentHour < 23) {
    workerId = 2;
  } else {
    workerId = 3;
  }

  const shiftStart = new Date();
  shiftStart.setHours(workers[workerId].startHour, 0, 0, 0);

  if (now > shiftStart) {
    const diffMinutes = Math.floor((now - shiftStart) / 60000);
    if (diffMinutes > 10) {
      await ctx.reply(`Kech keldingiz. 50,000 so'm jarima.`);
      await new Shift({ workerId, startTime: now, late: true }).save();
    } else {
      await new Shift({ workerId, startTime: now, late: false }).save();
      await ctx.reply(`Siz vaqtida keldingiz, ishingizda muvafaqqiyat!`);
    }
  } else {
    await new Shift({ workerId, startTime: now, late: false }).save();
    await ctx.reply(`Siz vaqtida keldingiz, ishingizda muvafaqqiyat!`);
  }
});

bot.hears('ketdim', async (ctx) => {
  const now = new Date();
  const currentHour = now.getHours();

  let workerId;
  if (currentHour >= 7 && currentHour < 15) {
    workerId = 1;
  } else if (currentHour >= 15 && currentHour < 23) {
    workerId = 2;
  } else {
    workerId = 3;
  }

  const shiftEnd = new Date();
  shiftEnd.setHours(workers[workerId].endHour, 0, 0, 0);

  const lastShift = await Shift.findOne({ workerId }).sort({ startTime: -1 });

  if (lastShift && !lastShift.endTime) {
    if (now < shiftEnd) {
      const diffMinutes = Math.floor((shiftEnd - now) / 60000);
      if (diffMinutes > 10) {
        await ctx.reply(`Ishni erta tugatdingiz. 50,000 so'm jarima.`);
        lastShift.earlyLeave = true;
      }
    }
    lastShift.endTime = now;
    await lastShift.save();
    ctx.reply(`${workerId}-ishchi, siz ishdan ketdingiz.`);
  } else {
    ctx.reply(`Iltimos, avval "keldim" deb yozing.`);
  }
});

bot.launch();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
