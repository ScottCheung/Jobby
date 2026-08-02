import { z } from "zod";

export const authSessionSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.string().datetime(),
  user: z.object({
    id: z.string().min(1),
    email: z.string().email(),
  }),
});

export type AuthSession = z.infer<typeof authSessionSchema>;

export type AuthStatus =
  | { connected: false }
  | {
      connected: true;
      expiresAt: string;
      user: AuthSession["user"];
  };
