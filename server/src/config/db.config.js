import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

export const connectToDB = async () => {
    try {
        let connection = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
        console.log(`MONGODB connected !!! Host : ${connection.connection.host}`);
    } catch (error) {
        console.log("MONGODB connection FAILED : " + error.message);
        // process.exit(1);
        throw error;
    }
}