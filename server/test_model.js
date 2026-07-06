const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function test() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent('hello');
    console.log(result.response.text());
  } catch (e) {
    console.error('Error with gemini-1.5-flash:', e.message);
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
      const result = await model.generateContent('hello');
      console.log('gemini-1.5-flash-latest works!');
    } catch (e2) {
      console.error('Error with gemini-1.5-flash-latest:', e2.message);
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const result = await model.generateContent('hello').catch(e3 => console.error('gemini-pro also failed', e3.message));
      console.log('gemini-pro works!');
    }
  }
}
test();
