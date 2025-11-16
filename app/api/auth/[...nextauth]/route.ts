import NextAuth, { NextAuthOptions, Session, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { CognitoUser as AWSCognitoUser, AuthenticationDetails, CognitoUserPool } from "amazon-cognito-identity-js";

// Extend the built-in session types to include our custom fields
interface ExtendedSession extends Session {
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  }
}

// Lazy initialization function to avoid checking env vars at build time
function getUserPool() {
  if (!process.env.COGNITO_CLIENT_ID || !process.env.COGNITO_ISSUER) {
    console.error('Environment variables check failed:', { 
      COGNITO_CLIENT_ID: !!process.env.COGNITO_CLIENT_ID,
      COGNITO_ISSUER: !!process.env.COGNITO_ISSUER
    });
    throw new Error('Missing required environment variables for Cognito authentication');
  }

  // Extract UserPoolId from COGNITO_ISSUER
  const userPoolId = process.env.COGNITO_ISSUER.split('/').pop();
  if (!userPoolId) {
    console.error('Failed to extract UserPoolId from COGNITO_ISSUER:', process.env.COGNITO_ISSUER);
    throw new Error('Invalid COGNITO_ISSUER format');
  }

  const poolData = {
    UserPoolId: userPoolId,
    ClientId: process.env.COGNITO_CLIENT_ID
  };

  console.log('Initializing with pool data:', { 
    UserPoolId: poolData.UserPoolId,
    ClientId: poolData.ClientId 
  });

  return new CognitoUserPool(poolData);
}

export const authOptions: NextAuthOptions = {
  debug: process.env.NODE_ENV === 'development',
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Cognito",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            throw new Error("Please enter an email and password");
          }

          return new Promise((resolve, reject) => {
            const userPool = getUserPool();
            const user = new AWSCognitoUser({
              Username: credentials.email,
              Pool: userPool
            });

            const authDetails = new AuthenticationDetails({
              Username: credentials.email,
              Password: credentials.password,
            });

            user.authenticateUser(authDetails, {
              onSuccess: (session) => {
                resolve({
                  id: user.getUsername(),
                  email: credentials.email,
                  name: credentials.email,
                });
              },
              onFailure: (err) => {
                console.error('Cognito authentication error:', err);
                reject(new Error(err.message || 'Authentication failed'));
              },
            });
          });
        } catch (error) {
          console.error('Authorization error:', error);
          throw error;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      try {
        if (user) {
          token.id = user.id;
          token.email = user.email;
        }
        return token;
      } catch (error) {
        console.error('JWT callback error:', error);
        throw error;
      }
    },
    async session({ session, token }): Promise<ExtendedSession> {
      try {
        if (!session?.user) {
          console.error('No user in session');
          throw new Error('No user in session');
        }
        return {
          ...session,
          user: {
            ...session.user,
            id: token.id as string,
          }
        };
      } catch (error) {
        console.error('Session callback error:', error);
        throw error;
      }
    }
  },
  pages: {
    signIn: '/sign-in',
  },
  session: {
    strategy: 'jwt',
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

