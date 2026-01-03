import { getDataProvider } from './dataProvider';

/**
 * Create and configure Supabase client
 */
export const getSupabaseClient = async () => {
  const provider = getDataProvider();
  if (provider.mode !== 'supabase') {
    throw new Error('Supabase configuration is missing');
  }

  return provider.client;
};
