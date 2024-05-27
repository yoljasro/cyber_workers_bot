import TelegramBot from 'node-telegram-bot-api';
import mongoose from 'mongoose';
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import { Database, Resource } from '@adminjs/mongoose';
import express from 'express';

// Bot tokeningizni bu yerga joylashtiring
const token = '6522496141:AAGHwK-twlV1FyDAvgFl_iJgq-liXy439zk';
const bot = new TelegramBot(token, { polling: true });

// MongoDB ulanish URL manzili
const url = 'mongodb+srv://saidaliyevjasur450:mJheljrsOnfTuKFm@cyberworkers.1uhivew.mongodb.net/';

// Asinxron funktsiya ichida kodni bajarish
async function main() {
  // MongoDBga ulanish  
  await mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });

  // Ishchi modelini yaratish
  const WorkerSchema = new mongoose.Schema({
    username: String,
    action: String,
    timestamp: Date,
    fine: Number
  });
  const Worker = mongoose.model('Worker', WorkerSchema);

  // AdminJS sozlamalari
  AdminJS.registerAdapter({ Database, Resource });
  const adminJs = new AdminJS({
    resources: [{ resource: Worker }],
    rootPath: '/admin',
  });
  const router = AdminJSExpress.buildRouter(adminJs);

  // Express serverni sozlash
  const app = express();
  app.use(adminJs.options.rootPath, router);
  app.listen(3000, () => console.log('Admin panel http://localhost:3000/admin da ishlayapti'));

  // Foydalanuvchilarni cheklash
  const allowedUsers = ['jasurbek_s7'];

  // Bot kelib-ketish vaqtlarini qayd qilish
  bot.onText(/keldim/i, async (msg) => {
    const username = msg.from.username;
    const timestamp = new Date();

    if (!allowedUsers.includes(username)) {
      return bot.sendMessage(msg.chat.id, 'Sizga bu botdan foydalanish ruxsati berilmagan.');
    }

    const shiftStart = new Date(timestamp);
    shiftStart.setMinutes(0, 0, 0);
    const lateThreshold = new Date(shiftStart);
    lateThreshold.setMinutes(10);

    const isLate = timestamp > lateThreshold;
    const fine = isLate ? 50000 : 0;

    const worker = new Worker({ username, action: 'Check-in', timestamp, fine });
    await worker.save();

    bot.sendMessage(msg.chat.id, `${username}, siz ishga keldingiz vaqtingiz: ${timestamp}. Jarima: ${fine} so'm.`);
  });

  bot.onText(/ketdim/i, async (msg) => {
    const username = msg.from.username;
    const timestamp = new Date();

    if (!allowedUsers.includes(username)) {
      return bot.sendMessage(msg.chat.id, 'Sizga bu botdan foydalanish ruxsati berilmagan.');
    }

    const worker = new Worker({ username, action: 'Check-out', timestamp, fine: 0 });
    await worker.save();

    bot.sendMessage(msg.chat.id, `${username}, siz ishdan ketyapsiz vaqtingiz: ${timestamp}.`);
  });

  console.log('Bot ishga tushdi!');
}

// Asinxron funktsiyani chaqirish
main().catch(err => console.error(err));
