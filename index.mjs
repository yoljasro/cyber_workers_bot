import { Telegraf, Markup } from 'telegraf';
import LocalSession from 'telegraf-session-local';
import mongoose from 'mongoose';
import express from 'express';
import AdminJS from 'adminjs';
import * as AdminJSExpress from '@adminjs/express';
import * as AdminJSMongoose from '@adminjs/mongoose';

// Konfiguratsiya
const MONGODB_URI = 'mongodb+srv://saidaliyevjasur450:aVlkzGZyrlXDifHz@cyberworkers.1uhivew.mongodb.net/';
const BOT_TOKEN = '6522496141:AAGHwK-twlV1FyDAvgFl_iJgq-liXy439zk';
const PORT = 6000;
const allowedUsers = [1847596793 , 363452247]; // Foydalanuvchi ID'lari

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

// AdminJS sozlash
AdminJS.registerAdapter(AdminJSMongoose);

const adminJs = new AdminJS({
  resources: [{
    resource: Shift,
    options: {
      actions: {
        new: { isAccessible: false },
        delete: { isAccessible: false },
      }
    }
  }],
  rootPath: '/admin',
});

const router = AdminJSExpress.buildRouter(adminJs);
app.use(adminJs.options.rootPath, router);

// Telegram botni sozlash
const bot = new Telegraf(BOT_TOKEN);

// Sesiya middleware qo'shish
const localSession = new LocalSession({ database: 'session_db.json' });
bot.use(localSession.middleware());

const workers = {
  1: { startHour: 7, endHour: 15 },
  2: { startHour: 15, endHour: 23 },
  3: { startHour: 23, endHour: 7 }
};

const workerProfiles = {
  1: 'Birinchi admin',
  2: 'Ikkinchi admin',
  3: 'Uchinchi admin'
};

bot.use((ctx, next) => {
  if (allowedUsers.includes(ctx.from.id)) {
    return next();
  } else {
    return ctx.reply('Sizga bu botdan foydalanishga ruxsat berilmagan.');
  }
});

bot.start((ctx) => {
  const keyboard = Markup.keyboard([
    ['Birinchi admin', 'Ikkinchi admin', 'Uchinchi admin']
  ]).resize();
  ctx.reply('Qaysi profilni tanlaysiz?', keyboard);
});

Object.keys(workerProfiles).forEach(workerId => {
  bot.hears(workerProfiles[workerId], (ctx) => {
    ctx.session.workerId = parseInt(workerId);
    const keyboard = Markup.keyboard([
      ['/keldim', '/ketdim']
    ]).resize();
    ctx.reply(`Siz ${workerProfiles[workerId]} profilini tanladingiz.`, keyboard);
  });
});

bot.command('keldim', async (ctx) => {
  const now = new Date();
  const workerId = ctx.session.workerId;
  
  if (!workerId) {
    return ctx.reply('Iltimos, avval profilni tanlang.');
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

bot.command('ketdim', async (ctx) => {
  const now = new Date();
  const workerId = ctx.session.workerId;
  
  if (!workerId) {
    return ctx.reply('Iltimos, avval profilni tanlang.');
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
    ctx.reply(`${workerId}-admin, siz ishdan ketdingiz.`);
  } else {
    ctx.reply(`Iltimos, avval "keldim" deb yozing.`);
  }
});

bot.launch();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
