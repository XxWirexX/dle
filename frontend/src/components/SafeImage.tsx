import { useState } from 'react';

export default function SafeImage({ src, alt, ...props }) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: '0.75rem',
        textAlign: 'center',
        padding: '8px',
        ...props.style
      }}>
        {alt}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setError(true)}
      {...props}
    />
  );
}
