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
Defina no Vercel (para produção) ou localmente usando um arquivo `.env`:
- `SUPABASE_URL`: URL do seu projeto Supabase
- `SUPABASE_ANON_KEY`: Chave anônima do Supabase

Crie um arquivo `.env` a partir de `.env.example`:
```bash
cp .env.example .env
```
Preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY` no arquivo.

### 4. Executar localmente
```bash
npm run dev
```

### 5. Deploy
- Frontend: Vercel (já configurado)
- Backend: Use Railway, Fly.io ou similar para hospedar o backend Node.js

## Funcionalidades
- Upload de imagens e música
- Geração de vídeos com transições
- Armazenamento em nuvem via Supabase
- Interface web responsiva
