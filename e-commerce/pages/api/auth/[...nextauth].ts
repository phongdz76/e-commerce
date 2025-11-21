import NextAuth, { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "../../../libs/prismadb";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcrypt";

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        emailOrUsername: { label: "Email or Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.emailOrUsername || !credentials?.password) {
          throw new Error("Please enter email/username and password");
        }

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: credentials.emailOrUsername },
              { name: credentials.emailOrUsername },
            ],
          },
        });

        if (!user || !user.hashedPassword) {
          throw new Error("No account found with this email or username");
        }

        const isCorrectPassword = await compare(
          credentials.password,
          user.hashedPassword
        );

        if (!isCorrectPassword) {
          throw new Error("Incorrect password");
        }

        return user;
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  debug: process.env.NODE_ENV === "development",
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  events: {
    async linkAccount({ user, account, profile }) {
      // Khi Google account được link, cập nhật thông tin từ Google
      if (account.provider === "google" && profile?.image) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            image: profile.image,
            emailVerified: new Date(),
          },
        });
      }
    },
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // Khi đăng nhập lần đầu, gán thông tin từ account và user
      if (account && user) {
        return {
          ...token,
          accessToken: account.access_token,
          idToken: account.id_token,
          expiresIn: account.expires_at,
          userId: user.id,
        };
      }
      return token;
    },
    async session({ session, token }) {
      // Gán thông tin token vào session để client có thể truy cập
      return {
        ...session,
        accessToken: token.accessToken,
        idToken: token.idToken,
        expiresIn: token.expiresIn,
        user: {
          ...session.user,
          id: token.userId,
        },
      };
    },
  },
};

export default NextAuth(authOptions);
