export function resolveCharacterImage(image: string | undefined, gameId: string | undefined): string {
  if (!image) return '';
  if (isAbsoluteUrl(image)) return image;
  return `/api/images/${gameId}/characters/${image}`;
}

export function resolveBackgroundImage(background: string | undefined, gameId: string | undefined): string {
  if (!background) return '';
  if (isAbsoluteUrl(background)) return background;
  return `/api/images/${gameId}/${background}`;
}

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}
