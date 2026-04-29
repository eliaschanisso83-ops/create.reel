{
  "version": 2,
  "builds": [
    {
      "src": "frontend/package.json",
      "use": "@vercel/static-build",
      "config": { "distDir": "dist" }
    }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}# create.reel

Aplicativo para criar vídeos a partir de imagens usando FFmpeg, com frontend React e backend Node.js integrado ao Supabase.

## Configuração

### 1. Instalar dependências
```bash
npm install
npm run install:all
```

### 2. Configurar Supabase
- Crie um projeto no [Supabase](https://supabase.com)
- Execute o script `supabase-setup.sql` no SQL Editor do Supabase
- Crie um bucket chamado `uploads` no Storage do Supabase
- Configure as políticas do bucket para permitir uploads

### 3. Variáveis de ambiente

#### **Desenvolvimento Local**

Cria arquivo `.env` na raiz (ou `backend/.env` e `frontend/.env.local`):
```bash
# backend/.env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_chave_anonima
PORT=3000

# frontend/.env.local
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anonima
VITE_API_URL=http://localhost:3000/api
```

#### **Produção (Vercel)**

👉 **[Ver guia completo de configuração](VERCEL_ENV_SETUP.md)**

Adicione no Vercel → Settings → Environment Variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL` (URL do seu backend)

### 4. Executar localmente
```bash
npm run dev
```

Servidor rodará em:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3000

### 5. Deploy

#### Frontend (Vercel)
- Já configurado automaticamente
- Deploy ao pushar para `main`

#### Backend (Railway, Fly.io, etc)
- Configure as mesmas env vars na plataforma de hospedagem
- Use o comando `npm run start` para início

---

## Arquivos importantes

- [TESTING.md](TESTING.md) - Guia de teste local
- [VERCEL_ENV_SETUP.md](VERCEL_ENV_SETUP.md) - Setup de variáveis no Vercel
- [supabase-setup.sql](supabase-setup.sql) - Script SQL para banco

---

## Motivo: Se app fica em branco no Vercel

**Causa**: Variáveis de ambiente não configuradas

**Solução**: [Seguir guia VERCEL_ENV_SETUP.md](VERCEL_ENV_SETUP.md)

---

## Tecnologias

- **Frontend**: React + Vite + Supabase.js
- **Backend**: Node.js + Express + FFmpeg
- **Banco**: Supabase (PostgreSQL + Storage)
- **Deploy**: Vercel (Frontend) + Railway/Fly.io (Backend)


## Funcionalidades
- Upload de imagens e música
- Geração de vídeos com transições
- Armazenamento em nuvem via Supabase
- Interface web responsiva
