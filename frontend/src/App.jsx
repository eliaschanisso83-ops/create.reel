import { useMemo, useState, useEffect } from 'react';
import { useStorageUrl } from './useStorageUrl';
import { error as supabaseError } from './supabaseClient';

const MAX_IMAGES = 10;
const MAX_TOTAL_SECONDS = 30;
const API_BASE = import.meta.env.VITE_API_URL || '/api';

function App() {
  const [images, setImages] = useState([]);
  const [music, setMusic] = useState(null);
  const [duration, setDuration] = useState(3);
  const [transition, setTransition] = useState('fade');
  const [resolution, setResolution] = useState('720p');
  const [template, setTemplate] = useState('standard');
  const [status, setStatus] = useState(null);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [error, setError] = useState(supabaseError || '');
  const [jobId, setJobId] = useState('');

  const totalTime = useMemo(() => images.length * duration, [images, duration]);
  const canSubmit = images.length > 0 && totalTime <= MAX_TOTAL_SECONDS && images.length <= MAX_IMAGES;

  const handleFiles = (files) => {
    const selected = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (!selected.length) return;
    const nextImages = [...images, ...selected].slice(0, MAX_IMAGES);
    setError('');
    setImages(nextImages);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    handleFiles(event.dataTransfer.files);
  };

  const handleUpload = async () => {
    if (!canSubmit) {
      setError('Verifique limite de imagens e duração total.');
      return;
    }
    const formData = new FormData();
    images.forEach((file) => formData.append('images', file));
    if (music) formData.append('music', music);
    formData.append('duration', String(duration));
    formData.append('transition', transition);
    formData.append('resolution', resolution);
    formData.append('template', template);

    setStatus('uploading');
    setProgress(5);
    setError('');
    setDownloadUrl('');

    try {
      const response = await fetch(`${API_BASE}/render`, { method: 'POST', body: formData });
      const contentType = response.headers.get('content-type') || '';
      const json = contentType.includes('application/json') ? await response.json() : null;
      if (!response.ok) {
        const message = json?.error || (await response.text()) || 'Falha ao enviar';
        throw new Error(message);
      }
      setJobId(json.jobId);
      setStatus('queued');
      pollStatus(json.jobId);
    } catch (err) {
      setError(err.message);
      setStatus(null);
      setProgress(0);
    }
  };

  const pollStatus = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/status/${id}`);
      const contentType = response.headers.get('content-type') || '';
      const json = contentType.includes('application/json') ? await response.json() : null;
      if (!response.ok) {
        const message = json?.error || (await response.text()) || 'Falha ao consultar status';
        throw new Error(message);
      }
      setStatus(json.status);
      setProgress(json.progress || (json.status === 'queued' ? 20 : 50));
      if (json.status === 'done' && json.downloadUrl) {
        const downloadLink = json.downloadUrl.startsWith('http') ? json.downloadUrl : `${API_BASE}${json.downloadUrl}`;
        setDownloadUrl(downloadLink);
        setStatus('completed');
        setProgress(100);
        window.location.href = downloadLink;
        return;
      }
      if (json.status === 'error') {
        setError(json.message || 'Ocorreu um erro');
        setStatus(null);
        return;
      }
      window.setTimeout(() => pollStatus(id), 1500);
    } catch (err) {
      setError('Não foi possível atualizar o status.');
    }
  };

  return (
    <div className="app-shell">
      <header>
        <div>
          <p className="eyebrow">Image2Video Lite</p>
          <h1>Crie slideshows rápidos sem gastar CPU</h1>
        </div>
        <p className="subtitle">Envie imagens, escolha duração e transição, e baixe um MP4 leve.</p>
      </header>

      <main>
        {error && (
          <section className="error-banner">
            <strong>⚠️ Erro de Configuração:</strong> {error}
            <br />
            <small>Se você é administrador, configure as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no Vercel.</small>
          </section>
        )}

        <section className="panel drop-area" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
          <strong>Arraste e solte até {MAX_IMAGES} imagens</strong>
          <span>ou clique para selecionar</span>
          <input type="file" multiple accept="image/*" onChange={(e) => handleFiles(e.target.files)} />
        </section>

        {images.length > 0 && (
          <section className="preview-grid">
            {images.map((file, index) => (
              <div key={index} className="preview-card">
                <img src={URL.createObjectURL(file)} alt={`Preview ${index + 1}`} />
                <span>{file.name}</span>
              </div>
            ))}
          </section>
        )}

        <section className="form-grid">
          <label>
            Duração por imagem
            <input type="number" min="2" max="10" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </label>
          <label>
            Transição
            <select value={transition} onChange={(e) => setTransition(e.target.value)}>
              <option value="fade">Fade</option>
              <option value="slide">Slide</option>
            </select>
          </label>
          <label>
            Resolução
            <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
              <option value="480p">480p</option>
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
            </select>
          </label>
          <label>
            Template
            <select value={template} onChange={(e) => setTemplate(e.target.value)}>
              <option value="standard">Padrão</option>
              <option value="story">Story Instagram</option>
              <option value="product">Produto para venda</option>
            </select>
          </label>
          <label>
            Música opcional
            <input type="file" accept="audio/*" onChange={(e) => setMusic(e.target.files?.[0] || null)} />
          </label>
          <div className="summary-box">
            <strong>{images.length} imagens</strong>
            <span>Duração total: {totalTime}s</span>
            {totalTime > MAX_TOTAL_SECONDS && <span className="error-label">Máximo {MAX_TOTAL_SECONDS}s permitido</span>}
          </div>
        </section>

        <button className="primary-button" onClick={handleUpload} disabled={!canSubmit || status === 'uploading' || status === 'processing' || status === 'queued'}>
          Gerar vídeo
        </button>

        {status && (
          <section className="status-panel">
            <div className="status-line">
              <span>{status === 'queued' ? 'Job na fila' : status === 'processing' ? 'Processando' : status === 'completed' ? 'Concluído' : status}</span>
              <span>{progress}%</span>
            </div>
            <div className="progress-bar"><div style={{ width: `${progress}%` }} /></div>
          </section>
        )}

        {downloadUrl && (
          <section className="result-panel">
            <a className="download-link" href={downloadUrl}>Baixar vídeo</a>
          </section>
        )}

        {error && <p className="error-text">{error}</p>}
      </main>
    </div>
  );
}

export default App;
