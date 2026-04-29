# 🔧 Configurar Variáveis de Ambiente no Vercel

Se o app está em branco no Vercel, é porque as variáveis de ambiente não foram configuradas.

## Passos para Configurar

### 1. Abra o Vercel
- Acesse: https://vercel.com/dashboard
- Selecione seu projeto `create-reel`

### 2. Vá para Settings → Environment Variables
Clique em **"Settings"** no topo do projeto:
```
Create Reel  →  Settings  →  Environment Variables
```

### 3. Adicione as variáveis

Clique em **"Add New"** e adicione:

#### **Variável 1:**
```
Name:  VITE_SUPABASE_URL
Value: https://oplfolmdnhprumcukdkf.supabase.co
```

#### **Variável 2:**
```
Name:  VITE_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wbGZvbG1kbmhwcnVtY3VrZGtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTk0MjY3MzAsImV4cCI6MjAzNTAwMjczMH0.6Z0aN7MSpRrz6q1xXrZ9e8e4h5K6wN3a2bQ8vP1xYvI
```

#### **Variável 3 (Opcional, para backend):**
```
Name:  VITE_API_URL
Value: https://seu-backend-url.com/api
```
> Altere `seu-backend-url.com` para o URL real do seu backend no Railway, Fly.io, etc

### 4. Salve e Redeploy
- Clique em **"Save"**
- Vá para **"Deployments"** e clique em **"Redeploy"** ou pushe novo commit para GitHub

### 5. Aguarde o build
- O app deve redeployar automaticamente
- Abra a URL do seu projeto para verificar

---

## Checklist de Configuração

- [ ] ✅ VITE_SUPABASE_URL adicionada
- [ ] ✅ VITE_SUPABASE_ANON_KEY adicionada
- [ ] ✅ Projeto redeployado
- [ ] ✅ App carrega sem tela branca

---

## Se ainda tiver problemas

1. **Abra o DevTools** (F12) → Console → veja se há erros
2. **Verifique o build log** na aba "Deployments"
3. **Teste localmente** com `npm run dev`
4. **Contate suporte** do Vercel se necessário

