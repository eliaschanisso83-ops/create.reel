-- Script SQL para criar a tabela 'jobs' no Supabase
-- Execute isso no SQL Editor do seu projeto Supabase

CREATE TABLE jobs (
  id UUID PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  image_urls TEXT[] NOT NULL,
  music_url TEXT,
  duration INTEGER NOT NULL,
  transition TEXT NOT NULL,
  resolution TEXT NOT NULL,
  template TEXT NOT NULL,
  output_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar bucket 'uploads' no Storage se não existir
-- Vá para Storage > Buckets no painel do Supabase e crie um bucket chamado 'uploads'
-- Configure as políticas para permitir uploads públicos ou autenticados conforme necessário