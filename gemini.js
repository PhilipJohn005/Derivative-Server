import { GoogleGenerativeAI } from "@google/generative-ai";

const genAi = new GoogleGenerativeAI('AIzaSyAF_mcXY_3Y1wk8ACDyJAMleERDT64Ka7A');

export const model = genAi.getGenerativeModel({
    model: "gemini-2.5-flash",
});