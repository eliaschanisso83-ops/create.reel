import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMP_DIR = path.join(os.tmpdir(), 'image2video-lite');
fs.mkdirSync(TEMP_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, TEMP_DIR),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${uuidv4()}-${file.originalname}`)
  }),
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

    const musicFile = req.files?.music?.[0]?.path || null;
    const jobId = uuidv4();
    const outputFileName = `image2video-${Date.now()}-${jobId}.mp4`;
    const outputPath = path.join(TEMP_DIR, outputFileName);

    const job = {
      id: jobId,
      status: 'queued',
      progress: 0,
      message: 'Na fila para processamento',
      outputFileName,
      outputPath,
      tempFiles: [...images.map((file) => file.path), ...(musicFile ? [musicFile] : [])],
      createdAt: Date.now(),
      cleanupTimeout: null
    };

    jobs.set(jobId, job);
    queue.push({ job, images, duration, transition, resolution, template, musicFile });
    processQueue();

    res.json({ jobId, estimatedSeconds: Math.ceil(totalDuration + 5), message: 'Seu vídeo foi adicionado à fila.' });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Erro no servidor' });
  }
});

app.get('/api/status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job não encontrado' });
  res.json({ status: job.status, progress: job.progress, message: job.message, downloadUrl: job.status === 'done' ? `/api/download/${job.id}` : null });
});

app.get('/api/download/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || job.status !== 'done') return res.status(404).json({ error: 'Arquivo não disponível' });
  res.download(job.outputPath, job.outputFileName, (err) => {
    if (err) console.error('Erro ao enviar arquivo:', err);
  });
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
  const { job, images, duration, transition, resolution, template, musicFile } = task;

  job.status = 'processing';
  job.progress = 10;
  job.message = 'Processando vídeo...';

  renderVideo({ job, images, duration, transition, resolution, template, musicFile })
    .then(() => {
      job.status = 'done';
      job.progress = 100;
      job.message = 'Vídeo pronto para download';
      job.cleanupTimeout = setTimeout(() => cleanupJob(job.id), 10 * 60 * 1000);
    })
    .catch((err) => {
      job.status = 'error';
      job.progress = 0;
      job.message = `Erro: ${err.message}`;
    })
    .finally(() => {
      processing = false;
      processQueue();
    });
}

async function renderVideo({ job, images, duration, transition, resolution, template, musicFile }) {
  const size = getVideoSize(resolution, template);
  const ffmpegArgs = buildFfmpegArgs({ images, duration, transition, size, musicFile, outputPath: job.outputPath });

  await new Promise((resolve, reject) => {
    const command = process.platform === 'win32' ? 'ffmpeg' : 'nice';
    const args = process.platform === 'win32' ? ffmpegArgs : ['-n', '10', 'ffmpeg', ...ffmpegArgs];
    const proc = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    proc.stderr.on('data', () => {
      job.progress = Math.min(90, job.progress + 3);
    });

    proc.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`FFmpeg finalizou com código ${code}`));
    });
  });
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
  const job = jobs.get(jobId);
  if (!job) return;
  if (job.cleanupTimeout) clearTimeout(job.cleanupTimeout);

  [...(job.tempFiles || []), job.outputPath].forEach((filePath) => {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });
  jobs.delete(jobId);
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend rodando em http://localhost:${PORT}`);
});
