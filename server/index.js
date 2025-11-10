const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https'); // Using built-in HTTPS module
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = 5000;

// Supabase setup
const supabase = createClient(
  'https://xnkqdqbowjbjlwkonyxi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhua3FkcWJvd2piamx3a29ueXhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0OTk4OTYsImV4cCI6MjA3ODA3NTg5Nn0.luIYqoj99Cdw9YnCJppWyKhDPtD5y1H-nR7-bffU3zE'
);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Create uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// File upload setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed!'), false);
    }
  }
});

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Speech-to-Text Server Running with DeepGram!' });
});

// Get all transcriptions from database
app.get('/api/transcriptions', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('transcriptions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload and transcribe route - USING DEEPGRAM
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    console.log('📥 Upload request received');
    
    if (!req.file) {
      console.log('❌ No file in request');
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    console.log('✅ File uploaded:', req.file.filename, 'Size:', req.file.size, 'bytes');

    // STEP 1: Transcribe with DeepGram
    console.log('🎤 Transcribing with DeepGram...');
    const transcription = await transcribeWithDeepGram(req.file.path);
    console.log('✅ Transcription completed:', transcription);

    // STEP 2: Save to Supabase
    console.log('🔄 Saving to Supabase...');
    let savedId = null;
    try {
      const { data, error } = await supabase
        .from('transcriptions')
        .insert([
          {
            audio_filename: req.file.filename,
            transcription_text: transcription,
            file_size: req.file.size
          }
        ])
        .select();

      if (error) {
        console.error('❌ Supabase insertion error:', error);
      } else {
        savedId = data[0].id;
        console.log('💾 Saved to Supabase with ID:', savedId);
      }
    } catch (supabaseError) {
      console.error('❌ Supabase save error:', supabaseError);
    }

    // STEP 3: Return success
    res.json({ 
      message: 'File transcribed successfully with DeepGram!',
      filename: req.file.filename,
      transcription: transcription,
      supabaseSaved: !!savedId,
      supabaseId: savedId
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ 
      error: 'Upload failed',
      details: error.message 
    });
  }
});

// Real DeepGram transcription function using HTTPS module
async function transcribeWithDeepGram(filePath) {
  return new Promise((resolve, reject) => {
    try {
      console.log('🔊 Reading audio file for DeepGram:', filePath);
      
      const audioBuffer = fs.readFileSync(filePath);
      const fileExt = path.extname(filePath).toLowerCase();
      let mimetype = 'audio/mpeg';
      
      if (fileExt === '.wav') mimetype = 'audio/wav';
      else if (fileExt === '.m4a') mimetype = 'audio/mp4';
      else if (fileExt === '.webm') mimetype = 'audio/webm';
      else if (fileExt === '.ogg') mimetype = 'audio/ogg';
      else if (fileExt === '.flac') mimetype = 'audio/flac';
      
      console.log('📤 Sending to DeepGram via HTTPS, MIME type:', mimetype);
      console.log('📏 File size:', audioBuffer.length, 'bytes');

      const options = {
        hostname: 'api.deepgram.com',
        port: 443,
        path: '/v1/listen',
        method: 'POST',
        headers: {
          'Authorization': 'Token 3fc06897f2438e97f28a24e2aab4fbe1afc894e2',
          'Content-Type': mimetype,
          'Content-Length': audioBuffer.length
        },
        timeout: 30000 // 30 second timeout
      };

      const req = https.request(options, (res) => {
        let data = '';
        console.log('📥 DeepGram response status:', res.statusCode);

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              console.error('❌ DeepGram API error:', res.statusCode, data);
              
              // Provide specific error messages
              if (res.statusCode === 401) {
                reject(new Error('DeepGram API key is invalid or expired'));
              } else if (res.statusCode === 403) {
                reject(new Error('DeepGram API access forbidden - check your plan'));
              } else if (res.statusCode === 429) {
                reject(new Error('DeepGram API rate limit exceeded'));
              } else {
                reject(new Error(`DeepGram API error: ${res.statusCode} - ${data}`));
              }
              return;
            }

            const result = JSON.parse(data);
            console.log('✅ DeepGram API success, response received');
            
            if (result.results?.channels?.[0]?.alternatives?.[0]?.transcript) {
              const transcription = result.results.channels[0].alternatives[0].transcript;
              const confidence = result.results.channels[0].alternatives[0].confidence || 'N/A';
              console.log('📝 Real transcription received (confidence:', confidence, '):', transcription.substring(0, 100) + '...');
              resolve(transcription);
            } else {
              console.error('❌ Unexpected DeepGram response structure:', JSON.stringify(result, null, 2));
              reject(new Error('No transcription found in DeepGram response'));
            }
          } catch (parseError) {
            console.error('❌ JSON parse error:', parseError);
            reject(new Error('Failed to parse DeepGram response'));
          }
        });
      });

      req.on('error', (error) => {
        console.error('❌ HTTPS request failed:', error);
        reject(error);
      });

      req.on('timeout', () => {
        console.error('❌ DeepGram API timeout');
        req.destroy();
        reject(new Error('DeepGram API request timeout'));
      });

      req.write(audioBuffer);
      req.end();

    } catch (error) {
      console.error('❌ Error in transcribeWithDeepGram:', error);
      reject(error);
    }
  });
}

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 50MB.' });
    }
  }
  res.status(500).json({ error: error.message });
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📁 Upload directory: ${uploadsDir}`);
  console.log(`🎤 Using DeepGram HTTPS for speech-to-text`);
  console.log(`⏰ API timeout: 30 seconds`);
});

