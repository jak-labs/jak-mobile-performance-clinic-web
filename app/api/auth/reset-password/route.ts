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
    const { email, verificationCode, newPassword } = await req.json();

    if (!email || !verificationCode || !newPassword) {
      return NextResponse.json(
        { error: 'Email, verification code, and new password are required' },
        { status: 400 }
      );
    }

    // Validate password strength (Cognito requirements)
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    return new Promise((resolve) => {
      const userPool = getUserPool();
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool
      });

      cognitoUser.confirmPassword(verificationCode, newPassword, {
        onSuccess: () => {
          resolve(NextResponse.json(
            { 
              success: true,
              message: 'Password reset successfully'
            },
            { status: 200 }
          ));
        },
        onFailure: (err) => {
          console.error('Reset password error:', err);
          resolve(NextResponse.json(
            { 
              error: err.message || 'Failed to reset password. Please check your verification code and try again.'
            },
            { status: 400 }
          ));
        }
      });
    });
  } catch (error: any) {
    console.error('Reset password API error:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred' },
      { status: 500 }
    );
  }
}






