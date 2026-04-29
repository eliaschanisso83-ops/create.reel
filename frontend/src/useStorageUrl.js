import { useState } from 'react';
import { supabase } from './supabaseClient';

/**
 * Hook para gerar URLs de storage usando a Edge Function storage-access-helper
 * Retorna public URL se o bucket for público, ou signed URL se for privado
 */
export function useStorageUrl() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getStorageUrl = async (bucket, path, ttlSeconds = 3600) => {
    setLoading(true);
    setError(null);

    try {
      // Pegar token do usuário autenticado
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;
      const authHeader = token ? `Bearer ${token}` : '';

      // Chamar a Edge Function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/storage-access-helper`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authHeader && { Authorization: authHeader }),
          },
          body: JSON.stringify({
            bucket,
            path,
            ttlSeconds,
            asPublicUrlIfPossible: true,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ao gerar URL: ${response.statusText}`);
      }

      const data = await response.json();
      setLoading(false);
      return data; // { kind: 'public'|'signed', url: string, signedUrl: string, ... }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      setLoading(false);
      throw err;
    }
  };

  return { getStorageUrl, loading, error };
}
