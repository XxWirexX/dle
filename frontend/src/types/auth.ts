export interface User {
  id: number;
  username: string;
  email: string;
  avatar_image: string | null;
  avatar_color: string;
  email_verified: number;
}
