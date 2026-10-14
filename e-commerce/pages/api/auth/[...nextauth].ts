import NextAuth, { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "../../../libs/prismadb";
import CredentialsProvider from "next-auth/providers/credentials";
import { authenticateUser } from "@/libs/authenticateUser";
import { AuthRateLimitError, getAuthClientIp } from "@/libs/authRateLimit";
import { getActiveSessionUser, getActiveUserWhere } from "@/libs/authSession";

const getGoogleProfileImage = (profile: unknown): string | null => {
  if (!profile || typeof profile !== "object") {
    return null;
  }

  const parsedProfile = profile as { picture?: unknown; image?: unknown };

  if (
    typeof parsedProfile.picture === "string" &&
    parsedProfile.picture.trim().length > 0
  ) {
    return parsedProfile.picture;
  }

  if (
    typeof parsedProfile.image === "string" &&
    parsedProfile.image.trim().length > 0
  ) {
    return parsedProfile.image;
  }

  return null;
};

async function updateOAuthProfile(
  userId: string,
  provider: string,
  profile: unknown,
) {
  const currentUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!currentUser || (currentUser.status || "ACTIVE") !== "ACTIVE") {
    return;
  }

  const oauthProfile = profile as
    | {
        email?: string;
        email_verified?: boolean;
        picture?: { data?: { url?: string } };
      }
    | undefined;
  const image =
    provider === "google"
      ? getGoogleProfileImage(profile)
      : oauthProfile?.picture?.data?.url;
  const data: { image?: string; emailVerified?: Date } = {};
  if (typeof image === "string" && image && !currentUser.image) {
    data.image = image;
  }
  if (
    provider === "google" &&
    oauthProfile?.email_verified === true &&
    typeof oauthProfile.email === "string" &&
    oauthProfile.email.toLowerCase() === currentUser.email?.toLowerCase() &&
    !currentUser.emailVerified
  ) {
    data.emailVerified = new Date();
  }

  if (Object.keys(data).length > 0) {
    await prisma.user.updateMany({
      where: getActiveUserWhere(userId, currentUser.sessionVersion || 0),
      data,
    });
  }
}

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      allowDangerousEmailAccountLinking: false,
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID as string,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET as string,
      allowDangerousEmailAccountLinking: false,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        emailOrUsername: { label: "Email or Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        try {
          const authenticated = await authenticateUser(
            credentials?.emailOrUsername,
            credentials?.password,
            getAuthClientIp(request.headers || {}),
          );
          if (!authenticated) {
            throw new Error("Invalid email/username or password");
          }

          return {
            ...authenticated.user,
            sessionVersion: authenticated.sessionVersion,
          };
        } catch (error: unknown) {
          if (error instanceof AuthRateLimitError) {
            throw new Error(error.message);
          }

          if (
            error instanceof Error &&
            error.message === "Invalid email/username or password"
          ) {
            throw error;
          }

          throw new Error(
            "Sign-in is temporarily unavailable. Please try again.",
          );
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  debug: false,
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  events: {
    async linkAccount({ user, account, profile }) {
      if (account.provider === "google" || account.provider === "facebook") {
        await updateOAuthProfile(user.id, account.provider, profile);
      }
    },
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "credentials") {
        const authenticatedUser = user as typeof user & {
          sessionVersion?: number;
        };
        return Boolean(
          await getActiveSessionUser(
            user.id,
            authenticatedUser.sessionVersion ?? 0,
          ),
        );
      }

      if (account?.provider === "google" || account?.provider === "facebook") {
        const linkedAccount = await prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          },
          include: { user: true },
        });
        const currentUser =
          linkedAccount?.user ||
          (user.email
            ? await prisma.user.findUnique({
                where: { email: user.email.toLowerCase() },
              })
            : null);
        if (currentUser && (currentUser.status || "ACTIVE") !== "ACTIVE") {
          return false;
        }
        if (currentUser) {
          await updateOAuthProfile(currentUser.id, account.provider, profile);
        }
      }

      return true;
    },

    async jwt({ token, user, account }) {
      const revokedToken = { sessionRevoked: true };
      if (!user && token.sessionRevoked) {
        return revokedToken;
      }

      const userId = user?.id || token.userId || token.sub;
      if (typeof userId !== "string") {
        return revokedToken;
      }

      let sessionVersion =
        token.sessionVersion === undefined ? 0 : token.sessionVersion;
      if (user) {
        if (account?.provider === "credentials") {
          sessionVersion =
            (user as typeof user & { sessionVersion?: number })
              .sessionVersion ?? 0;
        } else {
          const currentUser = await prisma.user.findUnique({
            where: { id: userId },
          });
          sessionVersion = currentUser?.sessionVersion || 0;
        }
      }
      if (typeof sessionVersion !== "number") {
        return revokedToken;
      }

      const currentUser = await getActiveSessionUser(userId, sessionVersion);
      if (!currentUser) {
        return revokedToken;
      }

      return {
        name: currentUser.name,
        email: currentUser.email,
        picture: currentUser.image,
        role: currentUser.role,
        sub: userId,
        iat: token.iat,
        exp: token.exp,
        jti: token.jti,
        userId,
        sessionVersion,
        authenticatedAt: user
          ? Date.now()
          : typeof token.authenticatedAt === "number"
            ? token.authenticatedAt
            : 0,
      };
    },
    async session({ session, token }) {
      if (token.sessionRevoked || typeof token.userId !== "string") {
        return { expires: session.expires, user: undefined };
      }

      return {
        expires: session.expires,
        user: {
          name: token.name,
          email: token.email,
          image: token.picture,
          role: token.role,
          id: token.userId,
          sessionVersion: token.sessionVersion,
          authenticatedAt: token.authenticatedAt,
        },
      };
    },
  },
};

export default NextAuth(authOptions);
