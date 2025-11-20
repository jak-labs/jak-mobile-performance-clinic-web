import { NextRequest, NextResponse } from 'next/server';
import { CognitoUser, CognitoUserPool } from 'amazon-cognito-identity-js';

// Lazy initialization function to avoid checking env vars at build time
function getUserPool() {
  if (!process.env.COGNITO_CLIENT_ID || !process.env.COGNITO_ISSUER) {
    throw new Error('Missing required environment variables for Cognito authentication');
  }

  // Extract UserPoolId from COGNITO_ISSUER
  const userPoolId = process.env.COGNITO_ISSUER.split('/').pop();
  if (!userPoolId) {
    throw new Error('Invalid COGNITO_ISSUER format');
  }

  const poolData = {
    UserPoolId: userPoolId,
    ClientId: process.env.COGNITO_CLIENT_ID
  };

  return new CognitoUserPool(poolData);
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    return new Promise((resolve) => {
      const userPool = getUserPool();
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool
      });

      cognitoUser.forgotPassword({
        onSuccess: (data) => {
          // Success - verification code sent to email
          resolve(NextResponse.json(
            { 
              success: true,
              message: 'Verification code sent to your email'
            },
            { status: 200 }
          ));
        },
        onFailure: (err) => {
          console.error('Forgot password error:', err);
          resolve(NextResponse.json(
            { 
              error: err.message || 'Failed to send verification code. Please check your email address.'
            },
            { status: 400 }
          ));
        }
      });
    });
  } catch (error: any) {
    console.error('Forgot password API error:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred' },
      { status: 500 }
    );
  }
}

