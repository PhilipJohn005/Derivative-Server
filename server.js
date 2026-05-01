import express from 'express';
import cors from 'cors';
import { model } from './gemini.js'
import { buildResumePrompt } from './prompts/prompt.js';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';

const app = express();

app.use(cors());
app.use(express.json());

const upload = new multer({
  storage: multer.memoryStorage()
});

app.post('/upload', upload.single('file'), async (req, res) => {

  try {

    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded'
      });
    }

    const parser = new PDFParse({
      data: req.file.buffer
    })

    const data = await parser.getText();

    res.json({
      text: data.text
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: 'PDF parsing failed'
    });

  }

});


app.post('/match', async (req, res) => {

  try {

    const { resumeText, jdText } = req.body;

    if (!resumeText || !jdText) {

      return res.status(400).json({
        error: 'Missing resume or JD'
      });

    }

    const prompt = buildResumePrompt(
      resumeText,
      jdText
    );

    const result = await model.generateContent(prompt);

    let text = result.response.text();

    // remove markdown if gemini adds it
    text = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    let parsed;

    try {

      parsed = JSON.parse(text);

    } catch (err) {

      console.error('JSON Parse Failed');
      console.error(text);

      return res.status(500).json({
        error: 'Invalid Gemini JSON response',
        raw: text
      });

    }

    res.json(parsed);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: 'Gemini failed'
    });

  }

});



// ==========================
// SERVER
// ==========================

app.listen(5000, () => {
  console.log('Server running on port 5000');
});