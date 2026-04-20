import { useEffect } from 'react';

export default function useTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} - DLE` : 'DLE';
    return () => { document.title = 'Mangadle'; };
  }, [title]);
}
