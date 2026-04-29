import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { spawn } from 'child_process';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const TEMP_DIR = path.join(os.tmpdir(), 'image2video-lite');
fs.mkdirSync(TEMP_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(), // Use memory storage for Supabase upload
  fileFilter: (req, file, cb) => {
    const imageTypes = /jpeg|jpg|png/;
    const audioTypes = /mp3|mpeg|wav|ogg/;
    if (file.fieldname === 'images' && imageTypes.test(file.mimetype)) return cb(null, true);
    if (file.fieldname === 'music' && audioTypes.test(file.mimetype)) return cb(null, true);
    cb(new Error('Tipo de arquivo não suportado'));
  },
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

const jobs = new Map();
const queue = [];
let processing = false;

const DURATION_LIMIT = 30;
const MAX_IMAGES = 10;
const TRANSITION_DURATION = 1;
const FPS = 24;


app.post('/api/render', upload.fields([{ name: 'images', maxCount: 10 }, { name: 'music', maxCount: 1 }]), async (req, res) => {
  try {
    const images = req.files?.images || [];
    if (images.length === 0) return res.status(400).json({ error: 'Envie pelo menos uma imagem.' });
    if (images.length > MAX_IMAGES) return res.status(400).json({ error: `Máximo de ${MAX_IMAGES} imagens por vídeo.` });

    const duration = Number(req.body.duration) || 3;
    const transition = ['fade', 'slide'].includes(req.body.transition) ? req.body.transition : 'fade';
    const resolution = ['480p', '720p', '1080p'].includes(req.body.resolution) ? req.body.resolution : '720p';
    const template = ['standard', 'story', 'product'].includes(req.body.template) ? req.body.template : 'standard';
    const totalDuration = duration * images.length;
    if (totalDuration > DURATION_LIMIT) return res.status(400).json({ error: `A duração total não pode ultrapassar ${DURATION_LIMIT}s.` });
    if (duration <= TRANSITION_DURATION) return res.status(400).json({ error: 'Defina duração maior que a transição.' });

    const jobId = uuidv4();

    // Upload images to Supabase Storage
    const imageUrls = [];
    for (const image of images) {
      const fileName = `${jobId}/images/${Date.now()}-${uuidv4()}-${image.originalname}`;
      const { data, error } = await supabase.storage.from('uploads').upload(fileName, image.buffer, {
        contentType: image.mimetype,
        upsert: false
      });
      if (error) throw new Error(`Erro ao fazer upload da imagem: ${error.message}`);
      const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
      imageUrls.push(urlData.publicUrl);
    }

    // Upload music if present
    let musicUrl = null;
    if (req.files?.music?.[0]) {
      const music = req.files.music[0];
      const fileName = `${jobId}/music/${Date.now()}-${uuidv4()}-${music.originalname}`;
      const { data, error } = await supabase.storage.from('uploads').upload(fileName, music.buffer, {
        contentType: music.mimetype,
        upsert: false
      });
      if (error) throw new Error(`Erro ao fazer upload da música: ${error.message}`);
      const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
      musicUrl = urlData.publicUrl;
    }

    // Save job to database
    const { data: jobData, error: dbError } = await supabase
      .from('jobs')
      .insert({
        id: jobId,
        status: 'queued',
        progress: 0,
        message: 'Na fila para processamento',
        image_urls: imageUrls,
        music_url: musicUrl,
        duration,
        transition,
        resolution,
        template,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (dbError) throw new Error(`Erro ao salvar job: ${dbError.message}`);

    jobs.set(jobId, jobData);
    queue.push({ job: jobData, images: imageUrls, duration, transition, resolution, template, musicUrl });
    processQueue();

    res.json({ jobId, estimatedSeconds: Math.ceil(totalDuration + 5), message: 'Seu vídeo foi adicionado à fila.' });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Erro no servidor' });
  }
});

app.get('/api/status/:jobId', async (req, res) => {
  try {
    const { data: job, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', req.params.jobId)
      .single();

    if (error || !job) return res.status(404).json({ error: 'Job não encontrado' });

    res.json({
      status: job.status,
      progress: job.progress,
      message: job.message,
      downloadUrl: job.status === 'done' ? job.output_url : null
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao consultar status' });
  }
});

app.get('/api/download/:jobId', async (req, res) => {
  try {
    const { data: job, error } = await supabase
      .from('jobs')
      .select('output_url')
      .eq('id', req.params.jobId)
      .eq('status', 'done')
      .single();

    if (error || !job || !job.output_url) return res.status(404).json({ error: 'Arquivo não disponível' });

    res.redirect(job.output_url);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao baixar arquivo' });
  }
});

app.use((err, req, res, next) => {
  if (err) {
    res.status(400).json({ error: err.message || 'Falha no upload' });
  } else {
    next();
  }
});

function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;
  const task = queue.shift();
  const { job, images, duration, transition, resolution, template, musicUrl } = task;

  // Update job status in database
  supabase.from('jobs').update({
    status: 'processing',
    progress: 10,
    message: 'Processando vídeo...'
  }).eq('id', job.id);

  renderVideo({ job, images, duration, transition, resolution, template, musicUrl })
    .then(async (outputUrl) => {
      // Update job as done
      await supabase.from('jobs').update({
        status: 'done',
        progress: 100,
        message: 'Vídeo pronto para download',
        output_url: outputUrl
      }).eq('id', job.id);

      // Cleanup after 10 minutes
      setTimeout(() => cleanupJob(job.id), 10 * 60 * 1000);
    })
    .catch(async (err) => {
      await supabase.from('jobs').update({
        status: 'error',
        progress: 0,
        message: `Erro: ${err.message}`
      }).eq('id', job.id);
    })
    .finally(() => {
      processing = false;
      processQueue();
    });
}

async function renderVideo({ job, images, duration, transition, resolution, template, musicUrl }) {
  const size = getVideoSize(resolution, template);
  const tempFiles = [];
  const localImages = [];

  try {
    // Download images to temp files
    for (let i = 0; i < images.length; i++) {
      const response = await fetch(images[i]);
      const buffer = await response.arrayBuffer();
      const tempPath = path.join(TEMP_DIR, `${job.id}-image-${i}.jpg`);
      fs.writeFileSync(tempPath, Buffer.from(buffer));
      localImages.push({ path: tempPath });
      tempFiles.push(tempPath);
    }

    let localMusic = null;
    if (musicUrl) {
      const response = await fetch(musicUrl);
      const buffer = await response.arrayBuffer();
      const tempPath = path.join(TEMP_DIR, `${job.id}-music.mp3`);
      fs.writeFileSync(tempPath, Buffer.from(buffer));
      localMusic = tempPath;
      tempFiles.push(tempPath);
    }

    const outputPath = path.join(TEMP_DIR, `output-${job.id}.mp4`);
    tempFiles.push(outputPath);

    const ffmpegArgs = buildFfmpegArgs({ images: localImages, duration, transition, size, musicFile: localMusic, outputPath });

    await new Promise((resolve, reject) => {
      const command = process.platform === 'win32' ? 'ffmpeg' : 'nice';
      const args = process.platform === 'win32' ? ffmpegArgs : ['-n', '10', 'ffmpeg', ...ffmpegArgs];
      const proc = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });

      proc.stderr.on('data', () => {
        // Update progress in database
        supabase.from('jobs').update({
          progress: Math.min(90, job.progress + 3)
        }).eq('id', job.id);
      });

      proc.on('close', (code) => {
        if (code === 0) return resolve();
        reject(new Error(`FFmpeg finalizou com código ${code}`));
      });
    });

    // Upload output video to Supabase Storage
    const outputFileName = `videos/${job.id}.mp4`;
    const videoBuffer = fs.readFileSync(outputPath);
    const { data, error } = await supabase.storage.from('uploads').upload(outputFileName, videoBuffer, {
      contentType: 'video/mp4',
      upsert: true
    });
    if (error) throw new Error(`Erro ao fazer upload do vídeo: ${error.message}`);

    const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(outputFileName);
    return urlData.publicUrl;

  } finally {
    // Cleanup temp files
    tempFiles.forEach(file => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });
  }
}

function getVideoSize(resolution, template) {
  const sizes = {
    '480p': { width: 854, height: 480, portrait: { width: 480, height: 854 } },
    '720p': { width: 1280, height: 720, portrait: { width: 720, height: 1280 } },
    '1080p': { width: 1920, height: 1080, portrait: { width: 1080, height: 1920 } }
  };
  const base = sizes[resolution] || sizes['720p'];
  if (template === 'story') return base.portrait;
  return base;
}

function buildFfmpegArgs({ images, duration, transition, size, musicFile, outputPath }) {
  const inputs = [];
  const filters = [];
  const streamLabels = [];
  const transitionType = transition === 'slide' ? 'slideleft' : 'fade';

  images.forEach((image, index) => {
    inputs.push('-loop', '1', '-t', String(duration), '-i', image.path);
    streamLabels.push(`[s${index}]`);
    filters.push(`[${index}:v]scale=${size.width}:${size.height}:force_original_aspect_ratio=decrease,pad=${size.width}:${size.height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1${streamLabels[index]}`);
  });

  let filterComplex = filters.join(';');

  if (images.length === 1) {
    filterComplex += `;${streamLabels[0]}format=yuv420p[video]`;
  } else {
    let lastLabel = streamLabels[0];
    for (let i = 1; i < streamLabels.length; i += 1) {
      const nextLabel = streamLabels[i];
      const outputLabel = i === streamLabels.length - 1 ? '[video]' : `[xf${i - 1}]`;
      const offset = duration * i - TRANSITION_DURATION * i;
      filterComplex += `;${lastLabel}${nextLabel}xfade=transition=${transitionType}:duration=${TRANSITION_DURATION}:offset=${offset}${outputLabel}`;
      lastLabel = outputLabel;
    }
    filterComplex += `;[video]format=yuv420p[video]`;
  }

  if (musicFile) {
    inputs.push('-i', musicFile);
  }

  const args = [...inputs, '-filter_complex', filterComplex, '-map', '[video]', '-r', String(FPS), '-preset', 'veryfast', '-crf', '26'];
  if (musicFile) {
    args.push('-map', `${images.length}:a`, '-c:a', 'aac', '-b:a', '128k', '-shortest');
  }

  args.push('-movflags', '+faststart', outputPath);
  return args;
}

function cleanupJob(jobId) {
  // Remove uploaded files from Supabase Storage
  supabase.storage.from('uploads').remove([`videos/${jobId}.mp4`]);
  // Optionally remove images and music if not needed
  // For now, keep them for potential reuse or manual cleanup
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend rodando em http://localhost:${PORT}`);
});
