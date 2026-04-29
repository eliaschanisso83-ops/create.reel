# 🎬 Guia de Teste - Create Reel

## Status Atual ✅

- ✅ **Backend**: Rodando em `http://localhost:3000`
- ✅ **Frontend**: Rodando em `http://localhost:5173`
- ✅ **Supabase Edge Function**: `storage-access-helper` pronta
- ✅ **Banco de dados**: Tables criadas (`jobs`, `buckets`)
- ⚠️ **FFmpeg**: Necessário para produção (Vercel já tem instalado)

---

## Como Testar Localmente

### 1️⃣ Iniciar o projeto
```bash
cd /workspaces/create.reel

# Modo 1: Rodar ambos em paralelo
npm run dev

# Modo 2: Rodar cada um em um terminal
# Terminal 1:
npm run dev:backend

# Terminal 2:
npm run dev:frontend
```

### 2️⃣ Abrir o app
Acesse: **http://localhost:5173**

### 3️⃣ Testar fluxo de vídeo

#### **Passo A: Carregar imagens**
- Clique na área de "Arraste e solte" ou selecione arquivos
- Carregue 2-5 imagens (máximo 10)
- Você verá um preview de cada imagem

#### **Passo B: Configurar parâmetros**
- **Duração por imagem**: Entre 2-10 segundos
- **Transição**: Fade ou Slide
- **Resolução**: 480p, 720p ou 1080p
- **Template**: Padrão, Story ou Produto
- **Música** (opcional): Carregar arquivo MP3/WAV

#### **Passo C: Gerar vídeo**
- Clique no botão **"Gerar vídeo"**
- O status mudará: `uploading` → `queued` → `processing` → `completed`
- Uma barra de progresso aparecerá
- Quando pronto, o vídeo será baixado automaticamente

---

## Fluxo Técnico Behind the Scenes

```
1. Frontend envia imagens/música → Backend
2. Backend faz upload → Supabase Storage
3. Backend cria Job → Supabase DB (status: queued)
4. Backend processa fila (FFmpeg) → Gera MP4
5. Backend faz upload do vídeo → Supabase Storage
6. Backend atualiza Job → status: done
7. Frontend consulta status periodicamente
8. Quando done → Exibe link de download
```

---

## Troubleshooting

### ❌ Backend não inicia
```
Erro: "FFmpeg não encontrado"
✅ Solução: Normal em desenvolvimento. Em Vercel já vem instalado.
```

### ❌ Frontend não carrega
```
Erro: "Cannot POST /api/render"
✅ Solução: Verifique se backend está rodando em http://localhost:3000
Verifique VITE_API_URL em frontend/.env.local
```

### ❌ Erro ao fazer upload
```
Erro: "Erro ao fazer upload da imagem"
✅ Solução: Verifique SUPABASE_URL e SUPABASE_ANON_KEY
Verifique se bucket "uploads" existe no Supabase
```

### ❌ Vídeo não gera (mesmo com FFmpeg)
```
Pode ser: Política de Storage muito restritiva
✅ Solução: Run supabase-setup.sql para configurar policies
```

---

## Deploy em Produção

### Frontend (Vercel)
```bash
npm run build   # Build otimizado
# Deploy automático ao pushar para main
```

### Backend (Vercel, Railway, Fly.io, etc)
```bash
# Variáveis necessárias:
- SUPABASE_URL
- SUPABASE_ANON_KEY
- NODE_ENV=production (ativa check de FFmpeg)
```

> 💡 **Dica**: Vercel já tem FFmpeg instalado, então o backend funcionará sem problemas lá!

---

## Arquivos Criados/Modificados

### Frontend
- ✅ `frontend/.env.local` - Variáveis de ambiente Supabase
- ✅ `frontend/src/supabaseClient.js` - Cliente Supabase
- ✅ `frontend/src/useStorageUrl.js` - Hook para gerar URLs seguras

### Backend
- ✅ `backend/.env` - Configuração Supabase
- ✅ `backend/index.js` - FFmpeg check agora é apenas em produção

---

## Arquivos de Referência

- [Supabase Setup](../supabase-setup.sql) - Script SQL para criar banco
- [Vercel Config Frontend](./frontend/vercel.json)
- [Vercel Config Geral](./vercel.json)

---

**Dúvidas? Verifique os logs do terminal onde está rodando backend/frontend!** 🚀
