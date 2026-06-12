import dotenv from 'dotenv';
dotenv.config();

import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);
import {connectToDB} from './src/config/db.config.js'
import app from './src/app.js';
import { startRankTrackingCron } from './src/cron/rankTracking.cron.js';

const port = process.env.PORT || 3000;

connectToDB()
  .then(() => {
    app.on('error', (err) => {
      console.log('Error: ' + err.message);
      throw err;
    });

    startRankTrackingCron()

    // console.log(process.env.PORT);
    app.listen(8080, () => {
      console.log(`Example app listening on port ${8080}`);
    });
  })
  .catch(err => {
    console.log('MONGODB connection FAILED: ', err);
  })