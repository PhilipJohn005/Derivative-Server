import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { model } from './gemini.js'
import { buildResumePrompt } from './prompts/prompt.js';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

const upload = new multer({
  storage: multer.memoryStorage()
});


app.post('/send-otp',async(req,res)=>{
  try{
    const { email } = req.body;

    if(!email) {
      return res.status(400).json({
        error: 'Email Required'
      });
    }

    const otp = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    const expiresAt = new Date(
      Date.now() + 5 * 60 * 1000
    );

    await supabase
      .from('otps')
      .insert({
        email,
        otp,
        expires_at: expiresAt
      });

    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'OTP For verification',
      html: `<h1>${otp}</h1>`
    });

    res.json({
      success: true
    });

  }catch(e) {
    console.error(e);
    res.status(500).json({
      error: 'Failed to send OTP'
    });
  }
})

app.post('/verify-otp', async(req,res) =>{

  try {

    const { email, otp } = req.body;

    const { data: OtpData } = await supabase
      .from("otps")
      .select("*")
      .eq("email", email)
      .eq("otp", otp)
      .single()

    if(!OtpData) res.status(400).json({ error: 'Invalid OTP' });

    if( new Date(OtpData.expires_at) < new Date()) return res.status(400).json({ error: 'OTP Expired' });
    
    let { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single()
    
    if(!user) {
      const { data: newUser } = await supabase
        .from("users")
        .insert({
          email
        })
        .select()
        .single()
      
        user = newUser;
    }

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET);
    res.json({ token, user });

  }catch(e) {
    console.error(e);
  }

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



app.listen(5000, () => {
  console.log('Server running on port 5000');
});